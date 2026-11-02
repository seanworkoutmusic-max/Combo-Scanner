# OddsBlaze key fix: scanner board returns SGP prices and sgp_key_rejected flag is false
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


@pytest.fixture(scope="module")
def board():
    r = requests.get(f"{BASE_URL}/api/scanner/board", params={"ra": 8, "game": "26NOV02CHIPHI"}, timeout=90)
    assert r.status_code == 200, r.text[:300]
    return r.json()


def test_books_flags(board):
    b = board["books"]
    assert b["sgp"] is True
    assert "sgp_key_rejected" in b
    assert b["sgp_key_rejected"] is False


def test_players_have_sgp(board):
    print("games", board["games"], "players", len(board["players"]))
    assert board["players"], "no players returned"
    with_sgp = [p for p in board["players"] if p.get("sgp")]
    assert with_sgp, "no player has sgp prices"
    for p in with_sgp:
        for v in p["sgp"].values():
            assert isinstance(v, int)
        assert p["game"]["code"] == "26NOV02CHIPHI"
        assert p["combos"][0]["kind"] == "RA"
