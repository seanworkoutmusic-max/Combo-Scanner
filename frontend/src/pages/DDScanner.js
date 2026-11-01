import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, ExternalLink, Plus, Check } from "lucide-react";
import { getScannerBoard, getBets, addBet, errMsg } from "../lib/api";
import { getStake } from "./BetTracker";
import { probToAmerican } from "../lib/ev";

const parseOdds = (v) => (v.trim() === "" || Number.isNaN(Number(v)) ? null : Number(v));
const OddsInput = ({ label, value, onChange, testid }) => (
  <label className="flex items-center gap-2 text-sm text-slate-400">
    {label}
    <input data-testid={testid} value={value} onChange={(e) => onChange(e.target.value)} placeholder={label === "Min odds" ? "+500" : "+3000"} inputMode="numeric"
      className="h-8 w-24 px-2.5 rounded-lg border border-slate-700 bg-[#0E0E0E] font-mono text-sm font-semibold text-white outline-none focus:border-white/60 placeholder:text-slate-600" />
  </label>
);
import { PlayerPhoto } from "../components/props/PlayerPhoto";
import { GameLabel } from "../components/props/TeamLogo";
import { PriceTag } from "../components/props/MarketList";
import { kalshiGameUrl, americanToProb, devigOneSided, evPct } from "../lib/slip";

const BOOKS = [["fd", "FanDuel"], ["dk", "DraftKings"]];
const SGP_BOOKS = [["fd", "FD"], ["dk", "DK"], ["fan", "Fanatics"], ["mgm", "BetMGM"], ["hr", "Hard Rock"]];
const HEAD_LOGOS = { FD: "/fd.png", DK: "/dk.png", "FD Manual": "/fd.png", "DK Manual": "/dk.png", "Fanatics Manual": "/fanatics.png", "BetMGM Manual": "/betmgm.png", "Hard Rock Manual": "/hardrock.png" };

const fmt = (v) => (v == null ? null : v > 0 ? `+${v}` : `${v}`);

const fairFrom = (books, hold) => {
  const ps = Object.values(books || {}).map((v) => americanToProb(fmt(v))).filter((p) => p != null).map((p) => devigOneSided(p, hold));
  return ps.length ? ps.reduce((a, x) => a + x, 0) / ps.length : null;
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

const Row = ({ r, format, i, tdPts, sgpBooks, tdBooks, tracked, onTrack }) => {
  const slug = r.key.replace(/\s/g, "-");
  const legs = r.combos[0].legs;
  return (
    <tr data-testid={`scanner-row-${slug}`} style={{ animationDelay: `${i * 30}ms` }} className="row-in border-t border-slate-800/70 hover:bg-white/[0.03] transition-colors">
      <td className="py-3 px-4 sticky left-0 z-10 bg-[#181818]">
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
        {legs[0].market === "Points" && legs[0].threshold !== tdPts && <div data-testid={`td-leg-note-${slug}`} className="text-[10px] font-mono text-amber-400">{legs[0].threshold}+ pts (lowest Kalshi line)</div>}
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
  const [pick, setPick] = useState("10");
  const [live, setLive] = useState(false);
  const [minOdds, setMinOdds] = useState("");
  const [maxOdds, setMaxOdds] = useState("");
  const [, ptsStr, raStr] = pick.match(/^(?:p?(\d+))?(?:ra(\d+))?$/);
  const tdPts = ptsStr ? Number(ptsStr) : null;
  const ra = raStr ? Number(raStr) : null;
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      const d = await getScannerBoard({ td_pts: tdPts || undefined, ra: ra || undefined, live: live || undefined });
      if (id === reqId.current) setData(d);
    } catch (e) {
      if (id === reqId.current) toast.error(errMsg(e));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [ra, tdPts, live]);

  useEffect(() => { setData(null); load(); }, [load]);

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
    const fair = hasSgp ? fairFrom(p.sgp, settings.singleHold) : !ra && p.combos[0].legs[0].market === "Points" && p.combos[0].legs[0].threshold === 10 ? fairFrom(p.books, settings.singleHold) : null;
    return { ...p, price, ev: evPct(fair, price, settings.fees) };
  }).filter((r) => r.ev != null).sort((a, b) => b.ev - a.ev), [data, settings.singleHold, settings.fees]);
  const lo = parseOdds(minOdds), hi = parseOdds(maxOdds);
  const shown = rows.filter((r) => {
    const a = probToAmerican(settings.fees ? Math.min(r.price + 0.07 * r.price * (1 - r.price), 0.999) : r.price);
    return a != null && (lo == null || a >= lo) && (hi == null || a <= hi);
  });
  const sgpBooks = SGP_BOOKS.filter(([b]) => rows.some((r) => r.sgp?.[b] != null));
  const tdBooks = tdPts === 10 && !ra && !live ? BOOKS : [];
  const heads = ["Player", "Game", "Kalshi Combos", ...tdBooks.map(([b]) => b.toUpperCase()), ...sgpBooks.map(([, l]) => `${l} Manual`), "EV"];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">Triple-double scanner</h1>
          <p className="text-sm text-slate-400 mt-1">Every game on one board: live Kalshi triple-double combos, ranked by EV against devigged sportsbook odds.</p>
          <p data-testid="scanner-updated" className="text-sm font-semibold text-white mt-1">
            {data ? `Updated ${new Date(data.updated_at).toLocaleTimeString()} · ${shown.length === rows.length ? rows.length : `${shown.length} of ${rows.length}`} combos across ${data.games} games` : loading ? "Pricing combos with Kalshi market makers…" : ""}
          </p>
        </div>
        <button data-testid="scanner-refresh-btn" onClick={load} disabled={loading}
          className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white text-slate-950 text-sm font-semibold hover:bg-slate-200 disabled:opacity-50 transition-colors">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="flex items-center gap-5 flex-wrap">
      <div data-testid="scanner-mode" className="flex rounded-lg border border-slate-700 bg-[#0E0E0E] p-0.5">
        {[["pregame", "Pregame"], ["live", "Live"]].map(([k, l]) => (
          <button key={k} data-testid={`scanner-mode-${k}`} onClick={() => setLive(k === "live")}
            className={`flex items-center gap-1.5 h-7 px-3 rounded-md text-sm font-semibold transition-colors ${(k === "live") === live ? "bg-white text-slate-950" : "text-slate-400 hover:text-white"}`}>
            {k === "live" && <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-red-500 animate-pulse" : "bg-red-500/60"}`} />}{l}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-400">
        Combo
        <select data-testid="td-points-select" value={pick} onChange={(e) => setPick(e.target.value)}
          className="h-8 pl-2.5 pr-7 rounded-lg border border-slate-700 bg-[#0E0E0E] text-sm font-semibold text-white outline-none focus:border-white/60 cursor-pointer">
          {[10, 15, 20, 25].map((n) => <option key={n} value={String(n)}>{n}+ pts triple-double</option>)}
          {[10, 15].map((n) => <option key={`p${n}`} value={`p${n}ra8`}>{n}+ pts &amp; 8+ reb &amp; 8+ ast</option>)}
          {[10, 8, 6, 4].map((n) => <option key={n} value={`ra${n}`}>{n}+ reb &amp; {n}+ ast</option>)}
        </select>
      </label>
        <OddsInput label="Min odds" value={minOdds} onChange={setMinOdds} testid="odds-min-input" />
        <OddsInput label="Max odds" value={maxOdds} onChange={setMaxOdds} testid="odds-max-input" />
        {(minOdds || maxOdds) && (
          <button data-testid="odds-clear-btn" onClick={() => { setMinOdds(""); setMaxOdds(""); }} className="text-xs text-slate-400 hover:text-white underline underline-offset-2">Clear</button>
        )}
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#181818] overflow-x-auto">
        <table data-testid="scanner-board" className="w-full min-w-[1000px]">
          <thead>
            <tr className="text-xs text-slate-400">
              {heads.map((h, i) => (
                <th key={h} className={`py-3 font-semibold ${i ? "px-4 text-right" : "px-4 text-left sticky left-0 z-10 bg-[#181818]"}`}>
                  {HEAD_LOGOS[h] ? (
                    <span className="inline-flex items-center gap-1.5">
                      <img data-testid={`logo-${h.toLowerCase()}`} src={HEAD_LOGOS[h]} alt="" className="h-4 w-4 rounded-[3px]" />{h}
                    </span>
                  ) : h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => <Row key={`${r.game.code}-${r.key}`} r={r} i={i} format={format} tdPts={tdPts} sgpBooks={sgpBooks} tdBooks={tdBooks}
              tracked={tracked.has(betKey(r.game.code, r.combos[0].legs))} onTrack={onTrack} />)}
          </tbody>
        </table>
        {!data && (
          <div data-testid="scanner-loading" className="py-16 text-center text-sm text-slate-500">
            {loading ? "Asking Kalshi market makers for live combo odds across every game… (10–30 seconds)" : ""}
          </div>
        )}
        {data && rows.length > 0 && !shown.length && (
          <div data-testid="scanner-odds-empty" className="py-16 text-center text-sm text-slate-500">No combos between those odds. Widen the range or clear it.</div>
        )}
        {data && !rows.length && (
          <div data-testid="scanner-empty" className="py-16 text-center text-sm text-slate-500">
            {live ? "No games in progress with live Kalshi combos and live sportsbook SGP prices right now."
              : "No player has both a live Kalshi combo and a FanDuel/DraftKings price right now. Books usually post these on game day."}
          </div>
        )}
      </div>
      <p className="text-xs text-slate-500 leading-relaxed max-w-3xl">
        {live && "Live mode: only games in progress, with in-game Kalshi and SGP prices and each player's current box score; combos already hit are hidden. "}
        Kalshi Combos is the live combo price for {`${tdPts ? `${tdPts}+ points, ` : ""}${ra || 10}+ rebounds and ${ra || 10}+ assists`}{settings.fees ? " (fee included)" : ""}. When Kalshi has no {tdPts}+ points
        line, the player's next Kalshi points line is used (shown in amber). SGP is the DraftKings/Fanatics/BetMGM/Hard Rock same-game-parlay price for the exact same legs as the Kalshi combo
        (FanDuel SGP isn't available from OddsBlaze).
        EV compares Kalshi to the SGP price with a {settings.singleHold}% hold removed (books averaged); without an SGP price it falls back to the regular
        "to record a triple-double" odds, only for 10+ point combos.
        {data?.books?.credits_left ? ` ${data.books.credits_left} Odds API credits left this month.` : ""}
      </p>
    </div>
  );
}
