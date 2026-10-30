"""Regression: live combo quotes are requested at $10 size (TD scanner + parlay kalshi-quote)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
GAME = "26OCT29SACNOP"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def td(s):
    r = s.get(f"{BASE_URL}/api/scanner/game/{GAME}?td_pts=20", timeout=120)
    assert r.status_code == 200
    p = next((p for p in r.json()["players"] if p["name"] == "Domantas Sabonis"), None)
    assert p, "Sabonis missing"
    c = next((c for c in p["combos"] if c["kind"] == "TD" or c.get("also_td")), None)
    assert c, "No TD combo for Sabonis"
    return c


# TD scanner uses $10 RFQ size
def test_td_size_is_10(td):
    assert "live" in td, td.get("error")
    assert td["live"]["size"] == {"target_cost_dollars": "10.00"}


# TD price in expected +2500..+4500 band (live game, wider sanity check)
def test_td_price_band(td):
    p = td["live"]["yes_price"]
    assert 0 < p < 1
    american = (1 - p) / p * 100
    print("TD yes_price", p, "american", round(american))
    assert 1500 <= american <= 6000


# Parlay kalshi-quote honours target_dollars=10
def test_kalshi_quote_size_10(s):
    d = s.get(f"{BASE_URL}/api/props/game/{GAME}", timeout=60).json()
    for p in d["players"]:
        m = {x["label"]: x["lines"] for x in p["markets"]}
        if m.get("Rebounds") and m.get("Assists") and len(m["Rebounds"]) > 1 and len(m["Assists"]) > 1:
            tickers = [m["Rebounds"][1]["ticker"], m["Assists"][1]["ticker"]]
            break
    else:
        pytest.skip("no lines")
    r = s.post(f"{BASE_URL}/api/props/kalshi-quote", json={"tickers": tickers, "target_dollars": 10}, timeout=60)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["size"] == {"target_cost_dollars": "10.00"}
    assert data["quotes"] >= 1 and 0 < data["yes_price"] < 1
