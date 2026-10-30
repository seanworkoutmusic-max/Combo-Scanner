from datetime import datetime, timezone
from typing import Annotated, Dict, List, Literal, Optional
from bson import ObjectId
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field

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
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class StatusIn(BaseModel):
    status: Status


def make_router(db):
    r = APIRouter(prefix="/bets")
    col = db.bets

    @r.get("")
    async def list_bets():
        return [Bet.from_mongo(d).model_dump() for d in await col.find().sort("created_at", -1).to_list(2000)]

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
        doc = await col.find_one_and_update({"_id": _oid(bet_id)}, {"$set": {"status": s.status}}, return_document=True)
        if not doc:
            raise HTTPException(404, "Bet not found")
        return Bet.from_mongo(doc).model_dump()

    @r.delete("/{bet_id}")
    async def delete_bet(bet_id: str):
        if not (await col.delete_one({"_id": _oid(bet_id)})).deleted_count:
            raise HTTPException(404, "Bet not found")
        return {"ok": True}

    return r
