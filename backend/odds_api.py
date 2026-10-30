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


async def triple_double_odds(away, home, ttl=300):
    """{norm_name: {"fd": american, "dk": american}} for one game's 'To record a triple-double: Yes' (1 credit per fresh fetch)."""
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
                    players.setdefault(norm_name(o["description"]), {})[short] = o.get("price")
    _odds[key] = {"t": time.time(), "players": players, "updated": updated}
    return players, updated
