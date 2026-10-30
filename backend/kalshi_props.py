import asyncio
import logging
import time
import httpx
from kalshi import KALSHI_BASE, parse_game_code, norm_name, _f, _fetch_series

logger = logging.getLogger(__name__)

PROP_SERIES = {
    "KXNBAPTS": "Points", "KXNBAREB": "Rebounds", "KXNBAAST": "Assists", "KXNBA3PT": "Made Threes",
    "KXNBARA": "RA (Rebounds + Assists)", "KXNBAPRA": "PRA (Points + Rebounds + Assists)", "KXNBA3D": "Triple Double",
    "KXNBAPR": "PR (Points + Rebounds)", "KXNBAPA": "PA (Points + Assists)",
    "KXNBASTL": "Steals", "KXNBABLK": "Blocks", "KXNBASTOCK": "SB (Steals + Blocks)", "KXNBASTOCKS": "SB (Steals + Blocks)",
    "KXNBAFTM": "Free Throws Made",
}
ORDER = list(dict.fromkeys(PROP_SERIES.values()))
PREFIXES = tuple(f"{s}-" for s in PROP_SERIES)

_cache = {"t": 0, "data": None}
_combos = {"t": 0, "index": {}, "scanned": 0}


def _price(m):
    return {"yes_bid": _f(m.get("yes_bid_dollars")), "yes_ask": _f(m.get("yes_ask_dollars")),
            "no_bid": _f(m.get("no_bid_dollars")), "no_ask": _f(m.get("no_ask_dollars")),
            "last": _f(m.get("last_price_dollars")), "volume": _f(m.get("volume_fp"))}


async def load_props(ttl=20):
    if _cache["data"] and time.time() - _cache["t"] < ttl:
        return _cache["data"]
    async with httpx.AsyncClient(timeout=25) as client:
        results = await asyncio.gather(*[_fetch_series(client, s) for s in PROP_SERIES], return_exceptions=True)
    games = {}
    for series, markets in zip(PROP_SERIES, results):
        if isinstance(markets, Exception):
            logger.warning("Kalshi series %s failed: %s", series, markets)
            continue
        label = PROP_SERIES[series]
        for m in markets:
            parts = m["ticker"].split("-")
            code = parts[1] if len(parts) > 2 else None
            info = parse_game_code(code) if code else None
            if not info:
                continue
            g = games.setdefault(code, {"code": code, **info, "label": f"{info['teams'][0]} vs {info['teams'][1]}", "players": {}})
            name = (m.get("yes_sub_title") or m.get("title") or "").split(":")[0].strip()
            key = norm_name(name)
            p = g["players"].setdefault(key, {"key": key, "name": name, "team": parts[2][:3], "markets": {}})
            strike = m.get("floor_strike")
            if series in ("KXNBA2D", "KXNBA3D"):
                strike = None
            p["markets"].setdefault(label, []).append({
                "ticker": m["ticker"], "market": label,
                "threshold": int(strike + 0.5) if strike is not None else None,
                "line": strike, **_price(m),
            })
    for g in games.values():
        for p in g["players"].values():
            for lines in p["markets"].values():
                lines.sort(key=lambda l: l["threshold"] or 0)
    _cache.update(t=time.time(), data=games)
    return games


async def _get_page(client, params):
    for attempt in range(4):
        r = await client.get(f"{KALSHI_BASE}/markets", params=params)
        if r.status_code != 429:
            r.raise_for_status()
            return r.json()
        await asyncio.sleep(2 * (attempt + 1))
    r.raise_for_status()


async def scan_combos(max_pages=60):
    """Index open Kalshi combo markets made only of NBA player-prop YES legs."""
    index, cur, n = {}, None, 0
    try:
        async with httpx.AsyncClient(timeout=25) as client:
            for _ in range(max_pages):
                params = {"mve_filter": "only", "status": "open", "limit": 1000}
                if cur:
                    params["cursor"] = cur
                d = await _get_page(client, params)
                for m in d.get("markets", []):
                    n += 1
                    legs = m.get("mve_selected_legs") or []
                    if not legs or len(legs) > 8:
                        continue
                    if not all(l.get("market_ticker", "").startswith(PREFIXES) and l.get("side") == "yes" for l in legs):
                        continue
                    key = frozenset(l["market_ticker"] for l in legs)
                    index[key] = {"ticker": m["ticker"], "title": m.get("title"), **_price(m)}
                cur = d.get("cursor")
                if not cur:
                    break
                await asyncio.sleep(0.4)
    finally:
        if index:
            _combos.update(t=time.time(), index=index, scanned=n)


async def combo_loop():
    while True:
        try:
            await scan_combos()
        except Exception as e:  # keep the loop alive on network errors
            logger.warning("combo scan failed: %s", e)
        await asyncio.sleep(120)


def find_combo(tickers):
    return _combos["index"].get(frozenset(tickers))


def combo_index_info():
    return {"indexed": len(_combos["index"]), "scanned": _combos["scanned"], "updated": _combos["t"] or None}
