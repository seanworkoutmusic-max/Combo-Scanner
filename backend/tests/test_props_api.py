"""Regression tests for Kalshi Player Props API (/api/props/*)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
COMBO_TICKERS = ["KXNBAPRA-26OCT23MINORL-ORLDBANE3-25", "KXNBAPRA-26OCT23MINORL-MINLBALL1-35"]


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def games(s):
    r = s.get(f"{BASE_URL}/api/props/games", timeout=90)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def game_detail(s, games):
    if not games:
        pytest.skip("No open Kalshi props")
    r = s.get(f"{BASE_URL}/api/props/game/{games[0]['code']}", timeout=60)
    assert r.status_code == 200
    return r.json()


# Games list
def test_props_games(games):
    assert isinstance(games, list) and len(games) > 0
    for g in games:
        for k in ("code", "date", "teams", "label", "player_count"):
            assert k in g
        assert g["player_count"] > 0
    assert games == sorted(games, key=lambda x: (x["date"], x["code"]))


# Game detail
def test_props_game_detail(game_detail):
    assert "game" in game_detail and "players" in game_detail
    p = game_detail["players"][0]
    assert p["markets"] and p["line_count"] == sum(len(m["lines"]) for m in p["markets"])
    counts = [x["line_count"] for x in game_detail["players"]]
    assert counts == sorted(counts, reverse=True)
    line = p["markets"][0]["lines"][0]
    for k in ("ticker", "market", "threshold", "yes_ask", "yes_bid"):
        assert k in line


def test_props_game_404(s):
    r = s.get(f"{BASE_URL}/api/props/game/NOTAGAME", timeout=60)
    assert r.status_code == 404


# Slip
def test_slip_single(s, game_detail):
    t = game_detail["players"][0]["markets"][0]["lines"][0]["ticker"]
    r = s.post(f"{BASE_URL}/api/props/slip", json={"tickers": [t]}, timeout=60)
    assert r.status_code == 200
    d = r.json()
    assert d["legs"][0]["ticker"] == t and d["legs"][0]["player"]
    assert d["combo"] is None
    assert "indexed" in d["combo_index"]


def test_slip_unknown_ticker(s):
    r = s.post(f"{BASE_URL}/api/props/slip", json={"tickers": ["FAKE-1", "FAKE-2"]}, timeout=60)
    assert r.status_code == 200
    d = r.json()
    assert d["legs"] == [None, None] and d["combo"] is None


def test_slip_empty_and_bad_body(s):
    assert s.post(f"{BASE_URL}/api/props/slip", json={"tickers": []}, timeout=60).status_code == 200
    assert s.post(f"{BASE_URL}/api/props/slip", json={}, timeout=60).status_code == 422


def test_slip_exact_combo(s):
    r = s.post(f"{BASE_URL}/api/props/slip", json={"tickers": COMBO_TICKERS}, timeout=60)
    assert r.status_code == 200
    d = r.json()
    print("combo_index", d["combo_index"], "combo", d["combo"])
    if d["combo_index"]["indexed"] == 0:
        pytest.skip("combo index not built yet")
    if d["combo"] is None:
        pytest.skip("combo no longer listed on Kalshi")
    assert d["combo"]["ticker"] and "yes_ask" in d["combo"]
    # order independence
    r2 = s.post(f"{BASE_URL}/api/props/slip", json={"tickers": COMBO_TICKERS[::-1]}, timeout=60)
    assert r2.json()["combo"]["ticker"] == d["combo"]["ticker"]
