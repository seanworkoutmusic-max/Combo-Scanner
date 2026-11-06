import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { postInjuryLines, errMsg } from "../../lib/api";
import { kalshiGameUrl, evPct } from "../../lib/slip";
import { fairFrom } from "../../pages/DDScanner";
import { PlayerPhoto } from "./PlayerPhoto";

const cents = (p) => (p == null ? "—" : `${Math.round(p * 100)}¢`);
const pct = (v) => (v == null ? "—" : `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}%`);

const StarterRow = ({ p, max, line, loading, slug }) => (
  <tr data-testid={`lineup-row-${slug}`} className="border-t border-slate-800/80">
    <td className="py-2.5 px-4 text-xs font-bold text-slate-400">{p.pos}</td>
    <td className="py-2.5 px-4">
      <div className="flex items-center gap-2.5">
        <PlayerPhoto src={p.headshot} name={p.name} size={28} />
        <span className="font-bold text-white whitespace-nowrap">{p.name}</span>
        {p.new && <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-900">NEW STARTER</span>}
      </div>
    </td>
    <td className="py-2.5 px-4 min-w-[220px]">
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 rounded-full bg-slate-800 overflow-hidden">
          <div className="h-full rounded-full bg-emerald-400 transition-[width] duration-500" style={{ width: `${Math.max(4, (p.bump / max) * 100)}%` }} />
        </div>
        <span data-testid={`lineup-bump-${slug}`} className="w-14 text-right font-bold text-emerald-400">+{Math.round(p.bump * 100)}%</span>
      </div>
    </td>
    <td className="py-2.5 px-4 text-right whitespace-nowrap">
      <span className="text-slate-400 mr-2">6+ reb & 6+ ast</span>
      <span data-testid={`lineup-kalshi-${slug}`} className="rounded bg-white/[0.06] px-2 py-1 font-bold text-white">{loading && !line ? "…" : cents(line?.price)}</span>
    </td>
  </tr>
);

const ComboRow = ({ c, i }) => (
  <tr data-testid={`front-run-row-${i}`} className="border-t border-slate-800/80">
    <td className="py-2.5 px-4 text-slate-200">{c.name}</td>
    <td className="py-2.5 px-4 text-right font-bold text-white">{cents(c.price)}</td>
    <td className="py-2.5 px-4 text-right text-slate-400">{cents(c.fair)}</td>
    <td className={`py-2.5 px-4 text-right font-bold ${c.ev > 0 ? "text-emerald-400" : "text-slate-400"}`}>{pct(c.ev)}</td>
    <td className="py-2.5 px-4 text-right">
      <a data-testid={`front-run-bet-${i}`} href={kalshiGameUrl(c.ticker)} target="_blank" rel="noreferrer"
        className="inline-flex items-center gap-1 rounded-md border border-slate-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-white/10 transition-colors">Bet<ArrowUpRight className="h-3 w-3" /></a>
    </td>
  </tr>
);

export const LineupPanel = ({ r, g, settings }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const lineup = r.lineup || [];
  const scan = useCallback(() => {
    const anchors = lineup.filter((p) => p.new).map((p) => p.key);
    const top = [...lineup].sort((a, b) => b.bump - a.bump)[0];
    setLoading(true);
    postInjuryLines({ away: g.away, home: g.home, players: lineup.map((p) => p.key), anchors: anchors.length ? anchors : top ? [top.key] : [] })
      .then(setData).catch((e) => toast.error(errMsg(e))).finally(() => setLoading(false));
  }, [lineup, g.away, g.home]);
  useEffect(() => { scan(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const combos = useMemo(() => (data?.combos || []).map((c) => {
    const fair = fairFrom(c.sgp, settings.singleHold);
    return { ...c, fair, ev: evPct(fair, c.price, settings.fees) };
  }).filter((c) => c.price).sort((a, b) => (b.ev ?? -9) - (a.ev ?? -9)), [data, settings.singleHold, settings.fees]);
  const max = Math.max(...lineup.map((p) => p.bump), 0.01);
  const out = r.pos ? `${r.pos} out` : "starter out";

  return (
    <div className="pl-0 sm:pl-12 space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{r.team} projected starting lineup</span>
          <span className="text-xs text-slate-500">Est. usage bump with {out} · Kalshi line</span>
        </div>
        <div className="rounded-lg border border-slate-800 bg-[#121212] overflow-x-auto">
          {!lineup.length ? <div className="py-6 text-center text-sm text-slate-500">No depth chart for this team.</div> : (
            <table className="w-full text-sm">
              <thead><tr className="text-xs font-semibold text-slate-400 text-left">
                <th className="py-2.5 px-4">Pos</th><th className="py-2.5 px-4">Starter</th><th className="py-2.5 px-4">Usage bump</th><th className="py-2.5 px-4 text-right">Kalshi line</th>
              </tr></thead>
              <tbody>{lineup.map((p) => <StarterRow key={p.key} p={p} max={max} loading={loading} slug={p.key.replace(/\W+/g, "-")}
                line={(data?.combos || []).find((c) => c.kind === "RA6" && c.player === p.key)} />)}</tbody>
            </table>
          )}
        </div>
      </div>

      <div data-testid="front-run-panel" className="rounded-lg border border-slate-800 bg-[#121212] p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="font-bold text-white">Kalshi combos to front-run</div>
            <div className="text-xs text-slate-400">Combos with these starters, priced against the devigged books before Kalshi adjusts</div>
          </div>
          <button data-testid="rescan-lines-btn" onClick={scan} disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-black hover:bg-emerald-400 disabled:opacity-60 transition-colors">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />{loading ? "Scanning…" : "Rescan lines"}
          </button>
        </div>
        <div className="rounded-lg border border-slate-800 overflow-x-auto">
          {loading && !data ? <div className="py-8 text-center text-sm text-slate-500">Pulling Kalshi quotes and sportsbook SGP odds…</div>
            : data && !data.game ? <div data-testid="front-run-empty" className="py-8 text-center text-sm text-slate-500">Kalshi has no combos open for this game yet.</div>
            : !combos.length ? <div data-testid="front-run-empty" className="py-8 text-center text-sm text-slate-500">No Kalshi quotes for these starters right now.</div> : (
            <table className="w-full text-sm">
              <thead><tr className="text-xs font-semibold text-slate-400">
                <th className="py-2.5 px-4 text-left">Combo</th><th className="py-2.5 px-4 text-right">Kalshi</th><th className="py-2.5 px-4 text-right">Fair</th>
                <th className="py-2.5 px-4 text-right">EV</th><th />
              </tr></thead>
              <tbody>{combos.map((c, i) => <ComboRow key={c.name} c={c} i={i} />)}</tbody>
            </table>
          )}
        </div>
        {data?.sgp_pending > 0 && <div className="text-xs text-slate-500">Some book odds are still loading (rate limit) — rescan in a minute for more.</div>}
      </div>
    </div>
  );
};
