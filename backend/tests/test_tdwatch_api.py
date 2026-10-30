# TD Watch endpoint tests (GET /api/tdwatch)
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
FIELDS = {"key", "name", "team", "headshot", "gp", "min", "pts", "reb", "ast", "dd", "td", "opp", "score"}


@pytest.fixture(scope="module")
def data():
    r = requests.get(f"{BASE_URL}/api/tdwatch", timeout=60)
    assert r.status_code == 200, r.text
    return r.json()


def test_shape(data):
    assert isinstance(data["season"], str) and data["season"]
    assert data["updated_at"]
    assert 0 < len(data["players"]) <= 40


def test_fields_and_score(data):
    for p in data["players"]:
        assert FIELDS <= set(p), set(p) ^ FIELDS
        assert p["score"] == round(min(p["pts"], p["reb"], p["ast"]), 1)
        assert p["gp"] > 0 and p["min"] >= 15
        assert isinstance(p["team"], str) and len(p["team"]) in (2, 3, 4)


def test_sorted_desc(data):
    s = [p["score"] for p in data["players"]]
    assert s == sorted(s, reverse=True)


def test_unique_keys(data):
    keys = [p["key"] for p in data["players"]]
    assert len(keys) == len(set(keys))


def test_headshots_present(data):
    missing = [p["name"] for p in data["players"] if not p["headshot"]]
    assert len(missing) <= 3, missing


def test_tonight_opps(data):
    opps = {p["team"]: p["opp"] for p in data["players"] if p["opp"]}
    print("tonight", opps)
    for team, opp in opps.items():
        if opp in opps:
            assert opps[opp] == team


@pytest.mark.parametrize("limit,code", [(4, 422), (5, 200), (200, 200), (201, 422), (0, 422)])
def test_limit_bounds(limit, code):
    r = requests.get(f"{BASE_URL}/api/tdwatch", params={"limit": limit}, timeout=60)
    assert r.status_code == code
    if code == 200:
        assert len(r.json()["players"]) <= limit


def test_limit_5(data):
    r = requests.get(f"{BASE_URL}/api/tdwatch", params={"limit": 5}, timeout=60).json()
    assert [p["key"] for p in r["players"]] == [p["key"] for p in data["players"][:5]]
