import logging
import os
import time

import httpx

from kalshi import TEAMS, norm_name

logger = logging.getLogger(__name__)
BASE = "https://api.the-odds-api.com/v4/sports/basketball_nba"
BOOKS = {"fanduel": "fd", "draftkings": "dk"}
_events = {"t": 0, "data": []}
_odds = {}
quota = {"remaining": None, "used": None}


def configured():
    return bool(os.environ.get("ODDS_API_KEY"))


def _track(r):
    if r.headers.get("x-requests-remaining") is not None:
        quota.update(remaining=r.headers.get("x-requests-remaining"), used=r.headers.get("x-requests-used"))


async def _get(client, path, params):
    r = await client.get(f"{BASE}{path}", params={"apiKey": os.environ["ODDS_API_KEY"], **params})
    _track(r)
    r.raise_for_status()
    return r.json()


async def _event_id(client, away, home):
    """Events list is free on The Odds API; cache it 10 minutes."""
    if time.time() - _events["t"] > 600:
        _events.update(t=time.time(), data=await _get(client, "/events", {}))
    a, h = TEAMS.get(away, away), TEAMS.get(home, home)
    for e in _events["data"]:
        if e["away_team"].endswith(a) and e["home_team"].endswith(h):
            return e["id"]
    return None


def _implied(a):
    return 100 / (a + 100) if a > 0 else -a / (-a + 100)


def _american(p):
    return round(100 * (1 - p) / p) if p < 0.5 else -round(100 * p / (1 - p))


async def triple_double_plus(away, home, pts, ttl=300):
    """Estimated book odds for N+ pts & 10+ reb & 10+ ast: P(TD) x P(N+ pts) / P(10+ pts), each from the same book.
    Uses the book's triple-double price and alternate points lines (4 credits per fresh fetch)."""
    if not configured():
        return {}, None
    key = (away, home, "ladder")
    hit = _odds.get(key)
    if not hit or time.time() - hit["t"] >= ttl:
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                eid = await _event_id(client, away, home)
                if not eid:
                    return {}, None
                d = await _get(client, f"/events/{eid}/odds", {"regions": "us", "bookmakers": ",".join(BOOKS), "oddsFormat": "american",
                                                                "markets": "player_triple_double,player_points_alternate"})
        except httpx.HTTPError as e:
            logger.warning("Odds API failed: %s", e)
            return {}, None
        raw, updated = {}, None
        for b in d.get("bookmakers", []):
            short = BOOKS.get(b.get("key"))
            for m in b.get("markets", []):
                updated = max(updated or "", m.get("last_update") or "")
                for o in m.get("outcomes", []):
                    if not o.get("description"):
                        continue
                    row = raw.setdefault(norm_name(o["description"]), {"name": o["description"], "books": {}})
                    book = row["books"].setdefault(short, {"td": None, "pts": {}})
                    if m["key"] == "player_triple_double" and o.get("name") == "Yes":
                        book["td"] = o["price"]
                    elif m["key"] == "player_points_alternate" and o.get("name") == "Over" and o.get("point") is not None:
                        book["pts"][o["point"]] = o["price"]
        hit = _odds[key] = {"t": time.time(), "raw": raw, "updated": updated}
    players = {}
    for k, row in hit["raw"].items():
        est = {}
        for short, book in row["books"].items():
            want = book["pts"].get(pts - 0.5)
            if book["td"] is None or want is None or not book["pts"]:
                continue
            # 10+ pts: use the 9.5 line, else the lowest line posted (books skip 9.5 for big scorers)
            base = book["pts"].get(9.5) or book["pts"][min(book["pts"])]
            p = _implied(book["td"]) * min(_implied(want) / _implied(base), 1)
            est[short] = _american(p)
        if est:
            players[k] = {"name": row["name"], "odds": est}
    return players, hit["updated"]


async def triple_double_odds(away, home, ttl=300):
    """{norm_name: {"name": str, "odds": {"fd": american, "dk": american}}} for one game's 'To record a triple-double: Yes' (1 credit per fresh fetch)."""
    if not configured():
        return {}, None
    key = (away, home)
    hit = _odds.get(key)
    if hit and time.time() - hit["t"] < ttl:
        return hit["players"], hit["updated"]
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            eid = await _event_id(client, away, home)
            if not eid:
                return {}, None
            d = await _get(client, f"/events/{eid}/odds", {"regions": "us", "bookmakers": ",".join(BOOKS),
                                                            "markets": "player_triple_double", "oddsFormat": "american"})
    except httpx.HTTPError as e:
        logger.warning("Odds API failed: %s", e)
        return (hit or {}).get("players", {}), (hit or {}).get("updated")
    players, updated = {}, None
    for b in d.get("bookmakers", []):
        short = BOOKS.get(b.get("key"))
        for m in b.get("markets", []):
            if m.get("key") != "player_triple_double":
                continue
            updated = max(updated or "", m.get("last_update") or "")
            for o in m.get("outcomes", []):
                if o.get("name") == "Yes" and o.get("description"):
                    row = players.setdefault(norm_name(o["description"]), {"name": o["description"], "odds": {}})
                    row["odds"][short] = o.get("price")
    _odds[key] = {"t": time.time(), "players": players, "updated": updated}
    return players, updated
