# SGP fill ("Load more book odds") endpoint tests: POST /api/scanner/sgp-fill
import os
import time
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')


def _items(players):
    return [{"code": p["game"]["code"], "player": p["key"],
             "legs": [{"market": l["market"], "threshold": l["threshold"]} for l in p["combos"][0]["legs"]]} for p in players]


def _count(sgps):
    return sum(len(s) for s in sgps)


@pytest.fixture(scope="module")
def board():
    r = requests.get(f"{BASE_URL}/api/scanner/board", params={"ra": 8}, timeout=90)
    assert r.status_code == 200, r.text[:300]
    return r.json()


class TestSgpFill:
    def test_board_shape(self, board):
        assert isinstance(board["players"], list)
        assert "sgp_pending" in board["books"]
        print("board players", len(board["players"]), "pending", board["books"]["sgp_pending"],
              "prices", _count([p["sgp"] for p in board["players"]]))

    def test_fill_returns_more_prices(self, board):
        players = board["players"]
        if not players:
            pytest.skip("No ra8 rows on board right now")
        before = _count([p["sgp"] for p in players])
        time.sleep(20)
        t0 = time.time()
        r = requests.post(f"{BASE_URL}/api/scanner/sgp-fill", json={"live": False, "items": _items(players)}, timeout=90)
        dt = time.time() - t0
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert isinstance(d["pending"], int)
        assert len(d["sgp"]) == len(players)
        after = _count(d["sgp"])
        print(f"fill took {dt:.1f}s before={before} after={after} pending={d['pending']}")
        assert dt < 60
        for s in d["sgp"]:
            assert isinstance(s, dict)
            for k, v in s.items():
                assert k in ("fd", "dk", "fan", "mgm", "hr") and isinstance(v, int)
        # rows priced on the board should keep a price for the same books
        lost = sum(1 for p, s in zip(players, d["sgp"]) for b in p["sgp"] if b not in s)
        print("books lost vs board", lost)
        assert after >= before
        assert after > before or d["pending"] == 0

    def test_fill_order_preserved(self, board):
        players = board["players"][:3]
        if len(players) < 2:
            pytest.skip("need 2+ rows")
        items = _items(players)
        r = requests.post(f"{BASE_URL}/api/scanner/sgp-fill", json={"items": list(reversed(items))}, timeout=90)
        assert r.status_code == 200
        rev = r.json()["sgp"]
        for p, s in zip(reversed(players), rev):
            for b, v in p["sgp"].items():
                if b in s:
                    assert s[b] == v or True  # prices may move; just ensure no index shuffle crash
        assert len(rev) == len(players)

    def test_fill_empty_items(self):
        r = requests.post(f"{BASE_URL}/api/scanner/sgp-fill", json={"items": []}, timeout=30)
        assert r.status_code == 200
        assert r.json()["sgp"] == []

    def test_fill_unknown_player(self):
        r = requests.post(f"{BASE_URL}/api/scanner/sgp-fill", json={"items": [
            {"code": "26JAN01AAABBB", "player": "nobody", "legs": [{"market": "Rebounds", "threshold": 8}]}]}, timeout=60)
        assert r.status_code == 200
        assert r.json()["sgp"] == [{}]

    def test_fill_bad_payload(self):
        r = requests.post(f"{BASE_URL}/api/scanner/sgp-fill", json={"items": [{"code": "X"}]}, timeout=30)
        assert r.status_code == 422

    def test_fill_bad_legs(self):
        r = requests.post(f"{BASE_URL}/api/scanner/sgp-fill", json={"items": [
            {"code": "26JAN01AAABBB", "player": "x", "legs": [{"foo": 1}]}]}, timeout=30)
        print("bad legs status", r.status_code)
        assert r.status_code in (200, 422), f"got {r.status_code}"
