import asyncio
import time
import re
import unicodedata
from datetime import date
import httpx

KALSHI_BASE = "https://api.elections.kalshi.com/trade-api/v2"
SERIES = {"dd": "KXNBA2D", "td": "KXNBA3D"}
MONTHS = {m: i + 1 for i, m in enumerate(["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"])}
TEAMS = {
    "ATL": "Hawks", "BOS": "Celtics", "BKN": "Nets", "BRK": "Nets", "CHA": "Hornets", "CHI": "Bulls", "CLE": "Cavaliers",
    "DAL": "Mavericks", "DEN": "Nuggets", "DET": "Pistons", "GSW": "Warriors", "HOU": "Rockets", "IND": "Pacers",
    "LAC": "Clippers", "LAL": "Lakers", "MEM": "Grizzlies", "MIA": "Heat", "MIL": "Bucks", "MIN": "Timberwolves",
    "NOP": "Pelicans", "NYK": "Knicks", "OKC": "Thunder", "ORL": "Magic", "PHI": "76ers", "PHX": "Suns", "POR": "Trail Blazers",
    "SAC": "Kings", "SAS": "Spurs", "TOR": "Raptors", "UTA": "Jazz", "WAS": "Wizards",
}

_cache = {"t": 0, "data": None}


def norm_name(n):
    n = unicodedata.normalize("NFKD", n or "").encode("ascii", "ignore").decode().lower()
    n = re.sub(r"[^a-z ]", "", n)
    return " ".join(w for w in n.split() if w not in ("jr", "sr", "ii", "iii", "iv"))


def parse_game_code(code):
    m = re.match(r"(\d{2})([A-Z]{3})(\d{2})([A-Z]{3})([A-Z]{3})$", code)
    if not m:
        return None
    yy, mon, dd, t1, t2 = m.groups()
    return {"date": date(2000 + int(yy), MONTHS[mon], int(dd)).isoformat(), "teams": [t1, t2]}


def _f(v):
    return float(v) if v not in (None, "") else None


async def _fetch_series(client, series):
    out, cursor = [], None
    for _ in range(10):
        params = {"series_ticker": series, "status": "open", "limit": 1000}
        if cursor:
            params["cursor"] = cursor
        for attempt in range(4):
            r = await client.get(f"{KALSHI_BASE}/markets", params=params)
            if r.status_code != 429:
                break
            await asyncio.sleep(1.5 * (attempt + 1))
        r.raise_for_status()
        d = r.json()
        out += d.get("markets", [])
        cursor = d.get("cursor")
        if not cursor:
            break
    return out


async def load_markets(ttl=20):
    if _cache["data"] and time.time() - _cache["t"] < ttl:
        return _cache["data"]
    games = {}
    async with httpx.AsyncClient(timeout=20) as client:
        for kind, series in SERIES.items():
            for m in await _fetch_series(client, series):
                code = m["event_ticker"].split("-", 1)[1]
                info = parse_game_code(code)
                if not info:
                    continue
                g = games.setdefault(code, {"code": code, **info, "title": m.get("rules_primary", ""), "players": {}})
                name = m.get("yes_sub_title") or m["title"].split(":")[0]
                p = g["players"].setdefault(norm_name(name), {"name": name, "team": m["ticker"].split("-")[-1][:3]})
                p[kind] = {
                    "ticker": m["ticker"],
                    "yes_bid": _f(m.get("yes_bid_dollars")), "yes_ask": _f(m.get("yes_ask_dollars")),
                    "no_bid": _f(m.get("no_bid_dollars")), "no_ask": _f(m.get("no_ask_dollars")),
                    "last": _f(m.get("last_price_dollars")),
                    "close_time": m.get("close_time"),
                }
    for g in games.values():
        t1, t2 = g["teams"]
        g["label"] = f"{t1} vs {t2}"
    _cache.update(t=time.time(), data=games)
    return games
