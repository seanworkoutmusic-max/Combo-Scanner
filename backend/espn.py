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


INJ_URL = f"{ESPN}/injuries"
_inj = {"t": 0, "map": {}}


async def injuries(ttl=900):
    """norm_name -> {label: OUT|Q, status, comment} from ESPN's injury report."""
    if _inj["t"] and time.time() - _inj["t"] < ttl:
        return _inj["map"]
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(INJ_URL)
            r.raise_for_status()
            teams = r.json().get("injuries", [])
    except httpx.HTTPError as e:
        logger.warning("ESPN injuries failed: %s", e)
        return _inj["map"]
    out = {}
    for t in teams:
        for i in t.get("injuries", []):
            status = i.get("status") or ""
            out[norm_name(i["athlete"].get("displayName"))] = {
                "label": "OUT" if status.lower().startswith("out") else "Q",
                "status": status, "comment": i.get("shortComment") or "",
            }
    _inj.update(t=time.time(), map=out)
    return out


SCOREBOARD = f"{ESPN}/scoreboard"
_live = {}


async def _box(client, event_id):
    r = await client.get(f"{ESPN}/summary", params={"event": event_id})
    r.raise_for_status()
    return r.json().get("boxscore", {}).get("players", [])


async def live_tracker(date=None, include_final=False, ttl=15):
    """Box-score lines for every player in games currently in progress (ESPN), ranked by stats needed for 10/10/10."""
    key = (date, include_final)
    hit = _live.get(key)
    if hit and time.time() - hit["t"] < ttl:
        return hit["data"]
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(SCOREBOARD, params={"dates": date} if date else {})
        r.raise_for_status()
        events = r.json().get("events", [])
        states = ("in", "post") if include_final else ("in",)
        live = [e for e in events if e["status"]["type"]["state"] in states]
        boxes = await asyncio.gather(*[_box(client, e["id"]) for e in live], return_exceptions=True)
    games, rows = [], []
    for e, box in zip(live, boxes):
        comp = {c["homeAway"]: c for c in e["competitions"][0]["competitors"]}
        ab = {k: _ABBR.get(c["team"]["abbreviation"], c["team"]["abbreviation"]) for k, c in comp.items()}
        g = {"id": e["id"], "away": ab["away"], "home": ab["home"], "away_score": comp["away"].get("score"),
             "home_score": comp["home"].get("score"), "clock": e["status"]["type"]["shortDetail"]}
        games.append(g)
        if isinstance(box, Exception):
            logger.warning("ESPN box score %s failed: %s", e["id"], box)
            continue
        for t in box:
            team = _ABBR.get(t["team"]["abbreviation"], t["team"]["abbreviation"])
            st = (t.get("statistics") or [{}])[0]
            idx = {k: i for i, k in enumerate(st.get("keys", []))}
            for a in st.get("athletes", []):
                s = a.get("stats") or []
                if a.get("didNotPlay") or not s:
                    continue
                val = lambda k: int(_f(s[idx[k]])) if k in idx and idx[k] < len(s) else 0
                pts, reb, ast = val("points"), val("rebounds"), val("assists")
                ath = a["athlete"]
                rows.append({"key": norm_name(ath["displayName"]), "name": ath["displayName"], "team": team,
                             "opp": g["home"] if team == g["away"] else g["away"], "game": g["id"],
                             "headshot": (ath.get("headshot") or {}).get("href"), "on_court": bool(a.get("active")),
                             "min": val("minutes"), "pts": pts, "reb": reb, "ast": ast, "pf": val("fouls"),
                             "need": sum(max(0, 10 - x) for x in (pts, reb, ast))})
    rows.sort(key=lambda x: (x["need"], -(x["pts"] + x["reb"] + x["ast"])))
    upcoming = [e["date"] for e in events if e["status"]["type"]["state"] == "pre"]
    data = {"games": games, "players": rows, "next_tip": min(upcoming) if upcoming else None}
    _live[key] = {"t": time.time(), "data": data}
    return data
