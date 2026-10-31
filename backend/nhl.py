import asyncio
import logging
import os
import time
from datetime import datetime
from zoneinfo import ZoneInfo

import httpx

import kalshi_auth
import oddsblaze
from kalshi import norm_name, _f, _fetch_series

logger = logging.getLogger(__name__)
ET = ZoneInfo("America/New_York")
SERIES = ("KXNHLGAME", "KXNHLGOAL", "KXNHLPTS", "KXNHLTOTAL")
ALIAS = {"NAS": "NSH", "MON": "MTL", "WAS": "WSH", "VEG": "VGK", "NJD": "NJ", "LAK": "LA", "SJS": "SJ", "TBL": "TB", "UTAH": "UTA"}
SGP_BOOKS = {"draftkings": "dk", "fanatics": "fan", "caesars": "czr"}
ESPN_NHL = "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl"
_photos = {"t": 0, "map": {}}


async def headshots(ttl=12 * 3600):
    """norm_name -> ESPN NHL headshot URL for every roster player."""
    if _photos["map"] and time.time() - _photos["t"] < ttl:
        return _photos["map"]
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(f"{ESPN_NHL}/teams")
            r.raise_for_status()
            ids = [t["team"]["id"] for t in r.json()["sports"][0]["leagues"][0]["teams"]]
            res = await asyncio.gather(*[client.get(f"{ESPN_NHL}/teams/{i}/roster") for i in ids], return_exceptions=True)
        out = {}
        for x in res:
            if isinstance(x, Exception) or x.status_code != 200:
                continue
            for grp in x.json().get("athletes", []):
                for a in grp.get("items", []):
                    out[norm_name(a.get("fullName"))] = (a.get("headshot") or {}).get("href") or f"https://a.espncdn.com/i/headshots/nhl/players/full/{a['id']}.png"
        if out:
            _photos.update(t=time.time(), map=out)
    except httpx.HTTPError as e:
        logger.warning("ESPN NHL headshots failed: %s", e)
    return _photos["map"]
_cache = {"t": 0, "data": None}
_books = {}
_sem = asyncio.Semaphore(6)
_sgp_sem = {b: asyncio.Semaphore(3) for b in ("draftkings", "fanatics", "caesars")}


def _mid(m):
    bid, ask = _f(m.get("yes_bid_dollars")), _f(m.get("yes_ask_dollars"))
    return (bid + ask) / 2 if bid and ask else _f(m.get("last_price_dollars")) or 0


async def load_games(ttl=20):
    """{code: {code, date, label, teams[], names{}, ml{abbr: ticker}, total{line, ticker}, players{key: {...}}}} from open Kalshi NHL markets."""
    if _cache["data"] and time.time() - _cache["t"] < ttl:
        return _cache["data"]
    async with httpx.AsyncClient(timeout=25) as client:
        res = dict(zip(SERIES, await asyncio.gather(*[_fetch_series(client, s) for s in SERIES])))
    games = {}
    for m in res["KXNHLGAME"]:
        code, abbr = m["event_ticker"].split("-")[1], m["ticker"].split("-")[-1]
        g = games.setdefault(code, {"code": code, "teams": [], "names": {}, "ml": {}, "totals": [], "players": {}})
        g["teams"].append(abbr)
        g["names"][abbr] = m.get("yes_sub_title") or abbr
        g["ml"][abbr] = m["ticker"]
    for m in res["KXNHLTOTAL"]:
        g = games.get(m["event_ticker"].split("-")[1])
        if g and m.get("floor_strike") is not None:
            g["totals"].append({"line": m["floor_strike"], "ticker": m["ticker"], "mid": _mid(m)})
    for series, want, field in (("KXNHLGOAL", 1, "goal"), ("KXNHLPTS", 2, "pts")):
        for m in res[series]:
            parts = m["ticker"].split("-")
            g = games.get(parts[1])
            if not g or m.get("floor_strike") != want - 0.5:
                continue
            team = max((t for t in g["teams"] if parts[2].startswith(t)), key=len, default=None)
            name = (m.get("yes_sub_title") or "").split(":")[0].strip()
            if team and name:
                p = g["players"].setdefault(norm_name(name), {"key": norm_name(name), "name": name, "team": team})
                p[field] = m["ticker"]
                if field == "goal":
                    p["gmid"] = _mid(m)
    out = {}
    for code, g in games.items():
        if len(g["teams"]) != 2 or not g["totals"] or not any("goal" in p and "pts" in p for p in g["players"].values()):
            continue
        away, home = (g["teams"] if code.endswith(g["teams"][1]) else g["teams"][::-1])
        main = min(g["totals"], key=lambda t: abs(t["mid"] - 0.5))
        dt = datetime.strptime(code[:7], "%y%b%d")
        out[code] = {**g, "away": away, "home": home, "total": {"line": main["line"], "ticker": main["ticker"]},
                     "date": dt.strftime("%Y-%m-%d"), "label": f"{away} @ {home}"}
    _cache.update(t=time.time(), data=out)
    return out


async def _book_lines(client, book, ttl=120):
    """{(date, away, home): {"ml": {abbr: sgp}, "total": {line: sgp}, "players": {key: {"goal": sgp, "pts": sgp}}}} pregame."""
    hit = _books.get(book)
    if hit and time.time() - hit["t"] < ttl:
        return hit["games"]
    r = await client.get(oddsblaze.ODDS, params={"key": os.environ["ODDSBLAZE_API_KEY"], "sportsbook": book, "league": "nhl",
                                                 "market": "Moneyline,Total Goals,Player Goals,Player Points", "live": "false"})
    games = {}
    if r.status_code == 200:
        for e in r.json().get("events", []):
            ab = {s: ALIAS.get(e["teams"][s]["abbreviation"], e["teams"][s]["abbreviation"]) for s in ("away", "home")}
            names = {e["teams"][s]["name"]: ab[s] for s in ab}
            day = datetime.fromisoformat(e["date"].replace("Z", "+00:00")).astimezone(ET).strftime("%Y-%m-%d")
            g = games.setdefault((day, ab["away"], ab["home"]), {"ml": {}, "total": {}, "players": {}})
            for o in e.get("odds", []):
                sel, sgp = o.get("selection") or {}, o.get("sgp")
                if not sgp:
                    continue
                if o["market"] == "Moneyline" and sel.get("name") in names:
                    g["ml"][names[sel["name"]]] = sgp
                elif o["market"] == "Total Goals" and sel.get("side") == "Over":
                    g["total"][sel.get("line")] = sgp
                elif o["market"] in ("Player Goals", "Player Points") and sel.get("side") == "Over" and sel.get("name"):
                    want, field = (0.5, "goal") if o["market"] == "Player Goals" else (1.5, "pts")
                    if sel.get("line") == want:
                        g["players"].setdefault(norm_name(sel["name"]), {})[field] = sgp
    else:
        logger.info("OddsBlaze %s NHL unavailable: %s", book, r.status_code)
    _books[book] = {"t": time.time(), "games": games}
    return games


async def _sgp_book(client, g, p, book):
    try:
        bg = (await _book_lines(client, book)).get((g["date"], g["away"], g["home"])) or {}
    except (httpx.HTTPError, ValueError, KeyError, TypeError) as e:
        logger.warning("OddsBlaze %s NHL failed: %s", book, e)
        return None
    pl = bg.get("players", {}).get(p["key"], {})
    legs = [bg.get("ml", {}).get(p["team"]), pl.get("goal"), pl.get("pts"), bg.get("total", {}).get(g["total"]["line"])]
    if None in legs:
        return None
    try:
        async with _sgp_sem[book]:
            return await oddsblaze._price(client, book, legs)
    except httpx.HTTPError as e:
        logger.warning("OddsBlaze NHL SGP failed: %s", e)
        return None


async def _sgp(client, g, p):
    prices = await asyncio.gather(*[_sgp_book(client, g, p, b) for b in SGP_BOOKS])
    return {short: v for short, v in zip(SGP_BOOKS.values(), prices) if v is not None}


async def _quote(row):
    async with _sem:
        try:
            row["live"] = await kalshi_auth.live_combo_quote(row["tickers"], target_dollars=10)
        except (kalshi_auth.KalshiAuthError, httpx.HTTPError) as e:
            row["error"] = str(e)[:160]


async def _row(client, r):
    r["sgp"] = await _sgp(client, r["_g"], r["_p"])
    if r["sgp"] and kalshi_auth.configured():
        await _quote(r)


async def board(budget=40):
    """Kalshi 4-leg combo per player (own team wins, 1+ goal, 2+ points, game over the main total) vs DK/Fanatics SGP."""
    games = await load_games()
    photos = await headshots()
    rows = []
    async with httpx.AsyncClient(timeout=30) as client:
        if oddsblaze.configured():
            for b in SGP_BOOKS:  # warm the per-book caches once before fanning out
                try:
                    await _book_lines(client, b)
                except (httpx.HTTPError, ValueError, KeyError, TypeError) as e:
                    logger.warning("OddsBlaze %s NHL failed: %s", b, e)
        for g in games.values():
            for p in g["players"].values():
                if "goal" in p and "pts" in p:
                    rows.append({"key": p["key"], "name": p["name"], "team": p["team"], "headshot": photos.get(p["key"]),
                                 "opp": g["home"] if p["team"] == g["away"] else g["away"],
                                 "game": {"code": g["code"], "date": g["date"], "label": g["label"]}, "total": g["total"]["line"],
                                 "tickers": [g["ml"][p["team"]], p["goal"], p["pts"], g["total"]["ticker"]], "_g": g, "_p": p})
        rows.sort(key=lambda r: -r["_p"].get("gmid", 0))  # likeliest scorers first, in case the time budget runs out
        if oddsblaze.configured() and rows:
            tasks = [asyncio.create_task(_row(client, r)) for r in rows]
            _, late = await asyncio.wait(tasks, timeout=budget)
            for t in late:
                t.cancel()
            await asyncio.gather(*late, return_exceptions=True)
    players = [{k: v for k, v in r.items() if not k.startswith("_")} for r in rows if r.get("sgp") and (r.get("live") or {}).get("yes_price")]
    return {"players": players, "games": len(games), "sgp": oddsblaze.configured(), "kalshi": kalshi_auth.configured()}
