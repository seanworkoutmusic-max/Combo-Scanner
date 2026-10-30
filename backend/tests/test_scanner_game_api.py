# DD/TD scanner game endpoint: combos (PR/PA/RA/PRA), singles, built_dd formula
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
CODE = "26OCT29MEMPOR"


@pytest.fixture(scope="module")
def scan():
    r = requests.get(f"{BASE_URL}/api/scanner/game/{CODE}", timeout=90)
    assert r.status_code == 200, r.text[:300]
    return r.json()


def _price(c):
    return (c.get("live") or {}).get("yes_price")


def test_shape(scan):
    assert scan["game"]["code"] == CODE
    assert "updated_at" in scan
    assert len(scan["players"]) > 0
    for p in scan["players"]:
        for k in ("key", "name", "team", "singles", "combos", "built_dd"):
            assert k in p


def test_combo_kinds_and_live_prices(scan):
    total, priced = 0, 0
    for p in scan["players"]:
        for c in p["combos"]:
            assert c["kind"] in ("PR", "PA", "RA", "PRA")
            total += 1
            pr = _price(c)
            if pr is not None:
                priced += 1
                assert 0 < pr < 1
            print(p["name"], c["kind"], c["name"], pr, c.get("error"))
    assert total > 0
    assert priced / total >= 0.5, f"only {priced}/{total} combos priced"


def test_legs_thresholds(scan):
    for p in scan["players"]:
        for c in p["combos"]:
            for l in c["legs"]:
                if l["market"] in ("Rebounds", "Assists"):
                    assert l["threshold"] == 10
            kinds = {l["market"] for l in c["legs"]}
            exp = {"PR": {"Points", "Rebounds"}, "PA": {"Points", "Assists"},
                   "RA": {"Rebounds", "Assists"}, "PRA": {"Points", "Rebounds", "Assists"}}[c["kind"]]
            assert kinds == exp


def test_points_fallback_avdija(scan):
    deni = [p for p in scan["players"] if "Avdija" in p["name"]]
    if not deni:
        pytest.skip("Avdija not in scanner")
    for c in deni[0]["combos"]:
        pts = [l for l in c["legs"] if l["market"] == "Points"]
        if pts:
            print("Avdija", c["kind"], pts[0]["threshold"])
            assert pts[0]["threshold"] >= 10


def test_singles(scan):
    names = set()
    for p in scan["players"]:
        for s in p["singles"]:
            assert s["name"] in ("Double Double", "Triple Double")
            assert "ticker" in s["line"]
            names.add(s["name"])
    assert "Double Double" in names


def test_built_dd_formula(scan):
    for p in scan["players"]:
        b = p["built_dd"]
        pairs = [_price(c) for c in p["combos"] if c["kind"] != "PRA" and _price(c)]
        tri = next((_price(c) for c in p["combos"] if c["kind"] == "PRA" and _price(c)), None)
        if not pairs:
            assert b is None
            continue
        assert b["paths"] == len(pairs)
        if tri is not None:
            exp = min(sum(pairs) - (len(pairs) - 1) * tri, 0.99)
            assert abs(b["price"] - exp) < 1e-3
        else:
            assert b["price"] == max(pairs)
            if len(pairs) == 1:
                assert b["exact"] is True
                assert b["price"] == pairs[0]
        assert 0 < b["price"] < 1


def test_unknown_game_404():
    r = requests.get(f"{BASE_URL}/api/scanner/game/NOPE123", timeout=30)
    assert r.status_code == 404
