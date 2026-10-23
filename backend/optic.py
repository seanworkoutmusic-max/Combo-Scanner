import os
import time
import asyncio
from datetime import date, datetime, timedelta
from itertools import combinations
import httpx
from devig import american_to_prob, devig_pair, METHODS
from kalshi import TEAMS, norm_name

BASE = "https://api.opticodds.com/api/v3"
SGP_BOOKS = {"DraftKings", "BetMGM", "Caesars", "Fanatics", "BetRivers", "Unibet", "Novig", "Prophet X"}
ALL_BOOKS = ["DraftKings", "FanDuel", "BetMGM", "Caesars", "Fanatics", "BetRivers"]
DEFAULT_BOOKS = ["DraftKings", "FanDuel", "BetMGM", "Caesars", "Fanatics"]
STAT_MARKETS = {"pts": "Player Points", "reb": "Player Rebounds", "ast": "Player Assists"}
DIRECT_MARKETS = {"dd": "Player Double Double", "td": "Player Triple Double"}
_cache = {}


class OpticError(Exception):
    pass


def api_key():
    return os.environ.get("OPTICODDS_API_KEY", "").strip()


def _cached(key, ttl):
    v = _cache.get(key)
    return v[1] if v and time.time() - v[0] < ttl else None


async def _get(client, path, params):
    r = await client.get(f"{BASE}{path}", params=params, headers={"X-Api-Key": api_key()})
    if r.status_code >= 400:
        raise OpticError(f"OpticOdds {path} {r.status_code}: {r.text[:200]}")
    return r.json()


async def find_fixture(client, game):
    key = ("fixtures",)
    fixtures = _cached(key, 300)
    if fixtures is None:
        fixtures, page = [], 1
        while page <= 10:
            d = await _get(client, "/fixtures/active", {"league": "NBA", "page": page})
            fixtures += d.get("data", [])
            if not d.get("has_more"):
                break
            page += 1
        _cache[key] = (time.time(), fixtures)
    nicks = [TEAMS.get(t, t).lower() for t in game["teams"]]
    gd = date.fromisoformat(game["date"])
    for f in fixtures:
        names = " ".join(c["name"].lower() for c in f["home_competitors"] + f["away_competitors"])
        start = datetime.fromisoformat(f["start_date"].replace("Z", "+00:00")).date()
        if all(n in names for n in nicks) and abs((start - gd).days) <= 1:
            return f
    return None


async def fetch_odds(client, fixture_id, books):
    markets = list(STAT_MARKETS.values()) + list(DIRECT_MARKETS.values())
    odds = []
    for i in range(0, len(books), 5):
        params = [("fixture_id", fixture_id)] + [("sportsbook", b) for b in books[i:i + 5]] + [("market", m) for m in markets]
        d = await _get(client, "/fixtures/odds", params)
        for fx in d.get("data", []):
            odds += fx.get("odds", [])
    return odds


def _side(o):
    sl = (o.get("selection_line") or "").lower()
    if sl:
        return sl
    last = (o.get("name") or "").strip().split(" ")[-1].lower()
    return last if last in ("yes", "no", "over", "under") else ""


def index_odds(odds):
    """idx[book][player_norm] = {'legs': {(stat, line): {over, under, over_name, market}}, 'direct': {dd: {yes, no}}}"""
    stat_by_market = {v: k for k, v in STAT_MARKETS.items()}
    direct_by_market = {v: k for k, v in DIRECT_MARKETS.items()}
    idx = {}
    for o in odds:
        player = norm_name(o.get("selection") or "")
        if not player:
            continue
        side = _side(o)
        entry = idx.setdefault(o["sportsbook"], {}).setdefault(player, {"legs": {}, "direct": {}})
        if o["market"] in stat_by_market and o.get("points") is not None:
            leg = entry["legs"].setdefault((stat_by_market[o["market"]], float(o["points"])), {"market": o["market"]})
            if side in ("over", "under"):
                leg[side] = o["price"]
                leg[f"{side}_name"] = o["name"]
        elif o["market"] in direct_by_market and side in ("yes", "no", "over", "under"):
            d = entry["direct"].setdefault(direct_by_market[o["market"]], {})
            d["yes" if side in ("yes", "over") else "no"] = o["price"]
    return idx


async def price_sgp(client, fixture_id, books, legs):
    books = [b for b in books if b in SGP_BOOKS]
    if not books:
        return {}
    key = ("sgp", fixture_id, tuple(books), tuple(l["name"] for l in legs))
    hit = _cached(key, 45)
    if hit is not None:
        return hit
    body = {"sportsbooks": books, "entries": [{"fixture_id": fixture_id, "market": l["market"], "name": l["name"]} for l in legs]}
    r = await client.post(f"{BASE}/parlay/odds", json=body, headers={"X-Api-Key": api_key()})
    out = {}
    if r.status_code < 400:
        for book, res in (r.json().get("data") or {}).items():
            if not res.get("error") and res.get("price") is not None:
                out[book] = res["price"]
    _cache[key] = (time.time(), out)
    return out


def _leg_fair(leg):
    if leg.get("over") is None:
        return None
    po = american_to_prob(leg["over"])
    if leg.get("under") is None:
        return None
    return {"imp": po, **devig_pair(po, american_to_prob(leg["under"]))}


def _first_name_map(idx, player):
    """Collect leg definitions (market + selection name) across books for a player."""
    defs = {}
    for book, players in idx.items():
        for (stat, line), leg in players.get(player, {}).get("legs", {}).items():
            if leg.get("over_name"):
                defs.setdefault((stat, line), {"market": leg["market"], "name": leg["over_name"]})
    return defs


async def combo_by_book(client, fixture_id, books, idx, player, legs_req):
    """legs_req: list of (stat, threshold). Returns per-book fair probs per method using SGP correlation."""
    defs = _first_name_map(idx, player)
    legs = []
    for stat, thr in legs_req:
        d = defs.get((stat, float(thr) - 0.5))
        if not d:
            return {}, f"No {stat} {thr}+ line found"
        legs.append((stat, float(thr) - 0.5, d))
    prices = await price_sgp(client, fixture_id, books, [d for _, _, d in legs])
    out = {}
    for book, sgp_price in prices.items():
        bleg = idx.get(book, {}).get(player, {}).get("legs", {})
        fairs = [_leg_fair(bleg.get((s, ln), {})) for s, ln, _ in legs]
        sgp_imp = american_to_prob(sgp_price)
        row = {"sgp_price": sgp_price, "sgp_imp": sgp_imp,
               "legs": [{"stat": s, "line": ln, "over": bleg.get((s, ln), {}).get("over"), "under": bleg.get((s, ln), {}).get("under")} for s, ln, _ in legs]}
        if all(fairs):
            imp_prod, corr = 1.0, None
            for f in fairs:
                imp_prod *= f["imp"]
            corr = sgp_imp / imp_prod
            row["corr"] = corr
            for m in METHODS:
                p = corr
                for f in fairs:
                    p *= f[m]
                row[m] = min(p, min(f[m] for f in fairs))
        out[book] = row
    return out, None


async def player_breakdown(client, fixture_id, books, idx, player):
    """Per-book DD/TD fair values from SGP (inclusion-exclusion) and direct markets."""
    stats = ["pts", "reb", "ast"]
    pair_res = {}
    combos = [tuple(c) for c in combinations(stats, 2)] + [tuple(stats)]
    results = await asyncio.gather(*[combo_by_book(client, fixture_id, books, idx, player, [(s, 10) for s in c]) for c in combos])
    for c, (res, _) in zip(combos, results):
        pair_res["+".join(c)] = res
    triple = pair_res["pts+reb+ast"]
    pairs = [pair_res[k] for k in ("pts+reb", "pts+ast", "reb+ast")]
    per_book = {}
    for book in books:
        b = {"book": book, "sgp_prices": {k: v.get(book, {}).get("sgp_price") for k, v in pair_res.items()}, "dd": {}, "td": {}}
        t = triple.get(book, {})
        if all(m in t for m in METHODS):
            b["td"]["sgp"] = {m: t[m] for m in METHODS}
            if all(all(m in p.get(book, {}) for m in METHODS) for p in pairs):
                b["dd"]["sgp"] = {m: min(max(sum(p[book][m] for p in pairs) - 2 * t[m], t[m]), 0.9999) for m in METHODS}
        direct = idx.get(book, {}).get(player, {}).get("direct", {})
        for kind in ("dd", "td"):
            d = direct.get(kind, {})
            if d.get("yes") is not None and d.get("no") is not None:
                b[kind]["direct"] = devig_pair(american_to_prob(d["yes"]), american_to_prob(d["no"]))
                b[kind]["direct_prices"] = d
        legs = idx.get(book, {}).get(player, {}).get("legs", {})
        b["legs"] = {s: legs.get((s, 9.5), {}).get("over") for s in stats}
        b["legs_under"] = {s: legs.get((s, 9.5), {}).get("under") for s in stats}
        if b["dd"] or b["td"]:
            per_book[book] = b
    return list(per_book.values())
