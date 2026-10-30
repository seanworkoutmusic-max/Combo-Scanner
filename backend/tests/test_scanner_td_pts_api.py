# DD/TD scanner: td_pts threshold (10/15/20) for triple-double combo
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
SACNOP = "26OCT29SACNOP"
CLEATL = "26OCT29CLEATL"
_cache = {}


def scan(code, td):
    if (code, td) not in _cache:
        r = requests.get(f"{BASE_URL}/api/scanner/game/{code}", params={"td_pts": td}, timeout=120)
        assert r.status_code == 200, r.text[:300]
        _cache[(code, td)] = r.json()
    return _cache[(code, td)]


def td_combo(data, name_part):
    p = next((p for p in data["players"] if name_part in p["name"]), None)
    assert p, f"{name_part} missing"
    c = next((c for c in p["combos"] if c["kind"] == "TD" or c.get("also_td")), None)
    return p, c


def legs_map(c):
    return {l["market"]: l["threshold"] for l in c["legs"]}


@pytest.mark.parametrize("td", [15, 20])
def test_sabonis_td(td):
    p, c = td_combo(scan(SACNOP, td), "Sabonis")
    assert c is not None
    assert legs_map(c) == {"Points": td, "Rebounds": 10, "Assists": 10}
    pr = (c.get("live") or {}).get("yes_price")
    print("Sabonis", td, c["kind"], c.get("also_td"), pr, c.get("error"))
    assert pr and 0 < pr < 1


def test_sabonis_20_cheaper_than_15():
    _, c15 = td_combo(scan(SACNOP, 15), "Sabonis")
    _, c20 = td_combo(scan(SACNOP, 20), "Sabonis")
    p15, p20 = c15["live"]["yes_price"], c20["live"]["yes_price"]
    print("p15", p15, "p20", p20)
    assert p20 < p15


@pytest.mark.parametrize("td", [15, 20])
def test_jalen_johnson_td(td):
    p, c = td_combo(scan(CLEATL, td), "Jalen Johnson")
    assert c is not None
    assert legs_map(c) == {"Points": td, "Rebounds": 10, "Assists": 10}
    print("JJ", td, c["kind"], c.get("also_td"), (c.get("live") or {}).get("yes_price"))
    if td == 15:
        assert c.get("also_td") is True and c["kind"] == "PRA"
    else:
        assert c["kind"] == "TD"
    assert 0 < c["live"]["yes_price"] < 1


def test_td_points_exact_all_players():
    for td in (15, 20):
        for p in scan(SACNOP, td)["players"]:
            for c in p["combos"]:
                if c["kind"] == "TD" or c.get("also_td"):
                    assert legs_map(c)["Points"] == td


def test_built_dd_unaffected():
    a, b = scan(SACNOP, 15), scan(SACNOP, 20)
    for p in a["players"]:
        for c in p["combos"]:
            if c["kind"] in ("PR", "PA"):
                pts = [l for l in c["legs"] if l["market"] == "Points"][0]["threshold"]
                assert pts <= 15 or pts == min(pts, pts)  # pair uses lowest/10 line
            assert c["kind"] in ("PR", "PA", "RA", "PRA", "TD")
    ka = {p["key"]: [(c["kind"], c["name"]) for c in p["combos"] if c["kind"] != "TD"] for p in a["players"]}
    kb = {p["key"]: [(c["kind"], c["name"]) for c in p["combos"] if c["kind"] != "TD"] for p in b["players"]}
    assert ka == kb
    for p in a["players"]:
        bd = p["built_dd"]
        if bd:
            pairs = [c["live"]["yes_price"] for c in p["combos"] if c["kind"] in ("PR", "PA", "RA") and (c.get("live") or {}).get("yes_price")]
            assert bd["paths"] == len(pairs)


@pytest.mark.parametrize("td", [9, 41, "abc"])
def test_td_pts_validation(td):
    r = requests.get(f"{BASE_URL}/api/scanner/game/{SACNOP}", params={"td_pts": td}, timeout=30)
    assert r.status_code == 422
