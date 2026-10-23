# DD/TD Scanner (Kalshi-only) player endpoint tests - live Kalshi data
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


@pytest.fixture(scope="module")
def luka():
    players = requests.get(f"{BASE_URL}/api/props/players", timeout=60).json()
    p = next((x for x in players if x["key"] == "luka doncic"), None)
    if not p:
        pytest.skip("Luka not on Kalshi currently")
    r = requests.get(f"{BASE_URL}/api/scanner/player", params={"game": p["game"], "player": p["key"]}, timeout=90)
    assert r.status_code == 200, r.text
    return r.json()


def test_player_block(luka):
    assert luka["player"]["name"] == "Luka Dončić"
    assert luka["player"]["headshot"].startswith("https://a.espncdn.com/")


def test_singles(luka):
    names = {s["name"] for s in luka["singles"]}
    assert {"Double Double", "Triple Double"} <= names
    for s in luka["singles"]:
        assert 0 < s["line"]["yes_ask"] < 1


def test_combos_live(luka):
    assert len(luka["combos"]) >= 3
    assert luka["combos"][0]["name"] == "10+ Rebounds & 10+ Assists"
    names = [c["name"] for c in luka["combos"]]
    assert len(set(names)) == len(names)
    quoted = [c for c in luka["combos"] if c.get("live") and c["live"].get("yes_price")]
    assert len(quoted) >= len(luka["combos"]) // 2, [(c["name"], c.get("error")) for c in luka["combos"]]
    for c in quoted:
        assert 0 < c["live"]["yes_price"] < 1
        assert len(c["legs"]) >= 2


def test_unknown_player_404():
    r = requests.get(f"{BASE_URL}/api/scanner/player", params={"game": "26OCT23LACLAL", "player": "nobody xyz"}, timeout=30)
    assert r.status_code == 404


def test_unknown_game_404():
    r = requests.get(f"{BASE_URL}/api/scanner/player", params={"game": "BADGAME", "player": "luka doncic"}, timeout=30)
    assert r.status_code == 404


def test_missing_params_422():
    r = requests.get(f"{BASE_URL}/api/scanner/player", timeout=30)
    assert r.status_code == 422
