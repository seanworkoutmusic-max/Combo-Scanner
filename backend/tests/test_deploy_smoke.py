# Deploy regression smoke tests: status, scanner games/board, bets CRUD, live tracker
import os
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def games(s):
    r = s.get(f"{BASE_URL}/api/scanner/games", timeout=60)
    assert r.status_code == 200
    return r.json()


# Health
def test_status(s):
    r = s.get(f"{BASE_URL}/api/status", timeout=20)
    assert r.status_code == 200


# Scanner games list
def test_scanner_games(games):
    assert isinstance(games, list)
    for g in games:
        assert {"code", "date", "kalshi"} <= set(g)
        assert isinstance(g["kalshi"], bool)
    print(f"games={len(games)} kalshi={sum(g['kalshi'] for g in games)}")


# Single-game scanner board
def test_scanner_board_single_game(s, games):
    kg = [g for g in games if g["kalshi"]]
    if not kg:
        pytest.skip("no kalshi games")
    r = s.get(f"{BASE_URL}/api/scanner/board", params={"td_pts": 20, "game": kg[0]["code"]}, timeout=65)
    assert r.status_code == 200, r.text[:300]
    d = r.json()
    assert isinstance(d["players"], list)
    assert d["games"] in (0, 1)
    assert "books" in d and "updated_at" in d
    print(f"board {kg[0]['code']} players={len(d['players'])} elapsed={r.elapsed.total_seconds()}")


# Bets CRUD
def test_bets_crud(s):
    r = s.get(f"{BASE_URL}/api/bets", timeout=20)
    assert r.status_code == 200 and isinstance(r.json(), list)
    day = (datetime.now(ZoneInfo("America/New_York")) - timedelta(hours=6)).strftime("%y%b%d").upper()
    payload = {"player": "TEST_Player", "team": "TST", "game_code": f"{day}AAABBB", "game_label": "TEST",
               "combo": "20+ Points & 10+ Rebounds & 10+ Assists",
               "legs": [{"ticker": "TEST-T", "market": "Points", "threshold": 20}], "price": 0.1, "stake": 1}
    c = s.post(f"{BASE_URL}/api/bets", json=payload, timeout=20)
    assert c.status_code in (200, 201), c.text
    bet = c.json()
    bid = bet["id"]
    assert bet["player"] == "TEST_Player" and bet["status"] == "pending"
    try:
        ids = [b["id"] for b in s.get(f"{BASE_URL}/api/bets", timeout=20).json()]
        assert bid in ids
    finally:
        d = s.delete(f"{BASE_URL}/api/bets/{bid}", timeout=20)
        assert d.status_code in (200, 204)
    ids = [b["id"] for b in s.get(f"{BASE_URL}/api/bets", timeout=20).json()]
    assert bid not in ids


# Live tracker
def test_live_tracker(s):
    r = s.get(f"{BASE_URL}/api/live-tracker", timeout=60)
    assert r.status_code == 200, r.text[:300]
    assert "updated_at" in r.json()
