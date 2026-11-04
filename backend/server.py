from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import os
import asyncio
import time
import logging
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import kalshi  # noqa: E402
import optic  # noqa: E402
import kalshi_props  # noqa: E402
import espn  # noqa: E402
import kalshi_auth  # noqa: E402
import odds_api  # noqa: E402
import oddsblaze  # noqa: E402
import bets  # noqa: E402
import nhl  # noqa: E402

client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)


def _books(books: Optional[str]):
    return [b for b in (books.split(",") if books else optic.DEFAULT_BOOKS) if b in optic.ALL_BOOKS]


@api_router.get("/status")
async def status():
    return {"opticodds_key": bool(optic.api_key()), "kalshi_key": kalshi_auth.configured(), "books": optic.ALL_BOOKS, "default_books": optic.DEFAULT_BOOKS,
            "sgp_books": sorted(optic.SGP_BOOKS)}


@api_router.get("/games")
async def games():
    try:
        g = await kalshi.load_markets()
    except httpx.HTTPError as e:
        raise HTTPException(424, f"Kalshi unavailable: {e}")
    out = [{"code": x["code"], "date": x["date"], "teams": x["teams"], "label": x["label"],
            "players": sorted([{"key": k, "name": p["name"], "team": p["team"]} for k, p in x["players"].items()], key=lambda p: p["name"])}
           for x in g.values()]
    return sorted(out, key=lambda x: (x["date"], x["code"]))


async def _optic_context(c, game, books):
    fixture = await optic.find_fixture(c, game)
    if not fixture:
        return None, None, "No matching OpticOdds fixture found for this game yet"
    idx = optic.index_odds(await optic.fetch_odds(c, fixture["id"], books))
    return fixture, idx, None


@api_router.get("/scan")
async def scan(game: str, books: Optional[str] = Query(None)):
    games_map = await kalshi.load_markets()
    g = games_map.get(game)
    if not g:
        raise HTTPException(404, "Game not found on Kalshi")
    books_l = _books(books)
    rows = [{"key": k, "name": p["name"], "team": p["team"], "dd": p.get("dd"), "td": p.get("td"), "books": []}
            for k, p in g["players"].items()]
    resp = {"game": {k: g[k] for k in ("code", "date", "teams", "label")}, "rows": rows,
            "optic_status": "missing_key", "message": None, "fixture": None,
            "updated_at": datetime.now(timezone.utc).isoformat()}
    if not optic.api_key():
        return resp
    try:
        async with httpx.AsyncClient(timeout=25) as c:
            fixture, idx, msg = await _optic_context(c, g, books_l)
            resp["message"] = msg
            if fixture:
                resp["fixture"] = {"id": fixture["id"], "start_date": fixture["start_date"],
                                   "home": fixture.get("home_team_display"), "away": fixture.get("away_team_display")}
                sem = asyncio.Semaphore(8)

                async def run(row):
                    async with sem:
                        row["books"] = await optic.player_breakdown(c, fixture["id"], books_l, idx, row["key"])
                await asyncio.gather(*[run(r) for r in rows])
        resp["optic_status"] = "ok"
    except (optic.OpticError, httpx.HTTPError) as e:
        logger.exception("optic scan failed")
        resp["optic_status"] = "error"
        resp["message"] = str(e)
    return resp


class Leg(BaseModel):
    stat: str
    threshold: int


class ComboReq(BaseModel):
    game: str
    player: str
    legs: List[Leg]
    books: Optional[List[str]] = None


@api_router.post("/combo")
async def combo(req: ComboReq):
    if not optic.api_key():
        raise HTTPException(400, "OpticOdds API key not configured")
    if not req.legs or any(l.stat not in optic.STAT_MARKETS for l in req.legs):
        raise HTTPException(400, "Pick at least one valid leg (pts, reb, ast)")
    g = (await kalshi.load_markets()).get(req.game)
    if not g:
        raise HTTPException(404, "Game not found on Kalshi")
    books_l = [b for b in (req.books or optic.DEFAULT_BOOKS) if b in optic.ALL_BOOKS]
    try:
        async with httpx.AsyncClient(timeout=25) as c:
            fixture, idx, msg = await _optic_context(c, g, books_l)
            if not fixture:
                raise HTTPException(404, msg)
            res, err = await optic.combo_by_book(c, fixture["id"], books_l, idx, kalshi.norm_name(req.player),
                                                 [(l.stat, l.threshold) for l in req.legs])
    except (optic.OpticError, httpx.HTTPError) as e:
        raise HTTPException(424, str(e))
    if err:
        raise HTTPException(404, err)
    return {"books": [{"book": b, **v} for b, v in res.items()], "updated_at": datetime.now(timezone.utc).isoformat()}


@api_router.get("/props/games")
async def props_games():
    try:
        g = await kalshi_props.load_props()
    except httpx.HTTPError as e:
        raise HTTPException(424, f"Kalshi unavailable: {e}")
    out = [{"code": x["code"], "date": x["date"], "teams": x["teams"], "label": x["label"], "player_count": len(x["players"])}
           for x in g.values()]
    return sorted(out, key=lambda x: (x["date"], x["code"]))


@api_router.get("/props/players")
async def props_players():
    games = await kalshi_props.load_props()
    photos = await espn.headshots()
    return [{"key": p["key"], "name": p["name"], "team": p["team"], "game": g["code"], "game_label": g["label"],
             "headshot": (photos.get(p["key"]) or {}).get("headshot")}
            for g in games.values() for p in g["players"].values()]


_rfq_sem = asyncio.Semaphore(6)
_last_quote = {}

# Double-double paths and the triple-double combo. Points falls back to Kalshi's lowest line if 10+ isn't offered.
PAIRINGS = [
    ("PR", [("Points", None), ("Rebounds", 10)]),
    ("PA", [("Points", None), ("Assists", 10)]),
    ("RA", [("Rebounds", 10), ("Assists", 10)]),
    ("PRA", [("Points", None), ("Rebounds", 10), ("Assists", 10)]),
]


def _pick(markets, label, want):
    lines = [l for l in markets.get(label, []) if l["threshold"]]
    if not lines:
        return None
    if want is None:
        exact = [l for l in lines if l["threshold"] == 10]
        return exact[0] if exact else min(lines, key=lambda l: l["threshold"])
    return next((l for l in lines if l["threshold"] == want), None)


def _combos_for(p, td_pts=None):
    out = []
    for kind, pairing in PAIRINGS:
        legs = [_pick(p["markets"], lbl, want) for lbl, want in pairing]
        if None not in legs:
            out.append({"kind": kind, "name": " & ".join(f"{l['threshold']}+ {l['market']}" for l in legs), "legs": legs})
    if td_pts:
        legs = [_pick(p["markets"], "Points", td_pts), _pick(p["markets"], "Rebounds", 10), _pick(p["markets"], "Assists", 10)]
        pra = next((c for c in out if c["kind"] == "PRA"), None)
        if pra and None not in legs and [l["ticker"] for l in legs] == [l["ticker"] for l in pra["legs"]]:
            pra["also_td"] = True
        elif None not in legs:
            out.append({"kind": "TD", "name": " & ".join(f"{l['threshold']}+ {l['market']}" for l in legs), "legs": legs})
    return out


async def _quote(c):
    if not kalshi_auth.configured():
        return
    async with _rfq_sem:
        try:
            c["live"] = await kalshi_auth.live_combo_quote([l["ticker"] for l in c["legs"]], target_dollars=10)
            if (c["live"] or {}).get("yes_price"):
                _last_quote[frozenset(l["ticker"] for l in c["legs"])] = c["live"]
        except (kalshi_auth.KalshiAuthError, httpx.HTTPError) as e:
            c["error"] = str(e)[:160]


def _built_dd(combos):
    """P(any of the pair DDs) = sum(pairs) - (k-1) * P(all three), since every pair overlap is the triple."""
    price = lambda c: (c.get("live") or {}).get("yes_price")
    pairs = [price(c) for c in combos if c["kind"] in ("PR", "PA", "RA") and price(c)]
    tri = next((price(c) for c in combos if c["kind"] == "PRA" and price(c)), None)
    if not pairs:
        return None
    if tri is not None:
        return {"price": round(min(sum(pairs) - (len(pairs) - 1) * tri, 0.99), 4), "exact": True, "paths": len(pairs)}
    return {"price": max(pairs), "exact": len(pairs) == 1, "paths": len(pairs)}


def _player_payload(p, photos, combos):
    return {"key": p["key"], "name": p["name"], "team": p["team"], "headshot": (photos.get(p["key"]) or {}).get("headshot"),
            "singles": [{"name": lbl, "line": p["markets"][lbl][0]} for lbl in ("Double Double", "Triple Double") if lbl in p["markets"]],
            "combos": combos, "built_dd": _built_dd(combos)}


@api_router.get("/tdwatch")
async def td_watch(limit: int = Query(40, ge=5, le=200)):
    stats = await espn.season_averages()
    inj = await espn.injuries()
    games = await kalshi_props.load_props()
    tonight = {}
    for g in games.values():
        away, home = g["code"][-6:-3], g["code"][-3:]
        tonight[away], tonight[home] = home, away
    rows = [dict(r, opp=tonight.get(r["team"]), score=round(min(r["pts"], r["reb"], r["ast"]), 1), injury=inj.get(r["key"]))
            for r in stats["rows"] if r["gp"] > 0 and r["min"] >= 15]
    rows.sort(key=lambda r: (-r["score"], -(r["pts"] + r["reb"] + r["ast"])))
    return {"season": stats["season"], "players": rows[:limit], "updated_at": datetime.fromtimestamp(stats["t"], timezone.utc).isoformat() if stats["t"] else None}


@api_router.get("/scanner/games")
async def scanner_games():
    """Every game today/tomorrow (ET) from the sportsbook schedule, merged with whatever Kalshi has open."""
    try:
        kal = await kalshi_props.load_props()
    except httpx.HTTPError:
        kal = {}
    try:
        sched = await odds_api.schedule()
    except httpx.HTTPError as e:
        logger.warning("Odds API schedule failed: %s", e)
        sched = []
    out = {s["code"]: {**s, "kalshi": s["code"] in kal} for s in sched}
    for x in kal.values():
        out.setdefault(x["code"], {"code": x["code"], "date": x["date"], "teams": x["teams"], "label": x["label"], "start": None})["kalshi"] = True
    return sorted(out.values(), key=lambda x: (x["date"], x["start"] or "", x["code"]))


@api_router.get("/live-tracker")
async def live_tracker(date: Optional[str] = Query(None, pattern=r"^\d{8}$"), include_final: bool = False):
    try:
        d = await espn.live_tracker(date, include_final)
    except httpx.HTTPError as e:
        raise HTTPException(424, f"ESPN unavailable: {e}")
    return {**d, "updated_at": datetime.now(timezone.utc).isoformat()}


@api_router.get("/scanner/board")
async def scanner_board(td_pts: Optional[int] = Query(None, ge=5, le=40), ra: Optional[int] = Query(None, ge=3, le=15), live: bool = False,
                        game: Optional[str] = Query(None, pattern=r"^[0-9A-Z]{10,14}$")):
    """Every Kalshi game's triple-double combos (or reb+ast combos when ra is set), with book odds and exact-leg SGP prices.
    live=true: only games in progress, live SGP prices, current box-score stats, combos already hit hidden."""
    if not td_pts and not ra:
        td_pts = 10
    reb_ast = ra or 10
    t0 = time.monotonic()
    games = await kalshi_props.load_props()
    if game:
        games = {c: g for c, g in games.items() if c == game}
    boxes = {}
    if live:
        res = await asyncio.gather(*[espn.game_box(g["date"].replace("-", ""), c[-6:-3], c[-3:]) for c, g in games.items()], return_exceptions=True)
        boxes = {c: b for c, b in zip(games, res) if isinstance(b, dict) and b["state"] == "in"}
        games = {c: g for c, g in games.items() if c in boxes}
    photos = await espn.headshots()
    books = await asyncio.gather(*[odds_api.triple_double_odds(c[-6:-3], c[-3:]) for c in games]) if td_pts == 10 and reb_ast == 10 and not live else [({}, None)] * len(games)
    todo = []
    for g, (bk, _) in zip(games.values(), books):
        for p in g["players"].values():
            odds = (bk.get(p["key"]) or {}).get("odds") or {}
            legs = [_pick(p["markets"], "Rebounds", reb_ast), _pick(p["markets"], "Assists", reb_ast)]
            if td_pts:
                legs.insert(0, _pick(p["markets"], "Points", td_pts) or min(
                    (l for l in p["markets"].get("Points", []) if (l["threshold"] or 0) > td_pts), key=lambda l: l["threshold"], default=None))
            if None in legs:
                continue
            c = {"kind": "TD" if td_pts else "RA", "name": " & ".join(f"{l['threshold']}+ {l['market']}" for l in legs), "legs": legs}
            if live:
                stats = boxes[g["code"]]["players"].get(p["key"])
                if not stats or all(stats[l["market"]] >= l["threshold"] for l in legs):
                    continue
                c["now"] = {"clock": boxes[g["code"]]["clock"], **{k: stats[k] for k in ("Points", "Rebounds", "Assists")}}
            todo.append((g, p, c, odds))
    quotes = {id(c): asyncio.create_task(_quote(c)) for _, _, c, _ in todo}  # Kalshi quotes run alongside SGP pricing
    sgps = await oddsblaze.sgp_prices([(g["code"][-6:-3], g["code"][-3:], [(p["key"], l["market"], l["threshold"]) for l in c["legs"]])
                                       for g, p, c, _ in todo], timeout=max(8, min(25, 40 - (time.monotonic() - t0))), live=live)
    todo = [(g, p, c, odds, s) for (g, p, c, odds), s in zip(todo, sgps)
            if s or (odds and td_pts == 10 and reb_ast == 10 and c["legs"][0]["threshold"] == 10)]
    keep = {id(c) for _, _, c, _, _ in todo}
    for k, t in quotes.items():
        if k not in keep:
            t.cancel()
    tasks = [quotes[id(c)] for _, _, c, _, _ in todo]
    if tasks:  # stay under the 60s proxy limit; combos still quoting fall back to their last Kalshi quote
        _, late = await asyncio.wait(tasks, timeout=max(8, 50 - (time.monotonic() - t0)))
        for t in late:
            t.cancel()
    for _, _, c, _, _ in todo:
        if not (c.get("live") or {}).get("yes_price"):
            c["live"] = _last_quote.get(frozenset(l["ticker"] for l in c["legs"])) or c.get("live")
    players = [{**_player_payload(p, photos, [c]), "books": odds, "sgp": s, "game": {k: g[k] for k in ("code", "date", "label")}}
               for g, p, c, odds, s in todo if (c.get("live") or {}).get("yes_price")]
    return {"players": players, "games": len(games),
            "books": {"enabled": odds_api.configured(), "credits_left": odds_api.quota["remaining"], "sgp": oddsblaze.configured(),
                      "sgp_key_rejected": oddsblaze.status["key_rejected"], "sgp_pending": oddsblaze.status.get("sgp_pending", 0)},
            "updated_at": datetime.now(timezone.utc).isoformat()}


@api_router.get("/scanner/game/{code}")
async def scanner_game(code: str, td_pts: int = Query(10, ge=10, le=40)):
    info = kalshi.parse_game_code(code)
    if not info:
        raise HTTPException(404, "Unknown game")
    g = (await kalshi_props.load_props()).get(code) or {"code": code, **info, "label": " vs ".join(info["teams"]), "players": {}}
    photos = await espn.headshots()
    todo = []
    for p in g["players"].values():
        pts = _pick(p["markets"], "Points", td_pts) or min(
            (l for l in p["markets"].get("Points", []) if (l["threshold"] or 0) > td_pts), key=lambda l: l["threshold"], default=None)
        legs = [pts, _pick(p["markets"], "Rebounds", 10), _pick(p["markets"], "Assists", 10)]
        if None not in legs:
            todo.append((p, [{"kind": "TD", "name": " & ".join(f"{l['threshold']}+ {l['market']}" for l in legs), "legs": legs}]))
    await asyncio.gather(*[_quote(c) for _, cs in todo for c in cs])
    players = [_player_payload(p, photos, cs) for p, cs in todo]
    books, books_updated = await odds_api.triple_double_odds(code[-6:-3], code[-3:]) if td_pts == 10 else ({}, None)
    for pl in players:
        pl["books"] = (books.get(pl["key"]) or {}).get("odds") or {}
    players.sort(key=lambda x: -((x["combos"][0].get("live") or {}).get("yes_price") or 0))
    # Players with sportsbook triple-double odds but no Kalshi combo still get a row (no Kalshi price, no EV).
    have = {pl["key"] for pl in players}
    team_of = {k: p["team"] for k, p in g["players"].items()}
    team_of.update({r["key"]: r["team"] for r in (await espn.season_averages())["rows"] if r["key"] not in team_of})
    extra = [{"key": k, "name": b["name"], "team": team_of.get(k, ""), "headshot": (photos.get(k) or {}).get("headshot"),
              "singles": [], "combos": [], "built_dd": None, "books": b["odds"]} for k, b in books.items() if k not in have]
    extra.sort(key=lambda x: min((v for v in x["books"].values() if v is not None), default=float("inf")))
    players += extra
    return {"game": {k: g[k] for k in ("code", "date", "label")}, "players": players,
            "books": {"enabled": odds_api.configured(), "updated": books_updated, "credits_left": odds_api.quota["remaining"]},
            "updated_at": datetime.now(timezone.utc).isoformat()}


@api_router.get("/scanner/player")
async def scanner_player(game: str, player: str):
    g = (await kalshi_props.load_props()).get(game)
    p = g and g["players"].get(player)
    if not p:
        raise HTTPException(404, "Player not found on Kalshi")
    photos = await espn.headshots()
    combos = _combos_for(p)
    await asyncio.gather(*[_quote(c) for c in combos])
    pl = _player_payload(p, photos, combos)
    return {"game": {k: g[k] for k in ("code", "date", "label")}, "player": pl, "singles": pl["singles"], "combos": combos,
            "updated_at": datetime.now(timezone.utc).isoformat()}


@api_router.get("/props/game/{code}")
async def props_game(code: str):
    g = (await kalshi_props.load_props()).get(code)
    if not g:
        raise HTTPException(404, "Game not found on Kalshi")
    players = []
    photos = await espn.headshots()
    for p in g["players"].values():
        markets = [{"label": lbl, "lines": p["markets"][lbl]} for lbl in kalshi_props.ORDER if lbl in p["markets"]]
        players.append({"key": p["key"], "name": p["name"], "team": p["team"], "markets": markets,
                        "headshot": (photos.get(p["key"]) or {}).get("headshot"),
                        "line_count": sum(len(m["lines"]) for m in markets)})
    players.sort(key=lambda p: -p["line_count"])
    return {"game": {k: g[k] for k in ("code", "date", "teams", "label")}, "players": players,
            "updated_at": datetime.now(timezone.utc).isoformat()}


class FillLeg(BaseModel):
    market: str
    threshold: Optional[float] = None


class FillItem(BaseModel):
    code: str
    player: str
    legs: list[FillLeg]


class FillReq(BaseModel):
    items: list[FillItem]
    live: bool = False


@api_router.post("/scanner/sgp-fill")
async def scanner_sgp_fill(req: FillReq):
    """Re-price only the combos already on the board (no new Kalshi scan)."""
    sgps = await oddsblaze.sgp_prices([(i.code[-6:-3], i.code[-3:], [(i.player, l.market, l.threshold) for l in i.legs])
                                       for i in req.items[:200]], timeout=40, live=req.live)
    return {"sgp": sgps, "pending": oddsblaze.status.get("sgp_pending", 0)}


class SlipReq(BaseModel):
    tickers: List[str]


@api_router.post("/props/slip")
async def props_slip(req: SlipReq):
    games = await kalshi_props.load_props()
    by_ticker = {l["ticker"]: {**l, "player": p["name"], "team": p["team"]}
                 for g in games.values() for p in g["players"].values() for lines in p["markets"].values() for l in lines}
    legs = [by_ticker.get(t) for t in req.tickers]
    return {"legs": legs, "combo": kalshi_props.find_combo(req.tickers) if len(req.tickers) > 1 else None,
            "combo_index": kalshi_props.combo_index_info(), "updated_at": datetime.now(timezone.utc).isoformat()}


@api_router.get("/hockey/board")
async def hockey_board():
    d = await nhl.board()
    return {**d, "updated_at": datetime.now(timezone.utc).isoformat()}


@api_router.post("/props/sgp")
async def props_sgp(req: SlipReq):
    """Sportsbook SGP prices (OddsBlaze) for the exact legs on the slip; all legs must be from one game."""
    games = await kalshi_props.load_props()
    by_ticker = {l["ticker"]: (g["code"], p["key"], l["market"], l["threshold"])
                 for g in games.values() for p in g["players"].values() for lines in p["markets"].values() for l in lines}
    legs = [by_ticker.get(t) for t in req.tickers]
    if len(legs) < 2 or None in legs or len({x[0] for x in legs}) > 1:
        return {"prices": {}, "configured": oddsblaze.configured()}
    code = legs[0][0]
    prices = (await oddsblaze.sgp_prices([(code[-6:-3], code[-3:], [x[1:] for x in legs])], books={"dk", "fan"}))[0]
    return {"prices": prices, "configured": oddsblaze.configured(), "updated_at": datetime.now(timezone.utc).isoformat()}


@app.on_event("startup")
async def start_combo_scanner():
    asyncio.create_task(kalshi_props.combo_loop())


class QuoteReq(BaseModel):
    tickers: List[str]
    target_dollars: Optional[float] = None


@api_router.get("/props/orderbook/{ticker}")
async def props_orderbook(ticker: str):
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(f"{kalshi.KALSHI_BASE}/markets/{ticker}/orderbook", params={"depth": 15})
    if r.status_code >= 400:
        raise HTTPException(424, f"Kalshi orderbook unavailable ({r.status_code})")
    ob = r.json().get("orderbook_fp") or {}
    # Buying YES fills against resting NO bids at (1 - no price).
    asks = [{"price": round(1 - float(p), 4), "contracts": float(q)} for p, q in reversed(ob.get("no_dollars") or [])]
    bids = [{"price": float(p), "contracts": float(q)} for p, q in reversed(ob.get("yes_dollars") or [])]
    return {"ticker": ticker, "yes_asks": asks, "yes_bids": bids}


@api_router.post("/props/kalshi-quote")
async def props_kalshi_quote(req: QuoteReq):
    if not kalshi_auth.configured():
        raise HTTPException(400, "Kalshi API key not connected")
    if len(req.tickers) < 2:
        raise HTTPException(400, "Pick at least 2 legs")
    try:
        return await kalshi_auth.live_combo_quote(req.tickers, target_dollars=req.target_dollars)
    except kalshi_auth.KalshiAuthError as e:
        raise HTTPException(424, str(e))
    except httpx.HTTPError as e:
        raise HTTPException(424, f"Kalshi unavailable: {e}")


api_router.include_router(bets.make_router(db))
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logging.getLogger("httpx").setLevel(logging.WARNING)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
