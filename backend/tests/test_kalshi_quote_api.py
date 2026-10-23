"""Tests for authenticated Kalshi live combo quote (/api/props/kalshi-quote) and /api/status kalshi_key.
Keeps live RFQ calls minimal (Kalshi rate limits; RFQ is created + deleted, never accepted)."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def two_tickers(s):
    games = s.get(f"{BASE_URL}/api/props/games", timeout=90).json()
    for g in games:
        d = s.get(f"{BASE_URL}/api/props/game/{g['code']}", timeout=60).json()
        for p in d["players"]:
            m = {x["label"]: x["lines"] for x in p["markets"]}
            reb, ast = m.get("Rebounds"), m.get("Assists")
            if reb and ast:
                return [reb[0]["ticker"], ast[0]["ticker"]]
    pytest.skip("No same-player Rebounds+Assists lines found")


# Status flag
def test_status_kalshi_key(s):
    r = s.get(f"{BASE_URL}/api/status", timeout=20)
    assert r.status_code == 200
    assert r.json()["kalshi_key"] is True


# Validation: fewer than 2 legs
@pytest.mark.parametrize("tickers", [[], ["KXNBAREB-X-Y-10"]])
def test_quote_requires_two_legs(s, tickers):
    r = s.post(f"{BASE_URL}/api/props/kalshi-quote", json={"tickers": tickers}, timeout=20)
    assert r.status_code == 400
    assert "2 legs" in r.json()["detail"]


def test_quote_missing_body(s):
    r = s.post(f"{BASE_URL}/api/props/kalshi-quote", json={}, timeout=20)
    assert r.status_code == 422


# Live RFQ quote (1 real call + 1 cached call)
def test_live_quote(s, two_tickers):
    t0 = time.time()
    r = s.post(f"{BASE_URL}/api/props/kalshi-quote", json={"tickers": two_tickers}, timeout=40)
    elapsed = time.time() - t0
    assert r.status_code == 200, r.text
    d = r.json()
    print("live quote:", {k: d[k] for k in ("yes_price", "quotes", "book_yes_ask")}, f"{elapsed:.1f}s")
    assert d["market_ticker"].startswith("KXMVE")
    assert d["quotes"] > 0
    assert 0 < d["yes_price"] < 1
    assert elapsed < 12
    # cached second call should be fast and identical
    t1 = time.time()
    r2 = s.post(f"{BASE_URL}/api/props/kalshi-quote", json={"tickers": list(reversed(two_tickers))}, timeout=40)
    assert r2.status_code == 200
    assert r2.json()["yes_price"] == d["yes_price"]
    assert time.time() - t1 < 3


# Invalid tickers should give a clean 502, not 500
def test_quote_bad_tickers(s):
    r = s.post(f"{BASE_URL}/api/props/kalshi-quote", json={"tickers": ["KXNBAREB-FAKE-AAA-10", "KXNBAAST-FAKE-BBB-8"]}, timeout=40)
    print(r.status_code, r.text[:200])
    assert r.status_code in (400, 404, 502)
