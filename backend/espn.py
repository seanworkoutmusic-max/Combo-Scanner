import asyncio
import logging
import time
import httpx
from kalshi import norm_name

ESPN = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba"
_cache = {"t": 0, "map": {}}
_lock = asyncio.Lock()
logger = logging.getLogger(__name__)


async def _roster(client, team_id):
    r = await client.get(f"{ESPN}/teams/{team_id}/roster")
    r.raise_for_status()
    return r.json().get("athletes", [])


async def headshots(ttl=12 * 3600):
    """norm_name -> {espn_id, headshot} for every NBA roster player."""
    async with _lock:
        if _cache["map"] and time.time() - _cache["t"] < ttl:
            return _cache["map"]
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                r = await client.get(f"{ESPN}/teams")
                r.raise_for_status()
                teams = [t["team"]["id"] for t in r.json()["sports"][0]["leagues"][0]["teams"]]
                rosters = await asyncio.gather(*[_roster(client, t) for t in teams], return_exceptions=True)
            out = {}
            for roster in rosters:
                if isinstance(roster, Exception):
                    continue
                for a in roster:
                    out[norm_name(a.get("fullName"))] = {
                        "espn_id": a["id"],
                        "headshot": (a.get("headshot") or {}).get("href")
                        or f"https://a.espncdn.com/i/headshots/nba/players/full/{a['id']}.png",
                    }
            if out:
                _cache.update(t=time.time(), map=out)
        except httpx.HTTPError as e:
            logger.warning("ESPN headshots failed: %s", e)
        return _cache["map"]
