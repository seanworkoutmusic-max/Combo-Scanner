# Scanner: book-only (FanDuel/DraftKings) TD rows when Kalshi has no combo
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
CODE = "26OCT29MEMPOR"


@pytest.fixture(scope="module")
def r10():
    r = requests.get(f"{BASE_URL}/api/scanner/game/{CODE}", params={"td_pts": 10}, timeout=90)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def r15():
    r = requests.get(f"{BASE_URL}/api/scanner/game/{CODE}", params={"td_pts": 15}, timeout=90)
    assert r.status_code == 200, r.text
    return r.json()


def test_books_meta(r10):
    b = r10["books"]
    assert b["enabled"] is True
    assert "credits_left" in b and b["credits_left"] is not None
    print("books meta", b)


def test_book_only_rows_present(r10):
    rows = [p for p in r10["players"] if not p["combos"] and p["books"]]
    print("book-only:", [(p["key"], p["team"], p["books"]) for p in rows])
    assert rows, "expected book-only rows"
    for p in rows:
        assert set(p["books"]) <= {"fd", "dk"}
        assert all(isinstance(v, int) for v in p["books"].values())
        assert p["singles"] == [] and p["built_dd"] is None


def test_deni_avdija(r10):
    d = next((p for p in r10["players"] if p["key"] == "deni avdija"), None)
    assert d, [p["key"] for p in r10["players"]]
    assert d["books"].get("fd") or d["books"].get("dk")
    assert d["team"]
    print("deni", d)


def test_td15_no_book_only(r15):
    assert all(p["combos"] for p in r15["players"]), [p["key"] for p in r15["players"] if not p["combos"]]
    assert all(p["books"] == {} for p in r15["players"])


def test_bad_game_404():
    r = requests.get(f"{BASE_URL}/api/scanner/game/26XXX00AAABBB", timeout=60)
    assert r.status_code == 404
