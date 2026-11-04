# SGP refresh stability: repeated /api/scanner/board?ra=8 calls must not shrink the board (stale-cache + background refresh)
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
RESULTS = []


def _call():
    t = time.time()
    r = requests.get(f"{BASE_URL}/api/scanner/board", params={"ra": 8}, timeout=90)
    return r, time.time() - t


@pytest.fixture(scope="module")
def runs():
    for i in range(3):
        if i:
            time.sleep(20)
        r, dt = _call()
        d = r.json() if r.status_code == 200 else None
        RESULTS.append((r.status_code, dt, d))
        if d:
            books = {p["game"]["code"] + "|" + p["key"]: sorted(p["sgp"].keys()) for p in d["players"]}
            print(f"call {i+1}: {r.status_code} {dt:.1f}s players={len(d['players'])} pending={d['books'].get('sgp_pending')} "
                  f"rejected={d['books'].get('sgp_key_rejected')} total_books={sum(len(v) for v in books.values())}")
            for p in d["players"]:
                print("   ", p["game"]["code"], p["name"], p["sgp"])
        else:
            print(f"call {i+1}: {r.status_code} {dt:.1f}s {r.text[:200]}")
    return RESULTS


def test_status_and_latency(runs):
    for code, dt, _ in runs:
        assert code == 200
        assert dt < 55, f"took {dt:.1f}s"


def test_books_fields(runs):
    for _, _, d in runs:
        assert isinstance(d["books"]["sgp_pending"], int)
        assert d["books"]["sgp_key_rejected"] is False


def test_board_never_shrinks(runs):
    counts = [len(d["players"]) for _, _, d in runs]
    print("player counts", counts)
    assert counts[0] > 0
    for a, b in zip(counts, counts[1:]):
        assert b >= a, f"board shrank {counts}"


def test_books_per_player_not_shrinking(runs):
    maps = [{p["game"]["code"] + "|" + p["key"]: set(p["sgp"]) for p in d["players"]} for _, _, d in runs]
    lost = []
    for i in range(1, len(maps)):
        for k, bs in maps[i - 1].items():
            now = maps[i].get(k)
            if now is None:
                lost.append((i, k, "player missing"))
            elif not bs <= now:
                lost.append((i, k, sorted(bs - now)))
    print("lost", lost)
    assert not lost
