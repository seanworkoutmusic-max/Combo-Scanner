"""Regression tests for Kalshi DD/TD EV scanner API (no OpticOdds key configured)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def games(s):
    r = s.get(f"{BASE_URL}/api/games", timeout=60)
    assert r.status_code == 200, r.text
    return r.json()


# Status endpoint
def test_status(s):
    r = s.get(f"{BASE_URL}/api/status", timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["opticodds_key"] is False
    assert "DraftKings" in d["books"] and "FanDuel" in d["books"]
    assert isinstance(d["default_books"], list) and len(d["default_books"]) > 0
    assert "FanDuel" not in d["sgp_books"]
    assert d["sgp_books"] == sorted(d["sgp_books"])


# Games endpoint - live Kalshi
def test_games_structure(games):
    assert isinstance(games, list)
    if not games:
        pytest.skip("No open Kalshi DD/TD markets right now")
    g = games[0]
    for k in ("code", "date", "teams", "label", "players"):
        assert k in g
    assert len(g["teams"]) == 2
    assert g["label"] == f"{g['teams'][0]} vs {g['teams'][1]}"
    assert len(g["players"]) > 0
    p = g["players"][0]
    assert set(p.keys()) >= {"key", "name", "team"}
    dates = [(x["date"], x["code"]) for x in games]
    assert dates == sorted(dates)


# Scan endpoint
def test_scan_game(s, games):
    if not games:
        pytest.skip("no games")
    code = games[0]["code"]
    r = s.get(f"{BASE_URL}/api/scan", params={"game": code}, timeout=60)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["optic_status"] == "missing_key"
    assert d["game"]["code"] == code
    assert d["fixture"] is None
    assert "updated_at" in d
    assert len(d["rows"]) > 0
    has_market = False
    for row in d["rows"]:
        assert row["books"] == []
        for kind in ("dd", "td"):
            m = row.get(kind)
            if m:
                has_market = True
                assert m["ticker"].startswith("KXNBA2D" if kind == "dd" else "KXNBA3D")
                for f in ("yes_ask", "no_ask"):
                    assert m[f] is None or 0 <= m[f] <= 1
    assert has_market


def test_scan_with_books_param(s, games):
    if not games:
        pytest.skip("no games")
    r = s.get(f"{BASE_URL}/api/scan", params={"game": games[0]["code"], "books": "DraftKings,Bogus"}, timeout=60)
    assert r.status_code == 200


def test_scan_unknown_game(s):
    r = s.get(f"{BASE_URL}/api/scan", params={"game": "99JAN01XXXYYY"}, timeout=60)
    assert r.status_code == 404
    assert "detail" in r.json()


def test_scan_missing_param(s):
    r = s.get(f"{BASE_URL}/api/scan", timeout=30)
    assert r.status_code == 422


# Combo endpoint without key
def test_combo_no_key(s, games):
    code = games[0]["code"] if games else "X"
    r = s.post(f"{BASE_URL}/api/combo", json={"game": code, "player": "Anyone",
                                              "legs": [{"stat": "pts", "threshold": 10}]}, timeout=30)
    assert r.status_code == 400
    assert "OpticOdds" in r.json()["detail"]


def test_combo_invalid_body(s):
    r = s.post(f"{BASE_URL}/api/combo", json={"game": "x"}, timeout=30)
    assert r.status_code == 422
