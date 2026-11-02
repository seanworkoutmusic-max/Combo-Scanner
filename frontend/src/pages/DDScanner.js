import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, ExternalLink, Plus, Check, Search } from "lucide-react";
import { ComboFilter } from "../components/props/ComboFilter";
import { ScanLoader, ScanReady } from "../components/props/ScanStage";
import { SlateCards } from "../components/props/ScannerOverview";
import { getScannerBoard, getScannerGames, getBets, addBet, errMsg } from "../lib/api";
import { getStake } from "./BetTracker";
import { probToAmerican } from "../lib/ev";

const parseOdds = (v) => (v.trim() === "" || Number.isNaN(Number(v)) ? null : Number(v));
import { PlayerPhoto } from "../components/props/PlayerPhoto";
import { GameLabel } from "../components/props/TeamLogo";
import { PriceTag } from "../components/props/MarketList";
import { kalshiGameUrl, americanToProb, devigOneSided, evPct } from "../lib/slip";

const BOOKS = [["fd", "FanDuel"], ["dk", "DraftKings"]];
const SGP_BOOKS = [["fd", "FanDuel"], ["dk", "DraftKings"], ["fan", "Fanatics"], ["mgm", "BetMGM"], ["hr", "Hard Rock"]];
const HEAD_LOGOS = { FD: "/fd.png", DK: "/dk.png", FanDuel: "/fd.png", DraftKings: "/dk.png", Fanatics: "/fanatics.png", BetMGM: "/betmgm.png", "Hard Rock": "/hardrock.png" };

const fmt = (v) => (v == null ? null : v > 0 ? `+${v}` : `${v}`);

const fairFrom = (books, hold) => {
  const ps = Object.values(books || {}).map((v) => americanToProb(fmt(v))).filter((p) => p != null).map((p) => devigOneSided(p, hold));
  return ps.length ? ps.reduce((a, x) => a + x, 0) / ps.length : null;
};

// Straight average of the book prices (implied probability averaged, hold still in), as American odds.
const marketAvg = (books) => {
  const ps = Object.values(books || {}).map((v) => americanToProb(fmt(v))).filter((p) => p != null);
  return ps.length ? probToAmerican(ps.reduce((a, x) => a + x, 0) / ps.length) : null;
};

const EvCell = ({ ev, testid }) => (
  <div data-testid={testid} className={`font-mono text-sm font-bold ${ev > 0 ? "text-emerald-400" : "text-red-400"}`}>
    {`${ev > 0 ? "+" : ""}${(ev * 100).toFixed(1)}%`}
  </div>
);

const Odds = ({ v, testid }) => (
  <td data-testid={testid} className={`py-3 px-4 text-right font-mono text-sm ${v != null ? "text-white font-semibold" : "text-slate-600"}`}>{fmt(v) || "—"}</td>
);

const betKey = (code, legs) => `${code}|${legs.map((l) => l.ticker).join(",")}`;

const COMBOS = [
  ["10", "10+ pts triple-double"], ["15", "15+ pts triple-double"], ["20", "20+ pts triple-double"], ["25", "25+ pts triple-double"],
  ["p10ra8", "10+ pts & 8+ reb & 8+ ast"], ["p15ra8", "15+ pts & 8+ reb & 8+ ast"],
  ["ra10", "10+ reb & 10+ ast"], ["ra8", "8+ reb & 8+ ast"], ["ra6", "6+ reb & 6+ ast"], ["ra4", "4+ reb & 4+ ast"],
];
const LEG_SHORT = { Points: "PTS", Rebounds: "REB", Assists: "AST" };
const pickParams = (k) => {
  const [, p, r] = k.match(/^(?:p?(\d+))?(?:ra(\d+))?$/);
  return { td_pts: p ? Number(p) : undefined, ra: r ? Number(r) : undefined };
};

const Row = ({ r, format, i, tdPts, sgpBooks, tdBooks, tracked, onTrack }) => {
  const slug = r.key.replace(/\s/g, "-");
  const legs = r.combos[0].legs;
  return (
    <tr data-testid={`scanner-row-${slug}`} style={{ animationDelay: `${Math.min(i, 14) * 90}ms` }} className={`row-flip ${i < 3 ? "row-flip-top" : ""} border-t border-slate-800/70 hover:bg-white/[0.03] transition-colors`}>
      <td className="py-3 px-4 sticky left-0 z-10 bg-[#0D1B33]">
        <div className="flex items-center gap-3">
          <button data-testid={`track-bet-${slug}`} onClick={() => onTrack(r)} disabled={tracked} title={tracked ? "Tracked in Bet Tracker" : "Track this bet"}
            className={`h-8 w-8 shrink-0 grid place-items-center rounded-md border transition-colors ${tracked ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-400" : "border-slate-700 text-slate-400 hover:text-white hover:border-white/50 hover:bg-white/[0.05]"}`}>
            {tracked ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </button>
          <PlayerPhoto src={r.headshot} name={r.name} size={34} />
          <div className="leading-tight">
            <div className="text-sm font-semibold text-white whitespace-nowrap">{r.name}</div>
            {r.combos[0].now ? (
              <div data-testid={`live-now-${slug}`} className="text-[11px] font-mono text-slate-400 whitespace-nowrap">
                <span className="text-slate-500">{r.team}</span> · {r.combos[0].now.Points} PTS · {r.combos[0].now.Rebounds} REB · {r.combos[0].now.Assists} AST
              </div>
            ) : <div className="text-[11px] font-mono text-slate-500">{r.team}</div>}
          </div>
        </div>
      </td>
      <td className="py-3 px-4 text-right text-sm font-semibold text-slate-300 whitespace-nowrap">
        <a data-testid={`game-link-${slug}`} href={kalshiGameUrl(legs[0].ticker)} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 hover:text-white transition-colors">
          <GameLabel code={r.game.code} size={16} /><ExternalLink className="h-3 w-3 text-slate-500" />
        </a>
        {r.combos[0].now && (
          <div className="flex items-center justify-end gap-1 text-[10px] font-mono text-red-400"><span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />{r.combos[0].now.clock}</div>
        )}
      </td>
      <td className="py-3 px-4 text-right">
        <span data-testid={`td-${slug}`} className="font-mono text-base font-bold text-white"><PriceTag p={r.price} format={format} /></span>
        {r.comboLabel && <div data-testid={`combo-label-${slug}`} className="text-[10px] font-mono text-slate-400 whitespace-nowrap">{r.combos[0].legs.map((l) => `${l.threshold}+ ${LEG_SHORT[l.market] || l.market}`).join(" · ")}</div>}
        {legs[0].market === "Points" && legs[0].threshold !== (r.comboLabel ? r.pts : tdPts) && <div data-testid={`td-leg-note-${slug}`} className="text-[10px] font-mono text-amber-400">{legs[0].threshold}+ pts (lowest Kalshi line)</div>}
      </td>
      {tdBooks.map(([b]) => <Odds key={b} v={r.books[b]} testid={`${b}-td-${slug}`} />)}
      {sgpBooks.map(([b]) => <Odds key={b} v={r.sgp?.[b]} testid={`${b}-sgp-${slug}`} />)}
      <td className="py-3 px-4 text-right"><EvCell ev={r.ev} testid={`ev-td-${slug}`} /></td>
    </tr>
  );
};

export default function DDScanner({ settings }) {
  const format = settings.fees ? "fee" : "raw";
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scanId, setScanId] = useState(0);
  const [live, setLive] = useState(false);
  const [minOdds, setMinOdds] = useState("");
  const [maxOdds, setMaxOdds] = useState("");
  const [sel, setSel] = useState(["10"]);
  const [progress, setProgress] = useState(null);
  const selRef = useRef(sel);
  selRef.current = sel;
  const all = sel.length > 1;
  const selKey = sel.join();
  const { td_pts: tdPts, ra } = all ? {} : pickParams(sel[0]);
  const reqId = useRef(0);
  const [scanning, setScanning] = useState(null);
  const [scannedGames, setScannedGames] = useState(null);
  const [slate, setSlate] = useState(null);
  useEffect(() => {
    getScannerGames().then((gs) => {
      const k = gs.filter((g) => g.kalshi);
      setSlate(k.filter((g) => g.date === k[0]?.date));
    }).catch(() => setSlate([]));
  }, []);

  const load = useCallback(async (gameArg) => {
    const game = typeof gameArg === "string" ? gameArg : undefined;
    const id = ++reqId.current;
    setLoading(true);
    setScanning(game || "all");
    setScannedGames(game ? [game] : "all");
    try {
      if (all) {  // one board per chosen combo, loaded one after another (each must finish within the 60s proxy limit)
        const sel = COMBOS.filter(([k]) => selRef.current.includes(k));
        setProgress({ done: 0, total: sel.length });
        let acc = { players: [], games: 0, updated_at: new Date().toISOString() };
        setScanId(id);
        setData(acc);
        for (const [k, label] of sel) {
          try {
            const d = await getScannerBoard({ ...pickParams(k), live: live || undefined, game });
            if (id !== reqId.current) return;
            acc = { ...acc, games: Math.max(acc.games, d.games), updated_at: d.updated_at,
              players: [...acc.players, ...d.players.map((p) => ({ ...p, comboLabel: label, pts: pickParams(k).td_pts }))] };
            setData(acc);
          } catch (e) {
            if (id === reqId.current) toast.error(`${label}: ${errMsg(e)}`);
          }
          if (id === reqId.current) setProgress((pr) => ({ ...pr, done: pr.done + 1 }));
        }
        return;
      }
      const d = await getScannerBoard({ td_pts: tdPts || undefined, ra: ra || undefined, live: live || undefined, game });
      if (id === reqId.current) { setData(d); setScanId(id); }
    } catch (e) {
      if (id === reqId.current) toast.error(errMsg(e));
    } finally {
      if (id === reqId.current) { setLoading(false); setProgress(null); setScanning(null); }
    }
  }, [all, ra, tdPts, live, selKey]);

  useEffect(() => { reqId.current++; setData(null); setLoading(false); setProgress(null); setScanning(null); setScannedGames(null); }, [load]);

  const [tracked, setTracked] = useState(new Set());
  useEffect(() => {
    getBets().then((bs) => setTracked(new Set(bs.map((b) => betKey(b.game_code, b.legs))))).catch(() => {});
  }, []);
  const onTrack = async (r) => {
    const c = r.combos[0];
    const k = betKey(r.game.code, c.legs);
    setTracked((s) => new Set(s).add(k));
    try {
      await addBet({
        player: r.name, team: r.team, headshot: r.headshot, game_code: r.game.code, game_label: r.game.label, combo: c.name,
        legs: c.legs.map((l) => ({ ticker: l.ticker, market: l.market, threshold: l.threshold })),
        price: r.price, books: { ...r.books, ...Object.fromEntries(Object.entries(r.sgp || {}).map(([b, v]) => [`${b}_sgp`, v])) },
        ev: r.ev, stake: getStake(),
      });
      toast.success(`Tracked ${r.name} · ${c.name}`);
    } catch (e) {
      setTracked((s) => { const n = new Set(s); n.delete(k); return n; });
      toast.error(errMsg(e));
    }
  };

  const rows = useMemo(() => (data?.players || []).map((p) => {
    const price = p.combos[0].live.yes_price;
    const hasSgp = Object.keys(p.sgp || {}).length > 0;
    const legs = p.combos[0].legs;
    const td10 = legs.length === 3 && legs[0].market === "Points" && legs[0].threshold === 10 && legs[1].threshold === 10;
    const src = hasSgp ? p.sgp : td10 ? p.books : null;
    const fair = src ? fairFrom(src, settings.singleHold) : null;
    return { ...p, price, avg: src ? marketAvg(src) : null, ev: evPct(fair, price, settings.fees) };
  }).filter((r) => r.ev != null).sort((a, b) => b.ev - a.ev)
    .filter((r, i, arr) => !all || arr.findIndex((x) => x.key === r.key && x.game.code === r.game.code) === i),
  [data, settings.singleHold, settings.fees, all]);
  const lo = parseOdds(minOdds), hi = parseOdds(maxOdds);
  const ready = !data && !loading;
  const showLoader = loading && !rows.length;
  const shown = rows.filter((r) => {
    if (tracked.has(betKey(r.game.code, r.combos[0].legs))) return false;  // tracked plays leave the board
    const a = probToAmerican(settings.fees ? Math.min(r.price + 0.07 * r.price * (1 - r.price), 0.999) : r.price);
    return a != null && (lo == null || a >= lo) && (hi == null || a <= hi);
  });
  const sgpBooks = SGP_BOOKS.filter(([b]) => rows.some((r) => r.sgp?.[b] != null));
  const tdBooks = tdPts === 10 && !ra && !live ? BOOKS : [];
  const heads = ["Player", "Game", "Kalshi Combos", ...tdBooks.map(([b]) => b.toUpperCase()), ...sgpBooks.map(([, l]) => l), "EV"];
  const counts = {};
  (slate || []).forEach((g) => {
    if (data && !loading && (scannedGames === "all" || scannedGames?.includes(g.code))) counts[g.code] = rows.filter((r) => r.game.code === g.code).length;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 data-testid="scanner-title" className="flex items-center gap-3 font-display text-3xl sm:text-4xl font-bold tracking-tight"><Search className="h-8 w-8 text-dolphin-light" strokeWidth={2.5} /> Kalshi SGP Scanner</h1>
          <p className="text-sm text-slate-400 mt-1">Every game on one board: live Kalshi combos, ranked by EV against devigged sportsbook odds.</p>
          <p data-testid="scanner-updated" className="text-sm font-semibold text-white mt-1">
            {data ? `Updated ${new Date(data.updated_at).toLocaleTimeString()} · ${shown.length === rows.length ? rows.length : `${shown.length} of ${rows.length}`} combos across ${data.games} games` : loading ? "Pricing combos with Kalshi market makers…" : ""}
          </p>
        </div>
        <button data-testid="scanner-refresh-btn" onClick={() => load()} disabled={loading}
          className="flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-dolphin/60 bg-dolphin/10 text-white text-sm font-semibold hover:bg-dolphin/25 disabled:opacity-50 transition-colors">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh odds
        </button>
      </div>

      <div className="flex items-center gap-5 flex-wrap">
      <div data-testid="scanner-mode" className="flex rounded-lg border border-slate-700 bg-[#0A1730] p-0.5">
        {[["pregame", "Pregame"], ["live", "Live"]].map(([k, l]) => (
          <button key={k} data-testid={`scanner-mode-${k}`} onClick={() => setLive(k === "live")}
            className={`flex items-center gap-1.5 h-7 px-3 rounded-md text-sm font-semibold transition-colors ${(k === "live") === live ? "bg-dolphin text-white" : "text-slate-400 hover:text-white"}`}>
            {k === "live" && <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-red-500 animate-pulse" : "bg-red-500/60"}`} />}{l}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 text-sm text-slate-400">
        Filter
        <ComboFilter combos={COMBOS} value={sel} onChange={setSel} minOdds={minOdds} maxOdds={maxOdds} setMinOdds={setMinOdds} setMaxOdds={setMaxOdds} />
      </div>
        {progress && <span data-testid="all-combos-progress" className="text-xs font-mono text-slate-400">Loading {progress.done}/{progress.total} combos…</span>}
      </div>


      <div className="rounded-xl border border-slate-800 bg-[#0D1B33] overflow-x-auto">
        {ready ? <ScanReady onScan={() => load()} games={slate?.length} /> : showLoader ? <ScanLoader progress={progress} /> : (
        <table data-testid="scanner-board" className="w-full min-w-[1000px]">
          <thead>
            <tr className="text-xs text-slate-400">
              {heads.map((h, i) => (
                <th key={h} className={`py-3 font-semibold ${i ? "px-4 text-right" : "px-4 text-left sticky left-0 z-10 bg-[#0D1B33]"}`}>
                  {HEAD_LOGOS[h] ? (
                    <span className="inline-flex items-center gap-1.5">
                      <img data-testid={`logo-${h.toLowerCase()}`} src={HEAD_LOGOS[h]} alt="" className="h-4 w-4 rounded-[3px]" />{h}
                    </span>
                  ) : h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody key={scanId}>
            {shown.map((r, i) => <Row key={`${r.game.code}-${r.key}`} r={r} i={i} format={format} tdPts={tdPts} sgpBooks={sgpBooks} tdBooks={tdBooks}
              tracked={tracked.has(betKey(r.game.code, r.combos[0].legs))} onTrack={onTrack} />)}
          </tbody>
        </table>
        )}
        {data && !loading && rows.length > 0 && !shown.length && (
          <div data-testid="scanner-odds-empty" className="py-16 text-center text-sm text-slate-500">No combos between those odds. Widen the range or clear it.</div>
        )}
        {data && !loading && !rows.length && (
          <div data-testid="scanner-empty" className="py-16 text-center text-sm text-slate-500">
            {live ? "No games in progress with live Kalshi combos and live sportsbook SGP prices right now."
              : "No player has both a live Kalshi combo and a FanDuel/DraftKings price right now. Books usually post these on game day."}
          </div>
        )}
      </div>

      <SlateCards games={slate} counts={counts} scanning={scanning} />
    </div>
  );
}
