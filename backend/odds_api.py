import asyncio
import logging
import os
import time
from datetime import datetime
from zoneinfo import ZoneInfo

import httpx

from kalshi import TEAMS, norm_name

logger = logging.getLogger(__name__)
BASE = "https://api.the-odds-api.com/v4/sports/basketball_nba"
BOOKS = {"fanduel": "fd", "draftkings": "dk"}
_events = {"t": 0, "data": []}
_odds = {}
quota = {"remaining": None, "used": None}
_sem = asyncio.Semaphore(2)


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


ET = ZoneInfo("America/New_York")
ABBR = {v: k for k, v in TEAMS.items() if k != "BRK"}


async def schedule(days=2):
    """Today's and tomorrow's games (US Eastern) as Kalshi-style codes, from the free events list."""
    if not configured():
        return []
    async with httpx.AsyncClient(timeout=20) as client:
        await _event_id(client, "", "")
    today = datetime.now(ET).date()
    out = []
    for e in _events["data"]:
        start = datetime.fromisoformat(e["commence_time"].replace("Z", "+00:00")).astimezone(ET)
        away = next((a for n, a in ABBR.items() if e["away_team"].endswith(n)), None)
        home = next((a for n, a in ABBR.items() if e["home_team"].endswith(n)), None)
        if not (away and home) or not 0 <= (start.date() - today).days < days:
            continue
        code = f"{start:%y}{start:%b}{start:%d}".upper() + away + home
        out.append({"code": code, "date": start.date().isoformat(), "teams": [away, home], "label": f"{away} vs {home}",
                    "start": start.isoformat()})
    return out


async def triple_double_odds(away, home, ttl=300):
    """{norm_name: {"name": str, "odds": {"fd": american, "dk": american}}} for one game's 'To record a triple-double: Yes' (1 credit per fresh fetch)."""
    if not configured():
        return {}, None
    key = (away, home)
    hit = _odds.get(key)
    if hit and time.time() - hit["t"] < ttl:
        return hit["players"], hit["updated"]
    try:
        async with _sem, httpx.AsyncClient(timeout=20) as client:
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
