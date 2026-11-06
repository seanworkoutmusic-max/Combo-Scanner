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
- 2026-11-02: App renamed "Edge Scanner" (later "Prop Outliers", 2026-11-02) (sidebar + <title>), Player Props tab label -> "Parlay Builder", Hockey Scanner removed from frontend (HockeyScanner.js deleted, tab/route/api fn removed; backend /api/hockey/board + nhl.py still exist, unused).
- TD Scanner "Market Avg" column (left of EV): straight average of the books EV uses (SGP books; or FD/DK TD odds when no SGP at 10+ pts), implied-prob averaged with hold kept, shown American. testid market-avg-{slug}.
- TD Scanner combo picker is now a "Filter" multi-select dropdown (components/props/ComboFilter.js, testids combo-filter-btn, combo-filter-{key}, combo-filter-apply, combo-filter-all; applies on close). 1 combo = single board; 2+ = sequential multi-board; frontend loads /api/scanner/board per combo sequentially (progress all-combos-progress), keeps each player best-EV combo, legs label combo-label-{slug}. Loads on entering All + Refresh only.
- TD Scanner loads nothing until Refresh is clicked; changing filter/Pregame-Live clears the board (cancels in-flight) and waits for Refresh.
- TD Scanner hides rows already tracked in Bet Tracker (today).
- Shareable /sean page (pages/SharedBets.js): read-only today bets (no stake/profit/delete), stats Plays/Record/Pending/Avg EV, live clocks via gradeBets; App.js picks tab "sean" from pathname, sidebar nav pushes "/" (popstate handled). testids shared-bets-page, shared-bet-row-*, shared-bet-result-*, shared-stat-*.
- Bet Tracker "Share link" button (bet-share-btn) copies {origin}/sean to clipboard with toast (prompt fallback).
- Live Tracker renamed "In-Game Tracker" (sidebar+heading). My Bets column (live-mybets-{slug}) shows today tracked bets matched by normalized player name with leg progress (green when hit) and status; "Only my bets" toggle (live-mine-toggle).
- In-Game Tracker: "Only my bets" toggle replaced by tabs All Players | My Bets (live-tab-all, live-tab-mine with count); My Bets column only shown on My Bets tab.
- TD Leaders tab removed from sidebar/App (TDWatch.js file + /api/td-leaders still exist, unused). In-Game Tracker tabs are text-only.
- TD Scanner: ScanReady (Ready when you are + "Scan combos" button, scanner-scan-btn) before first scan; ScanLoader animated shining card (PROP OUTLIERS / TD SCANNER, rotating step pill, dots, multi-combo progress) while loading with no rows (components/props/ScanStage.js, CSS scan-* in index.css).
- Scanner title "Kalshi SGP Scanner" with emerald Search icon (scanner-title). Filter dropdown now 3 columns: Combos | Odds (min/max, instant, odds-min-input/odds-max-input/odds-clear-btn) | Books (Kalshi only, book-filter-kalshi, checked+disabled); trigger shows odds range.
- Parlay Builder slip: removed refresh quote button + source/market-maker text + Fair/Kalshi verdict boxes; Kalshi row (kalshi.png) added above DraftKings/Fanatics in SGP odds list; single EV box (parlay-ev); Bet on Kalshi button emerald. Scanner filter combos show small NBA logo (/nba.png).
- Parlay Builder: Kalshi logo = user-provided green Kalshi wordmark (/kalshi.png), Fanatics = user Fanatics Sportsbook logo (/fanatics-sb.png, parlay only); Kalshi row same style as other books; Show liquidity removed.
- Rebrand: dolphin logo (/logo.png, also favicon), accent color dolphin #3870df (tailwind colors.dolphin DEFAULT/light/dark/pale) on Scan combos, Bet on Kalshi, checkboxes, page icons, loader card, slip badge; EV/won stays green. Sidebar shows logo only (h-10). Scanner title search icon white.
- Scanner loading card: "PROP OUTLIERS" text replaced by the dolphin jumping in an arc out of animated waves (scan-dolphin, scan-wave CSS).
- 2026-11-02: Navy theme site-wide (tailwind slate palette navy-tinted, bg hexes #071226 page/#0D1B33 cards/#0A1730 inputs/#0F1F3A popovers, CSS vars). Scanner: stat cards (stat-games/books/best/plus-ev) + Tonight's slate cards (slate-game-{code}, slate-status-{code}, slate-scan-{code}) via components/props/ScannerOverview.js; backend /api/scanner/board?game=CODE scans one game. Refresh button renamed "Refresh odds" (outlined blue); Pregame/Live active = dolphin blue. Sidebar "Kalshi" label removed. Deploy blocked by Emergent phishing classifier (deployment c17901c6...) -> user to email support@emergent.sh.
- Scanner hero ScanReady redesigned: dolphin, "Ready to dive in?", "Scan all N games" (scanner-scan-btn, N = slate size), 1-2-3 steps (scanner-step-*), waves. Slate cards moved below board, "Scan this game" buttons removed (status only; all show Scanning… during full scan).
- Scanner empty-board bug: OddsBlaze key 401 (trial ended) -> no SGP -> no EV rows. Added oddsblaze.status key_rejected -> board books.sgp_key_rejected + amber banner sgp-key-warning. New key saved 2026-11-02.
- 2026-11-03: Reverted to black minimalist theme: neutral slate palette, #121212/#181818/#0E0E0E/#141414 bgs, gray CSS vars, emerald accents (dolphin color removed from tailwind), outline basketball logo restored from git a5458cf (logo.png, favicon), loader card back to PROP OUTLIERS text, hero "Ready when you are" without dolphin/waves (steps + Scan all games kept). Refresh odds = white button.
- 2026-11-03: Accents now white/gray (buttons bg-white text-slate-950, white checkboxes, white page icons, Pregame active white); EV/won green & loss red kept. Shiny card loader replaced by Loader2 spinner + rotating status text (scanner-spinner, scanner-loading-step). Top-row green glow removed.

## 2026-06 (fork)
- Verified black/white/gray minimalist theme across Parlay Builder, SGP Scanner (start panel), In-Game Tracker, /sean on new fork. No code changes.
- OddsBlaze Starter plan key saved via secure card. Added sliding-window limiters in oddsblaze.py (29 SGP/min, 290 total/min); SGP price cache 300s pregame / 60s live.
- Renamed site from "Prop Outliers" to "Kalshi Combo Scanner" (browser tab title + logo alt text).
- SGP Scanner is now first in sidebar and the default landing page. Each page has its own URL: /kalshi (scanner, "/" redirects here), /parlay, /live, /bets, /sean. Dotted grid background on scanner/live/bets. Active sidebar item has outline.
- SGP Scanner filters moved from dropdown to a left Filters panel (Market, Combos, Odds range, Min EV 0/3/5/10, Sport, Books, Reset). Combos apply when Scan/Refresh is pressed; odds & Min EV apply instantly. Active filter chips row under title. On mobile panel stacks above results and 1/2/3 steps are hidden.
- Reverted the left Filters panel on SGP Scanner back to the Filter dropdown (user preferred dropdown).
- Fix (SGP pricing under 30/min plan): prices finish in background and are cached; refresh serves last known price (<=30min) while re-pricing; round-robin book order; Kalshi quotes run in parallel with SGP pricing and fall back to last quote; sgp_pending note on scanner. Tested iteration_16 (100%).
- SGP Scanner now uses FanDuel only (SGP via OddsBlaze books={"fd"} + FD triple-double odds) as sole devig source; columns: Kalshi, FanDuel, EV.
- Reverted FanDuel-only devig; SGP Scanner uses FD, DK, Fanatics, BetMGM, Hard Rock again.
- Added "Load more book odds" button on SGP Scanner (POST /api/scanner/sgp-fill): re-prices only plays already on the board, requests jump ahead of background queue (priority limiter). Tested iteration_17; malformed legs now 422.
- Fix "SGP scanner not loading": OddsBlaze limiter serves newest scan first (_gen priority), board total time budget from request start (<50s), Odds API failures cached 5 min (ODDS_API_KEY out of credits -> 401), clearer empty state when prices queued. Tested iteration_18 (100%).
- Added Results page (/results, TrendingUp icon): all tracked bets across all days (GET /api/bets/all), running profit chart, Bets/Record/Profit/ROI/Avg EV, Book filter (EV from that book alone) and Combo filter. Tested iteration_19.
- Results page: removed Book filter (uses all tracked bets, book avg), added Units/Dollars toggle (1u = $10), hid x-axis numbers, removed dotted background on Results. Added 2 user bets (Nov 4): Myles Turner 6+reb/6+ast +9252 $10 (won 9/6), Alperen Sengun 10/10/10 TD +1490 $10 (won 17/12/10).
- Results: multi-select combo filter with checkboxes + NBA logos; green cumulative returns chart (day by day). Kalshi one-click links now open /combos/games/<away>-at-<home>/props.
- Scanner shows a green "Tracked" badge next to a player who already has a tracked bet today (any combo); hover lists the tracked combos.
- Results renamed to Performance (tab, page title, path /performance; /results still works). Chart title removed; dotted square grid background.
- Performance graph now plots a point after every settled bet (sorted by game day, then time tracked); date labels only where a new day starts; tooltip shows player and that bet result.
- Reverted Performance graph to day-by-day. Bet Tracker game cell now one-click links to Kalshi /combos/games/<away>-at-<home>/props.
