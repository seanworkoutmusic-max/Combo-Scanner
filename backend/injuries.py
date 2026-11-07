import asyncio
import logging
import re
import time
from datetime import datetime, timedelta, timezone

import httpx

from espn import ESPN, _ABBR, season_averages
from kalshi import norm_name

logger = logging.getLogger(__name__)
POSITIONS = ["pg", "sg", "sf", "pf", "c"]
MAX_RETURN_DAYS = 3  # hide players whose est. return is further out than this
KEY_MINUTES = 24  # season minutes for a non-starter on the depth chart to count as a key player
_cache = {"t": 0, "data": None}


def _athlete_id(a):
    for link in a.get("links") or []:
        m = re.search(r"/id/(\d+)", link.get("href", ""))
        if m:
            return m.group(1)
    return None


async def _depth(client, team_id):
    r = await client.get(f"{ESPN}/teams/{team_id}/depthcharts")
    r.raise_for_status()
    charts = r.json().get("depthchart") or [{}]
    return {p: [{"id": a["id"], "name": a["displayName"]} for a in v.get("athletes", [])]
            for p, v in (charts[0].get("positions") or {}).items()}


def _next_up(chart, out_keys, name, starter=False):
    """Depth position of an injured player and the first healthy player behind him (or ahead, for a starter ESPN moved down)."""
    for pos in POSITIONS:
        names = [a["name"] for a in chart.get(pos, [])]
        if name in names:
            i = names.index(name)
            rest = [n for n in names if n != name] if starter else names[i + 1:]
            nxt = next((n for n in rest if norm_name(n) not in out_keys), None)
            return pos.upper(), 1 if starter else i + 1, nxt
    return None, None, None


def _headshot(aid):
    return aid and f"https://a.espncdn.com/i/headshots/nba/players/full/{aid}.png"


def _lineup(chart, out_keys, injured, stats):
    """Projected starting five with the injured player out, plus an estimated usage bump for each starter."""
    lineup, used = [], {norm_name(injured)}
    for pos in POSITIONS:
        names = chart.get(pos, [])
        a = next((c for c in names if norm_name(c["name"]) not in out_keys | used), None)
        if not a:
            continue
        used.add(norm_name(a["name"]))
        st = stats.get(norm_name(a["name"])) or {}
        new = bool(names) and a["name"] != names[0]["name"]
        lineup.append({"pos": pos.upper(), "name": a["name"], "key": norm_name(a["name"]), "headshot": _headshot(a["id"]), "new": new,
                       "pts": st.get("pts", 0), "reb": st.get("reb", 0), "ast": st.get("ast", 0), "min": st.get("min", 0)})
    inj = stats.get(norm_name(injured)) or {}
    pool = inj.get("pts", 0) or 0
    rest = [p for p in lineup if not p["new"]]
    share = 0.65 if len(rest) < len(lineup) else 1
    tot = sum(p["pts"] ** 2 for p in rest) or 1
    for p in lineup:
        if p["new"]:  # steps into the injured starter's minutes
            p["bump"] = round(min(max((inj.get("min") or 30) / max(p["min"], 12) - 1, 0.1), 1), 3)
        else:  # bigger usage share absorbs more of the injured starter's shots
            p["bump"] = round(min(pool * share * p["pts"] / tot, 1), 3)
    return lineup


async def slate(ttl=600):
    """Tonight's games with every injured player, his depth chart spot and who is next up."""
    if _cache["data"] and time.time() - _cache["t"] < ttl:
        return _cache["data"]
    async with httpx.AsyncClient(timeout=20) as client:
        sb, inj = await asyncio.gather(client.get(f"{ESPN}/scoreboard"), client.get(f"{ESPN}/injuries"))
        sb.raise_for_status()
        inj.raise_for_status()
        games, teams = [], {}
        for e in sb.json().get("events", []):
            comp = {c["homeAway"]: c["team"] for c in e["competitions"][0]["competitors"]}
            g = {"away": _ABBR.get(comp["away"]["abbreviation"], comp["away"]["abbreviation"]),
                 "home": _ABBR.get(comp["home"]["abbreviation"], comp["home"]["abbreviation"]), "start": e["date"],
                 "state": e["status"]["type"]["state"], "rows": []}
            games.append(g)
            for side in ("away", "home"):
                teams[comp[side]["id"]] = (g, g[side])
        ids = list(teams)
        charts = dict(zip(ids, await asyncio.gather(*(_depth(client, t) for t in ids), return_exceptions=True)))
    stats = {r["key"]: r for r in (await season_averages())["rows"]}
    cutoff = (datetime.now(timezone(timedelta(hours=-5))) + timedelta(days=MAX_RETURN_DAYS)).strftime("%Y-%m-%d")
    for t in inj.json().get("injuries", []):
        if t["id"] not in teams:
            continue
        g, abbr = teams[t["id"]]
        chart = charts[t["id"]] if isinstance(charts[t["id"]], dict) else {}
        starters = {norm_name(v[0]["name"]) for v in chart.values() if v}
        out_keys = {norm_name(i["athlete"]["displayName"]) for i in t.get("injuries", []) if (i.get("status") or "").lower() in ("out", "doubtful")}
        for i in t.get("injuries", []):
            a, status = i["athlete"], i.get("status") or ""
            key = norm_name(a["displayName"])
            starter = key in starters or (stats.get(key) or {}).get("min", 0) >= KEY_MINUTES
            ret = (i.get("details") or {}).get("returnDate")
            if not starter or (ret and ret > cutoff):
                continue  # key starters back within a few days only
            pos, depth, nxt = _next_up(chart, out_keys, a["displayName"], starter=True)
            sitting = status.lower() in ("out", "doubtful")
            d = i.get("details") or {}
            aid = _athlete_id(a)
            others = out_keys - {key} if not sitting else out_keys
            g["rows"].append({
                "name": a["displayName"], "team": abbr, "pos": pos or (a.get("position") or {}).get("abbreviation"), "depth": depth,
                "headshot": (a.get("headshot") or {}).get("href") or _headshot(aid), "lineup": _lineup(chart, others, a["displayName"], stats),
                "status": status, "injury": " ".join(x for x in (d.get("side") if d.get("side") not in (None, "Not Specified") else None, d.get("type")) if x) or "—",
                "return": d.get("returnDate"), "comment": i.get("shortComment") or "", "next_up": nxt,
                "tag": None if not nxt else ("Starts" if depth == 1 and sitting else "If out" if depth == 1 else "More minutes"),
                "chart": [{"depth": k + 1, "name": n, "out": norm_name(n) in out_keys} for k, n in enumerate(
                    [a["displayName"]] + [c["name"] for c in chart.get((pos or "").lower(), []) if c["name"] != a["displayName"]])],
            })
        g["rows"].sort(key=lambda r: (r["depth"] or 9, r["name"]))
    data = {"games": games, "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    _cache.update(t=time.time(), data=data)
    return data
