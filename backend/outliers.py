import asyncio
import logging
import os
import time

import httpx

import oddsblaze
from kalshi import norm_name

logger = logging.getLogger(__name__)

TARGET = "fanatics"
OTHERS = {"draftkings": "DraftKings", "fanduel": "FanDuel", "betmgm": "BetMGM", "hard-rock": "Hard Rock"}
MARKETS = {
    "Player Points": "points", "Player Rebounds": "rebounds", "Player Assists": "assists",
    "Player Points + Rebounds": "pts + reb", "Player Points + Assists": "pts + ast", "Player Rebounds + Assists": "reb + ast",
    "Player Points + Rebounds + Assists": "pts + reb + ast", "Player Threes Made": "threes", "Player Steals": "steals", "Player Blocks": "blocks",
}
_cache = {}
_first_seen = {}


def _american(p):
    try:
        return int(str(p).replace("+", ""))
    except (TypeError, ValueError):
        return None


def _decimal(a):
    return 1 + a / 100 if a > 0 else 1 + 100 / -a


async def _book(client, book, ttl=120):
    """{(away, home, player, market, line): (american, player_name, event)} of Over prices for one book."""
    hit = _cache.get(book)
    if hit and time.time() - hit["t"] < ttl:
        return hit["lines"]
    await oddsblaze._all_limit.wait()
    r = await client.get(oddsblaze.ODDS, params={"key": os.environ["ODDSBLAZE_API_KEY"], "sportsbook": book, "league": "nba",
                                                "market": ",".join(MARKETS), "live": "false"})
    lines = {}
    if r.status_code == 200:
        for e in r.json().get("events", []):
            away, home = e["teams"]["away"]["abbreviation"], e["teams"]["home"]["abbreviation"]
            ev = {"away": away, "home": home, "date": e.get("date")}
            for o in e.get("odds", []):
                sel = o.get("selection") or {}
                a = _american(o.get("price"))
                if sel.get("side") == "Over" and a and o.get("market") in MARKETS and sel.get("name"):
                    lines[(away, home, norm_name(sel["name"]), o["market"], sel.get("line"))] = (a, sel["name"], ev)
    else:
        logger.info("OddsBlaze %s outliers unavailable: %s", book, r.status_code)
    _cache[book] = {"t": time.time(), "lines": lines}
    return lines


async def scan():
    if not oddsblaze.configured():
        return {"rows": [], "games": [], "updated_at": None}
    client = oddsblaze._http()
    books = [TARGET, *OTHERS]
    res = await asyncio.gather(*(_book(client, b) for b in books), return_exceptions=True)
    data = {b: (r if isinstance(r, dict) else {}) for b, r in zip(books, res)}
    now, rows, games = time.time(), [], {}
    for k, (price, name, ev) in data[TARGET].items():
        g = games.setdefault(f"{ev['away']}@{ev['home']}", {**ev, "props": 0})
        g["props"] += 1
        others = [(data[b][k][0], label) for b, label in OTHERS.items() if k in data[b]]
        if not others:
            continue
        best, best_book = max(others, key=lambda x: _decimal(x[0]))
        edge = _decimal(price) / _decimal(best) - 1
        if edge <= 0:
            continue
        opened = _first_seen.setdefault((k, price), {"t": now, "next_best": best, "next_book": best_book})
        rows.append({"player": name, "market": MARKETS[k[3]], "line": k[4], "game": ev, "price": price, "next_best": best,
                     "next_book": best_book, "books": len(others), "pays_more": round(edge, 4), "open_for": int(now - opened["t"]),
                     "prices": [{"book": label, "price": p} for p, label in sorted(others, key=lambda x: -_decimal(x[0]))],
                     "opened": {"at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(opened["t"])), "next_best": opened["next_best"], "next_book": opened["next_book"]}})
    rows.sort(key=lambda r: -r["pays_more"])
    return {"rows": rows, "games": sorted(games.values(), key=lambda g: g["date"] or ""),
            "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now))}
