# Results page API: GET /api/bets/all vs GET /api/bets (read-only; never mutates user's real bets)
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


@pytest.fixture(scope="module")
def all_bets():
    r = requests.get(f"{BASE_URL}/api/bets/all", timeout=30)
    assert r.status_code == 200
    return r.json()


class TestAllBets:
    def test_returns_every_bet(self, all_bets):
        assert isinstance(all_bets, list)
        assert len(all_bets) >= 141

    def test_oldest_first(self, all_bets):
        ts = [b["created_at"] for b in all_bets]
        assert ts == sorted(ts)

    def test_spans_multiple_days(self, all_bets):
        assert len({b["game_code"][:7] for b in all_bets}) > 1

    def test_shape_no_mongo_id(self, all_bets):
        b = all_bets[0]
        for k in ("id", "player", "combo", "price", "books", "stake", "status", "created_at"):
            assert k in b
        assert "_id" not in b
        assert isinstance(b["id"], str)
        assert b["status"] in ("pending", "won", "lost", "void")

    def test_combo_counts(self, all_bets):
        c = [b["combo"] for b in all_bets]
        assert c.count("6+ Rebounds & 6+ Assists") >= 57
        assert c.count("4+ Rebounds & 4+ Assists") >= 8


class TestTodayBets:
    def test_today_subset(self, all_bets):
        r = requests.get(f"{BASE_URL}/api/bets", timeout=30)
        assert r.status_code == 200
        today = r.json()
        ids_all = {b["id"] for b in all_bets}
        assert all(b["id"] in ids_all for b in today)
        assert len(today) < len(all_bets)
        assert len({b["game_code"][:7] for b in today}) <= 1

