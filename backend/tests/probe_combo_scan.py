"""Manual probe: how many Kalshi MVE pages can be fetched before 429 (not a pytest test)."""
import asyncio, time, httpx, sys
sys.path.insert(0, "/app/backend")
from kalshi import KALSHI_BASE


async def main():
    cur, pages, n, t0 = None, 0, 0, time.time()
    async with httpx.AsyncClient(timeout=25) as c:
        for _ in range(60):
            p = {"mve_filter": "only", "status": "open", "limit": 1000}
            if cur:
                p["cursor"] = cur
            r = await c.get(f"{KALSHI_BASE}/markets", params=p)
            tries = 0
            while r.status_code == 429 and tries < 5:
                tries += 1; await asyncio.sleep(2 * tries); r = await c.get(f"{KALSHI_BASE}/markets", params=p)
            if r.status_code != 200:
                print("status", r.status_code, "after pages", pages, "secs", round(time.time() - t0, 1))
                return
            d = r.json(); pages += 1; n += len(d.get("markets", []))
            cur = d.get("cursor"); await asyncio.sleep(0.25)
            if not cur:
                break
    print("done pages", pages, "markets", n, "secs", round(time.time() - t0, 1), "more:", bool(cur))

asyncio.run(main())
