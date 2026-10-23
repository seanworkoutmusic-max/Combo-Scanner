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
import logging
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import kalshi  # noqa: E402
import optic  # noqa: E402
import kalshi_props  # noqa: E402
import espn  # noqa: E402
import kalshi_auth  # noqa: E402

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


@app.on_event("startup")
async def start_combo_scanner():
    asyncio.create_task(kalshi_props.combo_loop())


class QuoteReq(BaseModel):
    tickers: List[str]


@api_router.post("/props/kalshi-quote")
async def props_kalshi_quote(req: QuoteReq):
    if not kalshi_auth.configured():
        raise HTTPException(400, "Kalshi API key not connected")
    if len(req.tickers) < 2:
        raise HTTPException(400, "Pick at least 2 legs")
    try:
        return await kalshi_auth.live_combo_quote(req.tickers)
    except kalshi_auth.KalshiAuthError as e:
        raise HTTPException(424, str(e))
    except httpx.HTTPError as e:
        raise HTTPException(424, f"Kalshi unavailable: {e}")


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
