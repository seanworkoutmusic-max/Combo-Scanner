# TD-only scanner: /api/scanner/game returns only TD combos; no Double Double market in props
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
GAME = "26OCT29SACNOP"


@pytest.fixture(scope="module")
def games():
    r = requests.get(f"{BASE_URL}/api/props/games", timeout=60)
    assert r.status_code == 200
    return r.json()


@pytest.mark.parametrize("td", [10, 15, 20])
def test_scanner_only_td_combos(td):
    r = requests.get(f"{BASE_URL}/api/scanner/game/{GAME}", params={"td_pts": td}, timeout=120)
    assert r.status_code == 200
    d = r.json()
    for p in d["players"]:
        assert len(p["combos"]) == 1
        c = p["combos"][0]
        assert c["kind"] == "TD"
        labels = [(l["market"], l["threshold"]) for l in c["legs"]]
        assert ("Points", td) in labels and ("Rebounds", 10) in labels and ("Assists", 10) in labels
        assert all(s["name"] != "Double Double" for s in p["singles"])
    names = [p["name"] for p in d["players"]]
    if td == 15:
        sab = next((p for p in d["players"] if "Sabonis" in p["name"]), None)
        assert sab, names
        assert (sab["combos"][0].get("live") or {}).get("yes_price"), sab["combos"][0]


def test_no_double_double_market_anywhere(games):
    blob = str(games)
    assert "Double Double" not in blob and "KXNBA2D" not in blob
    # check each game's props
    for g in games:
        code = g["code"]
        r = requests.get(f"{BASE_URL}/api/props/game/{code}", timeout=60)
        if r.status_code == 404:
            pytest.skip("props/game endpoint not available")
        assert r.status_code == 200
        txt = r.text
        assert "Double Double" not in txt and "KXNBA2D" not in txt, code


def test_td_pts_validation():
    for bad in (9, 41, "abc"):
        r = requests.get(f"{BASE_URL}/api/scanner/game/{GAME}", params={"td_pts": bad}, timeout=30)
        assert r.status_code == 422


def test_unknown_game_404():
    r = requests.get(f"{BASE_URL}/api/scanner/game/NOPE123", timeout=60)
    assert r.status_code == 404
