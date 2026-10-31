import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { getHockeyBoard, errMsg } from "../lib/api";
import { PriceTag } from "../components/props/MarketList";
import { PlayerPhoto } from "../components/props/PlayerPhoto";
import { americanToProb, devigOneSided, evPct } from "../lib/slip";

const SGP_BOOKS = [["dk", "DK Manual", "/dk.png"], ["fan", "Fanatics Manual", "/fanatics.png"], ["czr", "Caesars Manual", "/caesars.png"]];
const fmt = (v) => (v == null ? null : v > 0 ? `+${v}` : `${v}`);
const fairFrom = (books, hold) => {
  const ps = Object.values(books || {}).map((v) => americanToProb(fmt(v))).filter((p) => p != null).map((p) => devigOneSided(p, hold));
  return ps.length ? ps.reduce((a, x) => a + x, 0) / ps.length : null;
};

const Legs = ({ r }) => (
  <div className="text-[11px] font-mono text-slate-400 whitespace-nowrap">{r.team} ML · 1+ goal · 2+ pts · O{r.total}</div>
);

const Row = ({ r, i, format, books }) => {
  const slug = `${r.game.code}-${r.key.replace(/\s/g, "-")}`;
  return (
    <tr data-testid={`hockey-row-${slug}`} style={{ animationDelay: `${i * 30}ms` }} className="row-in border-t border-slate-800/70 hover:bg-white/[0.03] transition-colors">
      <td className="py-3 px-4 sticky left-0 z-10 bg-[#181818]">
        <div className="flex items-center gap-3">
          <PlayerPhoto src={r.headshot} name={r.name} size={34} />
          <div className="leading-tight">
            <div className="text-sm font-semibold text-white whitespace-nowrap">{r.name}</div>
            <Legs r={r} />
          </div>
        </div>
      </td>
      <td className="py-3 px-4 text-right text-sm font-semibold text-slate-300 whitespace-nowrap">
        {r.team} <span className="text-slate-500">vs</span> {r.opp}
      </td>
      <td className="py-3 px-4 text-right">
        <span data-testid={`hockey-kalshi-${slug}`} className="font-mono text-base font-bold text-white"><PriceTag p={r.price} format={format} /></span>
      </td>
      {books.map(([b]) => (
        <td key={b} data-testid={`hockey-${b}-${slug}`} className={`py-3 px-4 text-right font-mono text-sm ${r.sgp?.[b] != null ? "text-white font-semibold" : "text-slate-600"}`}>{fmt(r.sgp?.[b]) || "—"}</td>
      ))}
      <td className="py-3 px-4 text-right">
        <span data-testid={`hockey-ev-${slug}`} className={`font-mono text-sm font-bold ${r.ev > 0 ? "text-emerald-400" : "text-red-400"}`}>{`${r.ev > 0 ? "+" : ""}${(r.ev * 100).toFixed(1)}%`}</span>
      </td>
    </tr>
  );
};

export default function HockeyScanner({ settings }) {
  const format = settings.fees ? "fee" : "raw";
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      const d = await getHockeyBoard();
      if (id === reqId.current) setData(d);
    } catch (e) {
      if (id === reqId.current) toast.error(errMsg(e));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => (data?.players || []).map((p) => {
    const price = p.live.yes_price;
    return { ...p, price, ev: evPct(fairFrom(p.sgp, settings.singleHold), price, settings.fees) };
  }).filter((r) => r.ev != null).sort((a, b) => b.ev - a.ev), [data, settings.singleHold, settings.fees]);
  const books = SGP_BOOKS.filter(([b]) => rows.some((r) => r.sgp?.[b] != null));
  const heads = ["Player", "Game", "Kalshi Combos", ...books.map(([, l]) => l), "EV"];
  const logos = Object.fromEntries(SGP_BOOKS.map(([, l, src]) => [l, src]));

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">Hockey scanner</h1>
          <p className="text-sm text-slate-400 mt-1">NHL Kalshi combos: player's team wins, he scores a goal, gets 2+ points, and the game goes over the total. Ranked by EV.</p>
          <p data-testid="hockey-updated" className="text-sm font-semibold text-white mt-1">
            {data ? `Updated ${new Date(data.updated_at).toLocaleTimeString()} · ${rows.length} combos across ${data.games} games` : loading ? "Pricing combos with Kalshi market makers…" : ""}
          </p>
        </div>
        <button data-testid="hockey-refresh-btn" onClick={load} disabled={loading}
          className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white text-slate-950 text-sm font-semibold hover:bg-slate-200 disabled:opacity-50 transition-colors">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#181818] overflow-x-auto">
        <table data-testid="hockey-board" className="w-full min-w-[860px]">
          <thead>
            <tr className="text-xs text-slate-400">
              {heads.map((h, i) => (
                <th key={h} className={`py-3 font-semibold ${i ? "px-4 text-right" : "px-4 text-left sticky left-0 z-10 bg-[#181818]"}`}>
                  {logos[h] ? <span className="inline-flex items-center gap-1.5"><img src={logos[h]} alt="" className="h-4 w-4 rounded-[3px]" />{h}</span> : h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{rows.map((r, i) => <Row key={`${r.game.code}-${r.key}`} r={r} i={i} format={format} books={books} />)}</tbody>
        </table>
        {!data && <div data-testid="hockey-loading" className="py-16 text-center text-sm text-slate-500">{loading ? "Asking Kalshi market makers for live combo odds across every game… (up to 50 seconds)" : ""}</div>}
        {data && !rows.length && (
          <div data-testid="hockey-empty" className="py-16 text-center text-sm text-slate-500">No player has both a live Kalshi combo and a DraftKings/Fanatics/Caesars SGP price right now.</div>
        )}
      </div>
      <p className="text-xs text-slate-500 leading-relaxed max-w-3xl">
        Each combo is 4 legs: the player's team moneyline, 1+ goal, 2+ points, and Over the game's main Kalshi total (the line closest to 50%){settings.fees ? ", Kalshi price fee included" : ""}.
        DK/Fanatics/Caesars Manual is the same 4-leg same-game parlay from OddsBlaze (pregame only). EV compares Kalshi to the SGP price with a {settings.singleHold}% hold removed (books averaged).
        Combos still waiting on a Kalshi quote after ~50 seconds are left off; press Refresh to fill in more.
      </p>
    </div>
  );
}
