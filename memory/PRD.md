# Combo Builder (formerly COMBOS / ODDSKING) – Kalshi NBA prop / combo EV tool

## Original problem
EV software that devigs Kalshi combos for double-doubles and triple-doubles (10+ pts/reb/ast) against the sportsbook average. Later: a player-page and bet-slip UI (like OddsJam) where you add NBA player props and see the Kalshi price in American odds; ESPN player photos.

## User choices
- Wanted real book SGP prices (OpticOdds), but has NO API key, so book odds are typed in by hand.
- Kalshi prices pulled live (public API). Devig method can be switched (mult/add/power/worst). EV % only, no bet sizing.

## Architecture
- Backend FastAPI: kalshi.py (DD/TD loader), kalshi_props.py (all player-prop series plus a background combo-market index), espn.py (roster headshots), optic.py (OpticOdds SGP engine, idle without a key), devig.py.
- Endpoints: /api/props/games, /api/props/game/{code}, /api/props/slip, /api/games, /api/scan, /api/combo, /api/status.
- Frontend: Player Props page (game strip, player list with photos, market accordion, bet slip with Straight/Parlay tabs and manual book odds), DD/TD Scanner tab.

## Implemented (2026-10)
- Live Kalshi prop lines for Points, Rebounds, Assists, Threes, PRA, PR, PA, RA, DD, TD, Steals, Blocks, SB and FTM, shown in American odds or cents.
- Parlay Kalshi price, in this order: a live Kalshi RFQ quote (using the user's Kalshi API key: create the combo market, read market-maker quotes, cancel the RFQ, never accept), then the live exact combo market, then the legs multiplied together. The manual Kalshi odds box was removed.
- American odds only. App renamed ODDSKING.
- Manual book odds produce a devigged average and EV after Kalshi fees.
- ESPN headshots.


## Implemented (2026-10-30)
- TD Scanner (triple-doubles only): live Kalshi RFQ combo for N+ pts (10/15/20) & 10+ reb & 10+ ast, $10 quote size, FanDuel/DraftKings boxes, EV.
- The Odds API (ODDS_API_KEY, free plan): player_triple_double Yes odds for FanDuel/DraftKings auto-fill the boxes at 10+ pts (odds_api.py, 5-min cache per game, events list cached 10 min).
- TD Leaders page: ESPN season averages, TD Score = min(pts, reb, ast), blue heat on the sorted column, ESPN injury tags (OUT/Q).
- Black/white theme, sidebar, team logos, ESPN headshots, Combo Builder branding.

## Backlog
- P1: OpticOdds or another odds feed to autofill book odds, once the user has a key.
- P1: correlation-aware Kalshi combo estimate.
- P2: saved bets and history, alerts for +EV.

## 2026-10-30
- TD Scanner game tabs now come from /api/scanner/games: full NBA schedule (today+tomorrow ET, from Odds API free events list) merged with Kalshi open games. Games without Kalshi props still load FD/DK TD odds. Tabs show day + tip time. Manual refresh only (user choice). Injury tweet scanner: user cancelled.
- TD Scanner: if Kalshi has no exact N+ points line, the TD combo uses the next higher Kalshi points line (e.g. Jokic 20+), labelled "(lowest Kalshi line)" and EV hidden.
- TD Scanner is now ONE board (/api/scanner/board): all Kalshi games, only players with both a live Kalshi TD combo and FD/DK TD odds, sorted by EV (bet Kalshi, fair from devigged books). No game tabs, no TD points select. If no 10+ pts Kalshi line, uses lowest Kalshi points line, flagged amber with approx EV. /api/scanner/games still exists (unused by scanner).
- OddsBlaze (ODDSBLAZE_API_KEY) integrated: backend/oddsblaze.py prices exact-leg SGPs (Over threshold-0.5 alt lines) on DraftKings (FanDuel NBA returns 404 on trial; auto-fills if available). Board has TD points select (10/15/20), columns FD TD, DK TD, DK SGP (FD SGP appears if data), EV uses SGP fair (same hold) else TD odds for exact 10+ combos. Odds API calls limited to 2 concurrent to avoid 429.
- OddsBlaze has NO FanDuel (not in sportsbooks.oddsblaze.com list). SGP-capable books: bally-bet, betmgm, betparx, betrivers, caesars, draftkings, fanatics, hard-rock, novig, prophetx etc. 15+/20+ board shows only DK SGP (no FD/DK TD columns, Odds API not called).
- Fanatics SGP added (oddsblaze BOOKS "fanatics"->"fan", column "Fanatics SGP", /fanatics.png). EV fair = average of all available SGP books.
- Player Props builder: POST /api/props/sgp {tickers} returns OddsBlaze SGP prices (dk, fan) for the slip legs (same game only; markets: pts/reb/ast/3PM/PRA/PR/PA/RA/stl/blk/DD/TD). Frontend auto-fills DraftKings SGP input when slip changes; Kalshi live quote auto-runs as before.
- Live Tracker page (tab "live", lucide Crosshair icon): GET /api/live-tracker (ESPN scoreboard+summary, 15s cache) lists players in games in progress, ranked by stats needed for 10/10/10; auto-refresh 30s. Test hook: ?date=YYYYMMDD&final=1 on frontend URL / include_final=true on API.
- TD Scanner picker adds 2-leg combos: /api/scanner/board?ra=10|8 (Rebounds ra + Assists ra, SGP only, no Odds API).
- Scanner picker also has 10+/15+ pts & 8+ reb & 8+ ast (values p10ra8/p15ra8 -> /api/scanner/board?td_pts=N&ra=8). td_pts now optional; Odds API TD odds only used at pts10+reb/ast10.
- Bet Tracker: "+" button left of each TD Scanner row saves combo (locked Kalshi price, book/SGP prices, EV, stake from localStorage bet-stake default $10) to Mongo "bets" via /api/bets (GET/POST, PATCH /{id} status pending|won|lost|void, DELETE). Bet Tracker page (tab "bets"): stats (count, W-L, pending, profit, ROI, avg EV), manual Won/Lost/Void, delete, stake input. Code: backend/bets.py, frontend/src/pages/BetTracker.js.
- Auto grading: POST /api/bets/grade (run when Bet Tracker opens) grades pending bets whose ESPN game is final (espn.final_box): all legs hit -> won, else lost, player DNP/absent -> void; sets auto_graded=True (manual PATCH resets to False). Supports Points/Rebounds/Assists/3PM/Steals/Blocks/PRA/PR/PA/RA legs.
- TD Scanner Min/Max odds inputs filter loaded rows by Kalshi combo American odds (fee-adjusted when fees on); not persisted.
- Bet Tracker: Result column (manual Won/Lost/Void) removed per user; grading only from ESPN (on open + "Grade from ESPN" button bet-grade-btn). Profit cell shows status label. PATCH endpoint still exists but unused.
- kalshi_auth._private_key accepts bare base64 (DER/PKCS8, e.g. Ed25519 "MC4CAQAw...") keys without PEM headers, in addition to PEM.
- Odds API monthly credits hit 0 on Oct 30 (401 on odds calls) -> FD/DK TD columns empty until renewal; SGP (OddsBlaze) unaffected.
- Live Tracker "Need (RA)" = rebounds + assists still needed to reach 10/10 (points ignored); shows "10/10" when hit.
- Bet Tracker live grading: POST /api/bets/grade uses espn.game_box (in/post games); all legs hit -> won immediately (even mid-game), final miss -> lost, final DNP -> void; stores result_stats; returns live {bet_id: {clock, stats}}. UI shows only live game clock under combo (leg stat chips removed per user). Updates only on page open / Grade from ESPN button.
- Scanner picker adds 4+ reb & 4+ ast (ra ge=3). Board RFQ concurrency raised 2->6 and quoting capped at 45s (asyncio.wait, late cancelled) to stay under 60s proxy limit.
- Hockey Scanner (2026-10-31): /app/backend/nhl.py + GET /api/hockey/board. Kalshi series KXNHLGAME (ML), KXNHLGOAL (1+), KXNHLPTS (2+), KXNHLTOTAL (main = mid closest to 50%). Combo collection KXMVECROSSCATEGORY-R accepts NHL legs. OddsBlaze league=nhl live=false, markets Moneyline/Total Goals/Player Goals(0.5)/Player Points(1.5); abbr ALIAS NAS->NSH, MON->MTL, WAS->WSH; games keyed (ET date, away, home). SGP posts rate-limited (429) -> _price retries, no caching failures, sem 4. Per-row pipeline (SGP then RFQ), 40s budget, rows sorted by goal-market price. Frontend /pages/HockeyScanner.js, sidebar tab hockey (Disc icon). No + track button (user choice).
- Hockey: ESPN NHL headshots (nhl.headshots from team rosters). Caesars added to SGP_BOOKS (czr) but Caesars SGP rejects goal+points same player ("Cannot be combined") so column auto-hides when empty. Books priced in parallel per row with per-book semaphore(3).
- TD Scanner SGP books: dk, fan, mgm (betmgm), hr (hard-rock) via oddsblaze.BOOKS (fd still listed, 404). /props/sgp limited to dk,fan. sgp_prices(timeout) deadline 25s + quote deadline to 50s total. Wide boards (6+/4+ ra) ~50s and partial; refresh fills more.
- Bet Tracker shows today only: GET /api/bets filters game_code prefix = ET date (rolls at 6am ET). 65 Oct-30 bets deleted per user (2026-10-31). Older bets stay in DB but hidden.
- TD Scanner Live mode (2026-11-01): GET /api/scanner/board?live=true -> only ESPN in-progress games (espn.game_box), OddsBlaze live feed (no live param, filter e.live; 20s caches), combos already hit hidden, combos[0].now {clock, Points, Rebounds, Assists}. Frontend Pregame/Live switch (scanner-mode-pregame/live), live-now-{slug} stats line, red clock under game. Manual Refresh only.
