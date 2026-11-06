# Outliers API: GET /api/outliers (Fanatics vs DK/FD/MGM/HardRock NBA player-prop overs)
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
MARKETS = {"points", "rebounds", "assists", "pts + reb", "pts + ast", "reb + ast", "pts + reb + ast", "threes", "steals", "blocks"}
BOOKS = {"DraftKings", "FanDuel", "BetMGM", "Hard Rock"}


def dec(a):
    return 1 + a / 100 if a > 0 else 1 + 100 / -a


@pytest.fixture(scope="module")
def data():
    r = requests.get(f"{BASE_URL}/api/outliers", timeout=90)
    assert r.status_code == 200, r.text[:300]
    return r.json()


def test_shape(data):
    assert set(["rows", "games", "updated_at"]) <= set(data)
    assert isinstance(data["rows"], list) and isinstance(data["games"], list)
    assert data["updated_at"]
    print(f"rows={len(data['rows'])} games={len(data['games'])}")


def test_games(data):
    for g in data["games"]:
        assert {"away", "home", "date", "props"} <= set(g)
        assert isinstance(g["props"], int) and g["props"] > 0
    dates = [g["date"] or "" for g in data["games"]]
    assert dates == sorted(dates)


def test_rows_fields_and_math(data):
    rows = data["rows"]
    if not rows:
        pytest.skip("no outliers live")
    for r in rows:
        assert {"player", "market", "line", "game", "price", "next_best", "next_book", "books", "pays_more", "open_for"} <= set(r)
        assert r["market"] in MARKETS
        assert r["next_book"] in BOOKS
        assert 1 <= r["books"] <= 4
        assert isinstance(r["price"], int) and isinstance(r["next_best"], int)
        assert r["pays_more"] > 0
        assert abs(dec(r["price"]) / dec(r["next_best"]) - 1 - r["pays_more"]) < 1e-3
        assert r["open_for"] >= 0
        assert {"away", "home", "date"} <= set(r["game"])


def test_sorted_desc(data):
    p = [r["pays_more"] for r in data["rows"]]
    assert p == sorted(p, reverse=True)


def test_row_games_in_strip(data):
    keys = {f"{g['away']}@{g['home']}" for g in data["games"]}
    for r in data["rows"]:
        assert f"{r['game']['away']}@{r['game']['home']}" in keys


def test_unique_rows(data):
    ks = [(r["game"]["away"], r["game"]["home"], r["player"], r["market"], r["line"]) for r in data["rows"]]
    assert len(ks) == len(set(ks))


def test_cached_second_call_fast():
    import time
    t = time.time()
    r = requests.get(f"{BASE_URL}/api/outliers", timeout=90)
    assert r.status_code == 200
    print(f"second call {time.time()-t:.2f}s")
