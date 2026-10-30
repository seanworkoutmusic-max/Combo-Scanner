import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, ExternalLink } from "lucide-react";
import { getScannerBoard, errMsg } from "../lib/api";
import { PlayerPhoto } from "../components/props/PlayerPhoto";
import { GameLabel } from "../components/props/TeamLogo";
import { PriceTag } from "../components/props/MarketList";
import { kalshiGameUrl, americanToProb, devigOneSided, evPct } from "../lib/slip";

const HEADS = ["Player", "Game", "Kalshi TD", "FanDuel", "DraftKings", "EV"];
const BOOKS = [["fd", "FanDuel"], ["dk", "DraftKings"]];
const HEAD_LOGOS = { FanDuel: "/fd.png", DraftKings: "/dk.png" };

const fmt = (v) => (v == null ? null : v > 0 ? `+${v}` : `${v}`);

const fairFrom = (books, hold) => {
  const ps = BOOKS.map(([b]) => americanToProb(fmt(books?.[b]))).filter((p) => p != null).map((p) => devigOneSided(p, hold));
  return ps.length ? ps.reduce((a, x) => a + x, 0) / ps.length : null;
};

const EvCell = ({ ev, testid }) => (
  <div data-testid={testid} className={`font-mono text-sm font-bold ${ev > 0 ? "text-emerald-400" : "text-red-400"}`}>
    {`${ev > 0 ? "+" : ""}${(ev * 100).toFixed(1)}%`}
  </div>
);

const Row = ({ r, format, i }) => {
  const slug = r.key.replace(/\s/g, "-");
  const legs = r.combos[0].legs;
  return (
    <tr data-testid={`scanner-row-${slug}`} style={{ animationDelay: `${i * 30}ms` }} className="row-in border-t border-slate-800/70 hover:bg-white/[0.03] transition-colors">
      <td className="py-3 px-4 sticky left-0 z-10 bg-[#181818]">
        <div className="flex items-center gap-3">
          <PlayerPhoto src={r.headshot} name={r.name} size={34} />
          <div className="leading-tight">
            <div className="text-sm font-semibold text-white whitespace-nowrap">{r.name}</div>
            <div className="text-[11px] font-mono text-slate-500">{r.team}</div>
          </div>
        </div>
      </td>
      <td className="py-3 px-4 text-right text-sm font-semibold text-slate-300 whitespace-nowrap">
        <a data-testid={`game-link-${slug}`} href={kalshiGameUrl(legs[0].ticker)} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 hover:text-white transition-colors">
          <GameLabel code={r.game.code} size={16} /><ExternalLink className="h-3 w-3 text-slate-500" />
        </a>
      </td>
      <td className="py-3 px-4 text-right">
        <span data-testid={`td-${slug}`} className="font-mono text-base font-bold text-white"><PriceTag p={r.price} format={format} /></span>
        {r.approx && <div data-testid={`td-leg-note-${slug}`} className="text-[10px] font-mono text-amber-400">{legs[0].threshold}+ pts (lowest Kalshi line)</div>}
      </td>
      {BOOKS.map(([b]) => (
        <td key={b} data-testid={`${b}-td-${slug}`} className={`py-3 px-4 text-right font-mono text-sm ${r.books[b] != null ? "text-white font-semibold" : "text-slate-600"}`}>
          {fmt(r.books[b]) || "—"}
        </td>
      ))}
      <td className="py-3 px-4 text-right"><EvCell ev={r.ev} testid={`ev-td-${slug}`} /></td>
    </tr>
  );
};

export default function DDScanner({ settings }) {
  const format = settings.fees ? "fee" : "raw";
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      const d = await getScannerBoard();
      if (id === reqId.current) setData(d);
    } catch (e) {
      if (id === reqId.current) toast.error(errMsg(e));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => (data?.players || []).map((p) => {
    const price = p.combos[0].live.yes_price;
    return { ...p, price, approx: p.combos[0].legs[0].threshold !== 10, ev: evPct(fairFrom(p.books, settings.singleHold), price, settings.fees) };
  }).filter((r) => r.ev != null).sort((a, b) => b.ev - a.ev), [data, settings.singleHold, settings.fees]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">Triple-double scanner</h1>
          <p className="text-sm text-slate-400 mt-1">Every game on one board: live Kalshi triple-double combos, ranked by EV against devigged FanDuel/DraftKings odds.</p>
          <p data-testid="scanner-updated" className="text-sm font-semibold text-white mt-1">
            {data ? `Updated ${new Date(data.updated_at).toLocaleTimeString()} · ${rows.length} combos across ${data.games} games` : loading ? "Pricing combos with Kalshi market makers…" : ""}
          </p>
        </div>
        <button data-testid="scanner-refresh-btn" onClick={load} disabled={loading}
          className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white text-slate-950 text-sm font-semibold hover:bg-slate-200 disabled:opacity-50 transition-colors">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#181818] overflow-x-auto">
        <table data-testid="scanner-board" className="w-full min-w-[900px]">
          <thead>
            <tr className="text-xs text-slate-400">
              {HEADS.map((h, i) => (
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
            {rows.map((r, i) => <Row key={`${r.game.code}-${r.key}`} r={r} i={i} format={format} />)}
          </tbody>
        </table>
        {!data && (
          <div data-testid="scanner-loading" className="py-16 text-center text-sm text-slate-500">
            {loading ? "Asking Kalshi market makers for live combo odds across every game… (10–30 seconds)" : ""}
          </div>
        )}
        {data && !rows.length && (
          <div data-testid="scanner-empty" className="py-16 text-center text-sm text-slate-500">
            No player has both a Kalshi triple-double combo and FanDuel/DraftKings triple-double odds right now. Books usually post these on game day.
          </div>
        )}
      </div>
      <p className="text-xs text-slate-500 leading-relaxed max-w-3xl">
        Kalshi TD is the live combo price for 10+ points, 10+ rebounds and 10+ assists{settings.fees ? " (fee included)" : ""}. EV compares it to the FanDuel/DraftKings
        "to record a triple-double" price with a {settings.singleHold}% hold removed (books averaged).
        {" "}When Kalshi has no 10+ points line, the combo uses the player's lowest Kalshi points line, which is a harder bet than a
        regular triple-double, so that EV is optimistic.
        {data?.books?.credits_left ? ` ${data.books.credits_left} Odds API credits left this month.` : ""}
      </p>
    </div>
  );
}
