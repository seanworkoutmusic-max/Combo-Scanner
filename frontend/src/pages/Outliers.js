import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Zap } from "lucide-react";
import { getOutliers, errMsg } from "../lib/api";
import { fmtAmerican } from "../lib/ev";
import { TeamLogo } from "../components/props/TeamLogo";
import { OutlierDetail } from "../components/props/OutlierDetail";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";

const MARKETS = ["points", "rebounds", "assists", "pts + reb", "pts + ast", "reb + ast", "pts + reb + ast", "threes", "steals", "blocks"];
const time = (iso) => (iso ? new Date(iso).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" }) : "");
const ago = (s) => (s < 60 ? "new" : s < 3600 ? `${Math.floor(s / 60)}m` : `${Math.floor(s / 3600)}h`);
const gameKey = (g) => `${g.away}@${g.home}`;

const Pick = ({ value, onChange, items, testid }) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger data-testid={testid} className="h-10 w-auto min-w-[9rem] gap-2 border-slate-700 bg-[#0E0E0E] text-white font-semibold"><SelectValue /></SelectTrigger>
    <SelectContent className="bg-[#0E0E0E] border-slate-700 text-white">
      {items.map(([k, l]) => <SelectItem key={k} value={k} data-testid={`${testid}-${k.replace(/\W+/g, "-").toLowerCase()}`}>{l}</SelectItem>)}
    </SelectContent>
  </Select>
);

const Teams = ({ g }) => (
  <span className="inline-flex items-center gap-1.5 font-bold text-white">
    <TeamLogo team={g.away} size={18} />{g.away}<span className="text-slate-600 font-normal">@</span><TeamLogo team={g.home} size={18} />{g.home}
  </span>
);

const GameStrip = ({ games, sel, onPick }) => (
  <div className="flex gap-2 overflow-x-auto pb-1">
    {games.map((g) => (
      <button key={gameKey(g)} data-testid={`outlier-game-${gameKey(g)}`} onClick={() => onPick(sel === gameKey(g) ? "all" : gameKey(g))}
        className={`shrink-0 text-left rounded-xl border px-4 py-3 transition-colors ${sel === gameKey(g) ? "border-white bg-white/[0.06]" : "border-slate-800 bg-[#181818] hover:border-slate-600"}`}>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{time(g.date)}</div>
        <div className="mt-1.5 text-sm"><Teams g={g} /></div>
        <div className="mt-1 text-xs text-slate-500">{g.props.toLocaleString()} props</div>
      </button>
    ))}
  </div>
);

const Row = ({ r, i, onOpen }) => (
  <tr data-testid={`outlier-row-${i}`} onClick={() => onOpen(r)} className="border-t border-slate-800/80 hover:bg-white/[0.03] cursor-pointer transition-colors">
    <td className="py-4 px-5 text-white font-semibold whitespace-nowrap">{r.player} {r.market}<span className="text-slate-500 font-normal"> · </span>Over {r.line}</td>
    <td className="py-4 px-4 whitespace-nowrap text-sm"><Teams g={r.game} /><span className="ml-2 font-mono text-xs text-slate-500">{time(r.game.date)}</span></td>
    <td className="py-4 px-4 whitespace-nowrap">
      <span className="inline-flex items-center gap-2"><img src="/fanatics-f.png" alt="" className="h-6 w-6 rounded-md object-cover" />
        <span className="font-mono font-bold text-white">{fmtAmerican(r.price)}</span><span className="text-xs text-slate-400">Fanatics</span></span>
    </td>
    <td className="py-4 px-4 whitespace-nowrap"><span className="font-mono text-slate-200">{fmtAmerican(r.next_best)}</span>
      <span className="ml-2 text-xs text-slate-500" title={`Best: ${r.next_book}`}>{r.books} book{r.books === 1 ? "" : "s"}</span></td>
    <td data-testid={`outlier-pays-${i}`} className="py-4 px-4 text-right font-mono font-bold text-emerald-400">{Math.round(r.pays_more * 100)}%</td>
    <td className="py-4 px-5 text-right font-mono text-sm text-slate-400">{ago(r.open_for)}</td>
  </tr>
);

export default function Outliers() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [game, setGame] = useState("all");
  const [market, setMarket] = useState("all");
  const [minBooks, setMinBooks] = useState("2");
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await getOutliers()); } catch (e) { toast.error(errMsg(e)); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => (data?.rows || []).filter((r) => (game === "all" || gameKey(r.game) === game)
    && (market === "all" || r.market === market) && r.books >= +minBooks), [data, game, market, minBooks]);
  const games = data?.games || [];

  return (
    <div data-testid="outliers-page" className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="flex items-center gap-3 font-display text-3xl sm:text-4xl font-bold tracking-tight"><Zap className="h-8 w-8 text-white" /> Outliers</h1>
          <p className="text-sm text-slate-400 mt-1">NBA player-prop overs where Fanatics pays more than DraftKings, FanDuel, BetMGM and Hard Rock.</p>
        </div>
        <button data-testid="outliers-refresh-btn" onClick={load} disabled={loading}
          className="flex items-center gap-1.5 h-9 px-3.5 rounded-lg border bg-white text-slate-950 text-sm font-semibold hover:bg-slate-200 disabled:opacity-50 transition-colors">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <GameStrip games={games} sel={game} onPick={setGame} />

      <div className="flex items-center gap-3 flex-wrap">
        <span className="inline-flex items-center gap-2 h-10 px-3.5 rounded-md bg-white text-slate-950 text-sm font-semibold"><img src="/fanatics.png" alt="" className="h-5 w-5 rounded object-cover" />Fanatics</span>
        <Pick testid="outliers-game-filter" value={game} onChange={setGame} items={[["all", "All games"], ...games.map((g) => [gameKey(g), `${g.away} @ ${g.home}`])]} />
        <Pick testid="outliers-market-filter" value={market} onChange={setMarket} items={[["all", "All markets"], ...MARKETS.map((m) => [m, m])]} />
        <Pick testid="outliers-books-filter" value={minBooks} onChange={setMinBooks} items={[["1", "1+ books"], ["2", "2+ books"], ["3", "3+ books"], ["4", "All 4 books"]]} />
        <span data-testid="outliers-count" className="text-sm text-slate-500">{rows.length} outliers</span>
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#181818] overflow-x-auto">
        {!data ? <div className="py-16 text-center text-sm text-slate-500">Loading odds…</div>
          : !rows.length ? <div data-testid="outliers-empty" className="py-16 text-center text-sm text-slate-500">No outliers match these filters.</div> : (
          <table className="w-full text-sm">
            <thead><tr className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 text-left">
              <th className="py-3 px-5">Bet</th><th className="py-3 px-4">Game</th><th className="py-3 px-4">Book price</th>
              <th className="py-3 px-4">Next best</th><th className="py-3 px-4 text-right text-white">Pays more</th><th className="py-3 px-5 text-right">Open for</th>
            </tr></thead>
            <tbody>{rows.slice(0, 300).map((r, i) => <Row key={`${r.player}${r.market}${r.line}`} r={r} i={i} onOpen={setOpen} />)}</tbody>
          </table>
        )}
      </div>
      <OutlierDetail r={open} onClose={() => setOpen(null)} />
    </div>
  );
}
