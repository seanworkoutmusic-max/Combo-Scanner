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
