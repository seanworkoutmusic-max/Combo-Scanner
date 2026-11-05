from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from typing import Annotated, Dict, List, Literal, Optional
from bson import ObjectId
import logging
import httpx
from fastapi import APIRouter, HTTPException
import espn
import kalshi
from kalshi import norm_name

logger = logging.getLogger(__name__)
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field

ET = ZoneInfo("America/New_York")

PyObjectId = Annotated[str, BeforeValidator(str)]
Status = Literal["pending", "won", "lost", "void"]


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: Optional[PyObjectId] = Field(default=None, alias="_id")

    @classmethod
    def from_mongo(cls, doc):
        return cls.model_validate(doc)

    def to_mongo(self):
        d = self.model_dump(by_alias=True)
        d.pop("_id", None)
        return d


class BetLeg(BaseModel):
    ticker: str
    market: str
    threshold: Optional[float] = None


class BetIn(BaseModel):
    player: str
    team: str = ""
    headshot: Optional[str] = None
    game_code: str
    game_label: str = ""
    combo: str
    legs: List[BetLeg]
    price: float = Field(gt=0, lt=1)
    books: Dict[str, Optional[int]] = {}
    ev: Optional[float] = None
    stake: float = Field(gt=0, le=100000)


class Bet(BaseDocument, BetIn):
    status: Status = "pending"
    auto_graded: bool = False
    result_stats: Optional[Dict[str, float]] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class StatusIn(BaseModel):
    status: Status


def make_router(db):
    r = APIRouter(prefix="/bets")
    col = db.bets

    @r.get("")
    async def list_bets():
        """Today's bets only (ET slate date; the day rolls over at 6am ET so late games stay visible)."""
        day = (datetime.now(ET) - timedelta(hours=6)).strftime("%y%b%d").upper()
        docs = await col.find({"game_code": {"$regex": f"^{day}"}}).sort("created_at", -1).to_list(2000)
        return [Bet.from_mongo(d).model_dump() for d in docs]

    @r.get("/all")
    async def all_bets():
        """Every tracked bet across all days (oldest first) for the Results page."""
        docs = await col.find({}).sort("created_at", 1).to_list(10000)
        return [Bet.from_mongo(d).model_dump() for d in docs]
    async def grade_bets():
        """Live/final ESPN grading: all legs hit -> won (even mid-game); final with a miss -> lost; final with player DNP -> void."""
        pending = [Bet.from_mongo(d) for d in await col.find({"status": "pending"}).to_list(2000)]
        boxes, graded, live = {}, 0, {}
        for b in pending:
            info = kalshi.parse_game_code(b.game_code)
            if not info:
                continue
            if b.game_code not in boxes:
                try:
                    boxes[b.game_code] = await espn.game_box(info["date"].replace("-", ""), b.game_code[-6:-3], b.game_code[-3:])
                except httpx.HTTPError as e:
                    logger.warning("ESPN grading %s failed: %s", b.game_code, e)
                    boxes[b.game_code] = None
            box = boxes[b.game_code]
            if box is None:
                continue
            final = box["state"] == "post"
            line = box["players"].get(norm_name(b.player))
            if line is None or any(l.market not in line for l in b.legs):
                if final and line is None:
                    await col.update_one({"_id": ObjectId(b.id), "status": "pending"}, {"$set": {"status": "void", "auto_graded": True}})
                    graded += 1
                continue
            stats = {l.market: line[l.market] for l in b.legs}
            hit = all(line[l.market] >= (l.threshold or 0) for l in b.legs)
            if hit or final:
                await col.update_one({"_id": ObjectId(b.id), "status": "pending"},
                                     {"$set": {"status": "won" if hit else "lost", "auto_graded": True, "result_stats": stats}})
                graded += 1
            else:
                live[b.id] = {"clock": box["clock"], "stats": stats}
        return {"graded": graded, "live": live}

    @r.post("")
    async def add_bet(b: BetIn):
        bet = Bet(**b.model_dump())
        res = await col.insert_one(bet.to_mongo())
        bet.id = str(res.inserted_id)
        return bet.model_dump()

    def _oid(bet_id):
        if not ObjectId.is_valid(bet_id):
            raise HTTPException(404, "Bet not found")
        return ObjectId(bet_id)

    @r.patch("/{bet_id}")
    async def set_status(bet_id: str, s: StatusIn):
        doc = await col.find_one_and_update({"_id": _oid(bet_id)}, {"$set": {"status": s.status, "auto_graded": False}}, return_document=True)
        if not doc:
            raise HTTPException(404, "Bet not found")
        return Bet.from_mongo(doc).model_dump()

    @r.delete("/{bet_id}")
    async def delete_bet(bet_id: str):
        if not (await col.delete_one({"_id": _oid(bet_id)})).deleted_count:
            raise HTTPException(404, "Bet not found")
        return {"ok": True}

    return r
