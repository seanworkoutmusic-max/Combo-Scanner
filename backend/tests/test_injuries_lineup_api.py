# Injuries redesign: /api/injuries lineup array + POST /api/injuries/lines (Kalshi combos for projected starters)
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
LKEYS = {"pos", "name", "key", "headshot", "new", "bump", "pts", "reb", "ast", "min"}


@pytest.fixture(scope="module")
def data():
    r = requests.get(f"{BASE_URL}/api/injuries", timeout=60)
    assert r.status_code == 200, r.text
    return r.json()


def _rows(d):
    return [(g, r) for g in d["games"] for r in g["rows"]]


# lineup structure
def test_lineup_fields(data):
    rows = _rows(data)
    assert rows, "no injury rows tonight"
    for g, r in rows:
        L = r["lineup"]
        assert isinstance(L, list) and len(L) <= 5
        assert all(p["name"] != r["name"] for p in L), r["name"]
        assert len({p["key"] for p in L}) == len(L)
        for p in L:
            assert LKEYS <= set(p)
            assert p["pos"] in ("PG", "SG", "SF", "PF", "C")
            assert isinstance(p["new"], bool)
            assert 0 <= p["bump"] <= 1


def test_out_starter_has_new_starter(data):
    # NEW STARTER players always get a positive bump (ESPN may already list the replacement at depth 1, so 'new' is optional)
    for g, r in _rows(data):
        for p in r["lineup"]:
            if p["new"]:
                assert p["bump"] >= 0.1, (r["name"], p)


# lines endpoint
def test_lines_unknown_game():
    r = requests.post(f"{BASE_URL}/api/injuries/lines", json={"away": "XXX", "home": "YYY", "players": ["a"], "anchors": []}, timeout=90)
    assert r.status_code == 200
    d = r.json()
    assert d["game"] is None and d["combos"] == []


def test_lines_validation():
    r = requests.post(f"{BASE_URL}/api/injuries/lines", json={"away": "WAS"}, timeout=30)
    assert r.status_code == 422


def test_lines_real_game(data):
    g, row = next(((g, r) for g, r in _rows(data) if r["lineup"] and g["state"] == "pre"), (None, None))
    if not g:
        pytest.skip("no pre-game injury rows")
    L = row["lineup"]
    anchors = [p["key"] for p in L if p["new"]] or [max(L, key=lambda p: p["bump"])["key"]]
    r = requests.post(f"{BASE_URL}/api/injuries/lines",
                      json={"away": g["away"], "home": g["home"], "players": [p["key"] for p in L], "anchors": anchors}, timeout=120)
    assert r.status_code == 200, r.text
    d = r.json()
    print("elapsed", r.elapsed.total_seconds(), "game", d["game"], "n", len(d["combos"]), "pending", d.get("sgp_pending"))
    assert "combos" in d and "sgp_pending" in d
    if d["game"] is None:
        pytest.skip("Kalshi has no combos for this game")
    assert d["game"].endswith(f"{g['away']}{g['home']}")
    keys = {p["key"] for p in L}
    for c in d["combos"]:
        print(c["kind"], c["name"], c["price"], c["sgp"])
        assert c["kind"] in ("RA6", "PAIR")
        assert c["player"] in keys
        assert isinstance(c["sgp"], dict)
        assert c["price"] is None or 0 < c["price"] < 1
        assert isinstance(c["name"], str) and c["name"]
        assert isinstance(c["ticker"], str) and c["ticker"]
        if c["kind"] == "PAIR":
            assert c["player"] in anchors
