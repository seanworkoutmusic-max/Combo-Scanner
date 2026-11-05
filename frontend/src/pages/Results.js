import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { TrendingUp } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getAllBets, errMsg } from "../lib/api";
import { americanToProb } from "../lib/slip";
import { fmtAmerican, probToAmerican } from "../lib/ev";
import { Stat, profit, money } from "./BetTracker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";

const UNIT = 10;
const STATUS_TONE = { won: "text-emerald-400", lost: "text-red-400", void: "text-slate-400", pending: "text-white" };

const avgOdds = (b) => {
  const ps = Object.values(b.books || {}).filter((v) => v != null).map((v) => americanToProb(v > 0 ? `+${v}` : `${v}`)).filter((p) => p != null);
  return ps.length ? probToAmerican(ps.reduce((a, x) => a + x, 0) / ps.length) : null;
};
const pct = (v) => (v == null ? "—" : `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}%`);
const day = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const fmtUnits = (v) => `${v > 0 ? "+" : v < 0 ? "-" : ""}${Math.abs(v / UNIT).toFixed(2)}u`;

const UnitToggle = ({ units, setUnits }) => (
  <div data-testid="results-unit-toggle" className="flex rounded-lg border border-slate-700 bg-[#0E0E0E] p-0.5">
    {[[true, "Units"], [false, "Dollars"]].map(([u, l]) => (
      <button key={l} data-testid={`results-unit-${l.toLowerCase()}`} onClick={() => setUnits(u)}
        className={`h-8 px-3.5 rounded-md text-sm font-semibold transition-colors ${units === u ? "bg-white text-slate-950" : "text-slate-400 hover:text-white"}`}>{l}</button>
    ))}
  </div>
);

const Pick = ({ value, onChange, items, testid, label }) => (
  <label className="flex items-center gap-2 text-sm text-slate-400">
    {label}
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger data-testid={testid} className="h-9 w-56 border-slate-700 bg-[#0E0E0E] text-white"><SelectValue /></SelectTrigger>
      <SelectContent className="bg-[#0E0E0E] border-slate-700 text-white">
        {items.map(([k, l]) => <SelectItem key={k} value={k} data-testid={`${testid}-${k.replace(/\W+/g, "-").toLowerCase()}`}>{l}</SelectItem>)}
      </SelectContent>
    </Select>
  </label>
);

const ChartTip = ({ active, payload, fmt }) => active && payload?.length ? (
  <div className="rounded-lg border border-slate-700 bg-[#0E0E0E] px-3 py-2 text-xs">
    <div className="text-slate-400">{payload[0].payload.date} · {payload[0].payload.player}</div>
    <div className="font-mono font-bold text-white">{fmt(payload[0].value)}</div>
  </div>
) : null;

const ProfitChart = ({ points, fmt, units }) => (
  <div data-testid="results-chart" className="rounded-xl border border-slate-800 bg-[#181818] p-4 h-80">
    {points.length < 2 ? <div className="h-full grid place-items-center text-sm text-slate-500">Not enough settled bets for a graph yet.</div> : (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="pl" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fff" stopOpacity={0.18} /><stop offset="100%" stopColor="#fff" stopOpacity={0} /></linearGradient>
          </defs>
          <CartesianGrid stroke="#262626" vertical={false} />
          <XAxis dataKey="n" hide />
          <YAxis tickFormatter={(v) => (units ? `${v / UNIT}u` : `$${v}`)} tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} width={56} />
          <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 4" />
          <Tooltip content={<ChartTip fmt={fmt} />} />
          <Area type="monotone" dataKey="pl" stroke="#fff" strokeWidth={2} fill="url(#pl)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    )}
  </div>
);

const ResultRow = ({ b, fmt }) => (
  <tr data-testid={`result-row-${b.id}`} className="border-t border-slate-800/80">
    <td className="py-2.5 px-4 text-slate-400 whitespace-nowrap">{day(b.created_at)}</td>
    <td className="py-2.5 px-4 text-white font-semibold whitespace-nowrap">{b.player}<div className="text-xs font-normal text-slate-500">{b.game_label}</div></td>
    <td className="py-2.5 px-4 text-slate-300 whitespace-nowrap">{b.combo}</td>
    <td className="py-2.5 px-4 font-mono text-white text-right">{fmtAmerican(probToAmerican(b.price))}</td>
    <td className="py-2.5 px-4 font-mono text-slate-300 text-right">{fmtAmerican(b.odds)}</td>
    <td className={`py-2.5 px-4 font-mono font-bold text-right ${b.evX > 0 ? "text-emerald-400" : "text-red-400"}`}>{pct(b.evX)}</td>
    <td className={`py-2.5 px-4 capitalize font-semibold ${STATUS_TONE[b.status]}`}>{b.status}</td>
    <td className={`py-2.5 px-4 font-mono text-right ${b.pl > 0 ? "text-emerald-400" : b.pl < 0 ? "text-red-400" : "text-slate-400"}`}>{fmt(b.pl)}</td>
  </tr>
);

export default function Results() {
  const [bets, setBets] = useState(null);
  const [combo, setCombo] = useState("all");
  const [units, setUnits] = useState(true);
  const fmt = units ? fmtUnits : money;

  useEffect(() => { getAllBets().then(setBets).catch((e) => { toast.error(errMsg(e)); setBets([]); }); }, []);

  const combos = useMemo(() => {
    const n = {};
    (bets || []).forEach((b) => { n[b.combo] = (n[b.combo] || 0) + 1; });
    return [["all", "All combos"], ...Object.entries(n).sort((a, b) => b[1] - a[1]).map(([c, k]) => [c, `${c} (${k})`])];
  }, [bets]);

  const rows = useMemo(() => (bets || [])
    .filter((b) => combo === "all" || b.combo === combo)
    .map((b) => ({ ...b, pl: profit(b), odds: avgOdds(b), evX: b.ev })), [bets, combo]);

  const s = useMemo(() => {
    const settled = rows.filter((b) => b.status === "won" || b.status === "lost");
    const pl = settled.reduce((a, b) => a + b.pl, 0);
    const risked = settled.reduce((a, b) => a + b.stake, 0);
    const evs = rows.filter((b) => b.evX != null);
    let run = 0;
    const points = settled.map((b, i) => ({ n: i + 1, pl: Number((run += b.pl).toFixed(2)), date: day(b.created_at), player: b.player }));
    return {
      n: rows.length, pl, roi: risked ? pl / risked : null, points,
      record: `${rows.filter((b) => b.status === "won").length}-${rows.filter((b) => b.status === "lost").length}-${rows.filter((b) => b.status === "void").length}`,
      ev: evs.length ? evs.reduce((a, b) => a + b.evX, 0) / evs.length : null,
    };
  }, [rows]);

  const tone = (v) => (v > 0 ? "text-emerald-400" : v < 0 ? "text-red-400" : "text-white");

  return (
    <div data-testid="results-page" className="space-y-6">
      <div>
        <h1 className="flex items-center gap-3 font-display text-3xl sm:text-4xl font-bold tracking-tight">
          <TrendingUp className="h-8 w-8 text-white" /> Results
        </h1>
        <p className="text-sm text-slate-400 mt-1">Every bet you've tracked from the Kalshi SGP Scanner, across all days. 1 unit = ${UNIT}.</p>
      </div>

      <div className="flex items-center gap-5 flex-wrap">
        <Pick label="Combo" value={combo} onChange={setCombo} items={combos} testid="results-combo-filter" />
        <UnitToggle units={units} setUnits={setUnits} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Bets" value={s.n} testid="results-stat-count" />
        <Stat label="Record (W-L-V)" value={s.record} testid="results-stat-record" />
        <Stat label="Profit" value={fmt(s.pl)} testid="results-stat-profit" tone={tone(s.pl)} />
        <Stat label="ROI" value={pct(s.roi)} testid="results-stat-roi" tone={tone(s.roi)} />
        <Stat label="Avg EV" value={pct(s.ev)} testid="results-stat-ev" tone={tone(s.ev)} />
      </div>

      <ProfitChart points={s.points} fmt={fmt} units={units} />

      <div className="rounded-xl border border-slate-800 bg-[#181818] overflow-x-auto">
        {bets === null ? <div className="py-16 text-center text-sm text-slate-500">Loading bets…</div>
          : !rows.length ? <div data-testid="results-empty" className="py-16 text-center text-sm text-slate-500">No bets match these filters.</div> : (
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-slate-400 text-left">
              <th className="py-3 px-4 font-semibold">Date</th><th className="py-3 px-4 font-semibold">Player</th><th className="py-3 px-4 font-semibold">Combo</th>
              <th className="py-3 px-4 font-semibold text-right">Kalshi</th><th className="py-3 px-4 font-semibold text-right">Book avg</th>
              <th className="py-3 px-4 font-semibold text-right">EV</th><th className="py-3 px-4 font-semibold">Result</th><th className="py-3 px-4 font-semibold text-right">P/L</th>
            </tr></thead>
            <tbody>{[...rows].reverse().map((b) => <ResultRow key={b.id} b={b} fmt={fmt} />)}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
