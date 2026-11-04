# Board loading regression: /api/scanner/board (default TD + ra=8) under 60s, fills with SGP prices after refresh
import os
import time
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


def _board(params=None):
    t = time.time()
    r = requests.get(f"{BASE_URL}/api/scanner/board", params=params or {}, timeout=90)
    dt = time.time() - t
    d = r.json() if r.status_code == 200 else {}
    pl = d.get("players", [])
    with_sgp = sum(1 for p in pl if p.get("sgp"))
    cells = sum(len(p.get("sgp") or {}) for p in pl)
    print(f"params={params} status={r.status_code} t={dt:.1f}s games={d.get('games')} players={len(pl)} with_sgp={with_sgp} cells={cells} books={d.get('books')}")
    return r, dt, d


# Default board (10+ pts triple-double): under 60s, players > 0 within 2 calls
def test_default_board_fills():
    results = []
    for i in range(2):
        r, dt, d = _board()
        assert r.status_code == 200
        assert dt < 60, f"call {i} took {dt:.1f}s"
        assert isinstance(d["players"], list)
        results.append(d)
        if d["players"]:
            break
        time.sleep(45)
    last = results[-1]
    assert len(last["players"]) > 0, f"no players after {len(results)} calls; books={last['books']}"
    assert any(p.get("sgp") for p in last["players"])
    p = last["players"][0]
    assert p["combos"][0]["kind"] == "TD"
    assert p["combos"][0]["live"]["yes_price"]


# ra=8 board: under 60s, players > 0 within 2 calls
def test_ra8_board_fills():
    time.sleep(30)
    results = []
    for i in range(2):
        r, dt, d = _board({"ra": 8})
        assert r.status_code == 200
        assert dt < 60, f"call {i} took {dt:.1f}s"
        results.append(d)
        if d["players"]:
            break
        time.sleep(45)
    last = results[-1]
    assert len(last["players"]) > 0
    assert all(p["combos"][0]["kind"] == "RA" for p in last["players"])
    assert all(p.get("sgp") for p in last["players"])
