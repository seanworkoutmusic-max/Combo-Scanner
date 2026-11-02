import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUpDown } from "lucide-react";
import { getTdWatch, errMsg } from "../lib/api";
import { PlayerPhoto } from "../components/props/PlayerPhoto";
import { TeamLogo } from "../components/props/TeamLogo";

const COLS = [
  { id: "pts", label: "PTS" },
  { id: "reb", label: "REB" },
  { id: "ast", label: "AST" },
  { id: "score", label: "TD Score", title: "Lowest of PTS, REB and AST: the stat holding the player back from a triple-double" },
  { id: "td", label: "TDs" },
  { id: "gp", label: "GP" },
];

const fmt = (id, v) => (id === "td" || id === "gp" ? v : v.toFixed(1));
// Blue heat for the sorted column: darker at the bottom, brighter for the leaders.
const heat = (v, lo, hi) => `rgba(30, 58, 160, ${(0.12 + 0.6 * (hi > lo ? (v - lo) / (hi - lo) : 1)).toFixed(3)})`;

const Head = ({ col, sort, setSort }) => {
  const active = sort === col.id;
  return (
    <th className={`py-3 px-4 font-semibold whitespace-nowrap ${active ? "text-center text-white border-b-2 border-slate-300" : "text-right"}`} title={col.title}>
      <button data-testid={`tdwatch-sort-${col.id}`} onClick={() => setSort(col.id)} className="inline-flex items-center gap-1.5 hover:text-white whitespace-nowrap">
        {col.label}
        {active ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 text-slate-600" />}
      </button>
    </th>
  );
};

const Row = ({ p, i, sort, range }) => (
  <tr data-testid={`tdwatch-row-${p.key.replace(/\s/g, "-")}`} style={{ animationDelay: `${i * 20}ms` }}
    className="row-in border-t border-slate-800/70 hover:bg-white/[0.03] transition-colors">
    <td className="py-2.5 px-4 text-sm text-slate-400 font-mono">{i + 1}</td>
    <td className="py-2.5 px-4">
      <div className="flex items-center gap-3">
        <PlayerPhoto src={p.headshot} name={p.name} size={32} />
        <div className="flex flex-col sm:flex-row sm:items-center gap-x-1.5 text-sm whitespace-nowrap">
          <span className="flex items-center gap-1.5">
            <span className="font-semibold text-white">{p.name}</span>
            {p.injury && (
              <span data-testid={`tdwatch-injury-${p.key.replace(/\s/g, "-")}`} title={`${p.injury.status}${p.injury.comment ? `: ${p.injury.comment}` : ""}`}
                className={`px-1 py-px rounded-[3px] text-[9px] font-bold leading-none tracking-wide ${p.injury.label === "OUT" ? "bg-red-600 text-white" : "bg-yellow-500/15 text-yellow-400"}`}>
                {p.injury.label}
              </span>
            )}
            <TeamLogo team={p.team} size={15} />
            <span className="text-slate-400">{p.team}</span>
          </span>
          {p.opp && <span data-testid={`tdwatch-tonight-${p.key.replace(/\s/g, "-")}`} className="text-xs sm:text-sm text-slate-500">vs {p.opp} tonight</span>}
        </div>
      </div>
    </td>
    {COLS.map((c) => (
      <td key={c.id} data-testid={sort === c.id ? `tdwatch-heat-${i}` : undefined}
        style={sort === c.id ? { background: heat(p[c.id], range[0], range[1]) } : undefined}
        className={`py-2.5 px-4 font-mono text-sm ${sort === c.id ? "text-center text-white font-bold" : "text-right text-slate-300"}`}>
        {fmt(c.id, p[c.id])}
      </td>
    ))}
  </tr>
);

export default function TDWatch() {
  const [data, setData] = useState(null);
  const [sort, setSort] = useState("score");
  const [tonightOnly, setTonightOnly] = useState(false);

  useEffect(() => {
    getTdWatch().then(setData).catch((e) => toast.error(errMsg(e)));
  }, []);

  const rows = useMemo(() => {
    const list = (data?.players || []).filter((p) => !tonightOnly || p.opp);
    return [...list].sort((a, b) => b[sort] - a[sort]);
  }, [data, sort, tonightOnly]);
  const range = rows.length ? [rows[rows.length - 1][sort], rows[0][sort]] : [0, 0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">TD Leaders</h1>
        <p className="text-sm text-slate-400 mt-1">Players closest to averaging a triple-double{data?.season ? `, ${data.season} season` : ""}.</p>
        <p data-testid="tdwatch-updated" className="text-sm font-semibold text-cyan-300 mt-1">
          {data?.updated_at ? `Updated ${new Date(data.updated_at).toLocaleString([], { month: "numeric", day: "numeric", weekday: "long", hour: "numeric", minute: "2-digit" })}` : "Loading season stats…"}
        </p>
      </div>
      <div className="flex items-center gap-1 rounded-lg border border-slate-800 p-0.5 w-fit">
        {[[false, "All players"], [true, "Playing tonight"]].map(([v, label]) => (
          <button key={label} data-testid={`tdwatch-filter-${v ? "tonight" : "all"}`} onClick={() => setTonightOnly(v)}
            className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${tonightOnly === v ? "bg-white/[0.08] text-white" : "text-slate-500 hover:text-slate-200"}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="rounded-xl border border-slate-800 bg-[#0D1B33] overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="text-xs text-slate-400 border-b border-slate-700">
              <th className="py-3 px-4 text-left font-semibold w-10">#</th>
              <th className="py-3 px-4 text-left font-semibold">Player</th>
              {COLS.map((c) => <Head key={c.id} col={c} sort={sort} setSort={setSort} />)}
            </tr>
          </thead>
          <tbody>{rows.map((p, i) => <Row key={p.key} p={p} i={i} sort={sort} range={range} />)}</tbody>
        </table>
        {data && !rows.length && <div className="py-16 text-center text-sm text-slate-500">No players to show.</div>}
        {!data && <div className="py-16 text-center text-sm text-slate-500">Loading season stats…</div>}
      </div>
      <p className="text-xs text-slate-500 max-w-3xl">
        Season averages from ESPN (players with 15+ minutes a game). TD Score is the lowest of a player's points, rebounds and assists averages, so 10+ means
        they're averaging a triple-double.
      </p>
    </div>
  );
}
