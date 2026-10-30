import asyncio
import base64
import os
import time
import httpx
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, ed25519
from kalshi import KALSHI_BASE

COLLECTION = "KXMVECROSSCATEGORY-R"
_key = {"pem": None, "obj": None}
_quotes = {}


class KalshiAuthError(Exception):
    pass


def configured():
    return bool(os.environ.get("KALSHI_API_KEY_ID", "").strip() and os.environ.get("KALSHI_PRIVATE_KEY", "").strip())


def _private_key():
    pem = os.environ.get("KALSHI_PRIVATE_KEY", "").strip().replace("\\n", "\n")
    if _key["pem"] != pem:
        try:
            if "-----BEGIN" in pem:
                obj = serialization.load_pem_private_key(pem.encode(), password=None)
            else:  # bare base64 key body (no PEM header lines)
                obj = serialization.load_der_private_key(base64.b64decode("".join(pem.split())), password=None)
            _key.update(pem=pem, obj=obj)
        except ValueError as e:
            raise KalshiAuthError(f"Kalshi private key could not be read: {e}")
    return _key["obj"]


def _headers(method, path):
    ts = str(int(time.time() * 1000))
    msg = f"{ts}{method}/trade-api/v2{path}".encode()
    key = _private_key()
    if isinstance(key, ed25519.Ed25519PrivateKey):
        sig = key.sign(msg)
    else:
        sig = key.sign(msg, padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=padding.PSS.DIGEST_LENGTH), hashes.SHA256())
    return {"KALSHI-ACCESS-KEY": os.environ["KALSHI_API_KEY_ID"].strip(), "KALSHI-ACCESS-SIGNATURE": base64.b64encode(sig).decode(),
            "KALSHI-ACCESS-TIMESTAMP": ts, "Content-Type": "application/json"}


async def _call(client, method, path, **kw):
    r = await client.request(method, f"{KALSHI_BASE}{path}", headers=_headers(method, path.split("?")[0]), **kw)
    if r.status_code == 401:
        raise KalshiAuthError("Kalshi rejected the API key (401). Check the key ID and private key.")
    if r.status_code >= 400:
        raise KalshiAuthError(f"Kalshi {method} {path.split('?')[0]} failed ({r.status_code}): {r.text[:200]}")
    return r.json() if r.content else {}


def _f(v):
    return float(v) if v not in (None, "") else None


async def live_combo_quote(tickers, contracts=10, wait=6.0, target_dollars=None):
    """Create the combo market, ask market makers for a quote (RFQ), read it, then cancel. Never accepts a quote."""
    key = (frozenset(tickers), target_dollars)
    hit = _quotes.get(key)
    if hit and time.time() - hit["t"] < 30:
        return hit["data"]
    legs = [{"market_ticker": t, "event_ticker": "-".join(t.split("-")[:2]), "side": "yes"} for t in tickers]
    size = {"target_cost_dollars": f"{target_dollars:.2f}"} if target_dollars else {"contracts_fp": str(contracts)}
    async with httpx.AsyncClient(timeout=20) as client:
        created = await _call(client, "POST", f"/multivariate_event_collections/{COLLECTION}",
                              json={"selected_markets": legs, "with_market_payload": True})
        mt = created["market_ticker"]
        market = created.get("market") or {}
        rfq = await _call(client, "POST", "/communications/rfqs",
                          json={"market_ticker": mt, **size, "rest_remainder": False, "replace_existing": True})
        quotes, polls, deadline = [], 0, time.time() + wait
        try:
            while time.time() < deadline:
                await asyncio.sleep(1.0)
                polls += 1
                quotes = (await _call(client, "GET", f"/communications/quotes?rfq_id={rfq['id']}&rfq_user_filter=self")).get("quotes", [])
                quotes = [q for q in quotes if q.get("status") == "open" and _f(q.get("no_bid_dollars"))]
                if len(quotes) >= 3 and polls >= 2:
                    break
        finally:
            try:
                await _call(client, "DELETE", f"/communications/rfqs/{rfq['id']}")
            except KalshiAuthError:
                pass
    def _size(q, price):
        n = _f(q.get("yes_contracts_fp")) or _f(q.get("contracts_fp"))
        if n:
            return n
        return round(target_dollars / (price + 0.07 * price * (1 - price)), 2) if target_dollars else float(contracts)

    ladder = sorted(
        ({"price": round(1 - _f(q["no_bid_dollars"]), 4),
          "contracts": _size(q, 1 - _f(q["no_bid_dollars"]))} for q in quotes),
        key=lambda x: x["price"])
    book_ask = _f(market.get("yes_ask_dollars"))
    data = {"market_ticker": mt, "yes_price": ladder[0]["price"] if ladder else None, "quotes": len(quotes), "ladder": ladder,
            "size": size, "book_yes_ask": book_ask if book_ask and 0 < book_ask < 1 else None, "fetched_at": time.time()}
    if quotes:
        _quotes[key] = {"t": time.time(), "data": data}
    return data
