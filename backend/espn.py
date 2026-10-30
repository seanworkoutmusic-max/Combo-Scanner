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



STATS_URL = "https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete"
_stats = {"t": 0, "rows": [], "season": None}
# ESPN team abbreviations -> the ones Kalshi uses
_ABBR = {"GS": "GSW", "NO": "NOP", "NY": "NYK", "SA": "SAS", "UTAH": "UTA", "WSH": "WAS"}


def _f(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


async def season_averages(ttl=3600):
    """Per-player season averages (pts/reb/ast) plus double- and triple-double counts, from ESPN."""
    if _stats["rows"] and time.time() - _stats["t"] < ttl:
        return _stats
    params = {"region": "us", "lang": "en", "contentorigin": "espn", "isqualified": "false", "limit": 600,
              "sort": "offensive.avgPoints:desc", "seasontype": 2}
    try:
        async with httpx.AsyncClient(timeout=25) as client:
            r = await client.get(STATS_URL, params=params)
            r.raise_for_status()
            d = r.json()
    except httpx.HTTPError as e:
        logger.warning("ESPN season stats failed: %s", e)
        return _stats
    names = {c["name"]: c["names"] for c in d.get("categories", [])}
    rows = []
    for a in d.get("athletes", []):
        vals = {}
        for c in a.get("categories", []):
            vals.update(zip(names.get(c["name"], []), c.get("totals") or []))
        ath = a["athlete"]
        team = (ath.get("teamShortName") or "").upper()
        rows.append({
            "key": norm_name(ath.get("displayName")), "name": ath.get("displayName"), "team": _ABBR.get(team, team),
            "headshot": (ath.get("headshot") or {}).get("href"), "gp": int(_f(vals.get("gamesPlayed"))),
            "min": _f(vals.get("avgMinutes")), "pts": _f(vals.get("avgPoints")), "reb": _f(vals.get("avgRebounds")),
            "ast": _f(vals.get("avgAssists")), "dd": int(_f(vals.get("doubleDouble"))), "td": int(_f(vals.get("tripleDouble"))),
        })
    if rows:
        _stats.update(t=time.time(), rows=rows, season=(d.get("requestedSeason") or {}).get("displayName"))
    return _stats
