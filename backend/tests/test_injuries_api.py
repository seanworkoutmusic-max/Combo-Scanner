# Injuries slate API: /api/injuries structure, tonight-only games, next_up & tag logic
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
SIT = ("out", "doubtful")


@pytest.fixture(scope="module")
def data():
    r = requests.get(f"{BASE_URL}/api/injuries", timeout=60)
    assert r.status_code == 200, r.text
    return r.json()


def rows(d):
    return [r for g in d["games"] for r in g["rows"]]


def test_top_level(data):
    assert isinstance(data["games"], list)
    assert isinstance(data["updated_at"], str) and data["updated_at"].endswith("Z")


def test_game_fields(data):
    for g in data["games"]:
        for k in ("away", "home", "start", "state", "rows"):
            assert k in g
        assert g["state"] in ("pre", "in", "post")


def test_rows_only_tonight_teams(data):
    for g in data["games"]:
        for r in g["rows"]:
            assert r["team"] in (g["away"], g["home"])


def test_row_fields(data):
    keys = {"name", "team", "pos", "depth", "headshot", "status", "injury", "return", "comment", "next_up", "tag", "chart"}
    for r in rows(data):
        assert keys <= set(r)
        for c in r["chart"]:
            assert {"depth", "name", "out"} <= set(c)
            assert isinstance(c["out"], bool)


def test_next_up_logic(data):
    for r in rows(data):
        if not r["chart"] or r["depth"] is None:
            assert r["next_up"] is None
            continue
        names = [c["name"] for c in r["chart"]]
        assert names[r["depth"] - 1] == r["name"]
        expected = next((c["name"] for c in r["chart"][r["depth"]:] if not c["out"]), None)
        assert r["next_up"] == expected, r


def test_tag_logic(data):
    for r in rows(data):
        if not r["next_up"]:
            assert r["tag"] is None
        elif r["depth"] == 1:
            assert r["tag"] == ("Starts" if r["status"].lower() in SIT else "If out"), r
        else:
            assert r["tag"] == "More minutes"


def test_chart_out_flag_matches_status(data):
    for g in data["games"]:
        for r in g["rows"]:
            if r["status"].lower() in SIT:
                me = [c for c in r["chart"] if c["name"] == r["name"]]
                if me:
                    assert me[0]["out"] is True


def test_cached_second_call_fast():
    r = requests.get(f"{BASE_URL}/api/injuries", timeout=60)
    assert r.status_code == 200
    assert r.elapsed.total_seconds() < 5
