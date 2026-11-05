import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { TrendingUp, ChevronDown } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getAllBets, errMsg } from "../lib/api";
import { americanToProb } from "../lib/slip";
import { fmtAmerican, probToAmerican } from "../lib/ev";
import { Stat, profit, money } from "./BetTracker";
import { PlayerPhoto } from "../components/props/PlayerPhoto";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Checkbox } from "../components/ui/checkbox";

const UNIT = 10;
const STATUS_TONE = { won: "text-emerald-400", lost: "text-red-400", void: "text-slate-400", pending: "text-white" };

const avgOdds = (b) => {
  const ps = Object.values(b.books || {}).filter((v) => v != null).map((v) => americanToProb(v > 0 ? `+${v}` : `${v}`)).filter((p) => p != null);
  return ps.length ? probToAmerican(ps.reduce((a, x) => a + x, 0) / ps.length) : null;
};
const pct = (v) => (v == null ? "—" : `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}%`);
const day = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const fmtUnits = (v) => `${v > 0 ? "+" : v < 0 ? "-" : ""}${Math.abs(v / UNIT).toFixed(2)}u`;
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
// Slate day from the game code (e.g. 26NOV04...) so bets group by the game date, as sortable YYYYMMDD.
const slateKey = (b) => {
  const m = /^(\d{2})([A-Z]{3})(\d{2})/.exec(b.game_code || "");
  return m ? `20${m[1]}${String(MONTHS.indexOf(m[2]) + 1).padStart(2, "0")}${m[3]}` : b.created_at.slice(0, 10).replace(/-/g, "");
};
const slateLabel = (k) => new Date(+k.slice(0, 4), +k.slice(4, 6) - 1, +k.slice(6, 8)).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const UnitToggle = ({ units, setUnits }) => (
  <div data-testid="results-unit-toggle" className="flex rounded-lg border border-slate-700 bg-[#0E0E0E] p-0.5">
    {[[true, "Units"], [false, "Dollars"]].map(([u, l]) => (
      <button key={l} data-testid={`results-unit-${l.toLowerCase()}`} onClick={() => setUnits(u)}
        className={`h-8 px-3.5 rounded-md text-sm font-semibold transition-colors ${units === u ? "bg-white text-slate-950" : "text-slate-400 hover:text-white"}`}>{l}</button>
    ))}
  </div>
);

const NbaLogo = () => <img src="/nba.png" alt="" className="h-4 w-4 object-contain shrink-0" />;

const ComboPicker = ({ items, value, onChange }) => {
  const toggle = (k) => onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k]);
  const label = !value.length ? "All combos" : value.length === 1 ? value[0] : `${value.length} combos`;
  return (
    <div className="flex items-center gap-2 text-sm text-slate-400">
      Combo
      <Popover>
        <PopoverTrigger asChild>
          <button data-testid="results-combo-filter" className="flex items-center gap-2 h-9 w-64 px-3 rounded-md border border-slate-700 bg-[#0E0E0E] text-white text-sm">
            <NbaLogo /><span className="truncate flex-1 text-left">{label}</span><ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[22rem] p-1.5 bg-[#0E0E0E] border-slate-700 text-white">
          <div role="button" data-testid="results-combo-all" onClick={() => onChange([])}
            className={`flex w-full items-center gap-2.5 px-2 py-2 rounded-md text-sm cursor-pointer hover:bg-white/[0.05] ${!value.length ? "font-semibold" : "text-slate-300"}`}>
            <Checkbox checked={!value.length} className={`${CHECK} pointer-events-none`} tabIndex={-1} /><NbaLogo />All combos
          </div>
          {items.map(([k, l]) => (
            <label key={k} data-testid={`results-combo-${k.replace(/\W+/g, "-").toLowerCase()}`}
              className={`flex items-center gap-2.5 px-2 py-2 rounded-md text-sm cursor-pointer hover:bg-white/[0.05] ${value.includes(k) ? "text-white font-semibold" : "text-slate-300"}`}>
              <Checkbox checked={value.includes(k)} onCheckedChange={() => toggle(k)} className={CHECK} /><NbaLogo />{l}
            </label>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
};
const CHECK = "border-slate-500 data-[state=checked]:bg-white data-[state=checked]:border-white data-[state=checked]:text-black";

const ChartTip = ({ active, payload, fmt }) => active && payload?.length ? (
  <div className="rounded-lg border border-slate-700 bg-[#0E0E0E] px-3 py-2 text-xs">
    <div className="text-slate-400">{payload[0].payload.date}{payload[0].payload.date !== "Start" && ` · day ${fmt(payload[0].payload.day)}`}</div>
    <div className="font-mono font-bold text-white">{fmt(payload[0].value)}</div>
  </div>
) : null;

const axisFmt = (units) => (v) => `${v > 0 ? "+" : v < 0 ? "-" : ""}${units ? `${Math.abs(v / UNIT).toFixed(1)}u` : `$${Math.abs(v).toFixed(0)}`}`;
const tick = { fill: "#64748b", fontSize: 11 };

const ProfitChart = ({ points, fmt, units }) => (
  <div data-testid="results-chart" className="rounded-xl border border-slate-800 bg-[#181818] p-4 h-80 flex flex-col">
    <div className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Cumulative returns ({units ? "units" : "dollars"})</div>
    {points.length < 2 ? <div className="flex-1 grid place-items-center text-sm text-slate-500">Not enough settled bets for a graph yet.</div> : (
      <div className="flex-1 min-h-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="pl" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fff" stopOpacity={0.18} /><stop offset="100%" stopColor="#fff" stopOpacity={0} /></linearGradient>
          </defs>
          <CartesianGrid stroke="#262626" vertical={false} />
          <XAxis dataKey="date" tick={tick} tickLine={false} axisLine={{ stroke: "#334155" }} minTickGap={24} />
          <YAxis tickFormatter={axisFmt(units)} tick={tick} tickLine={false} axisLine={{ stroke: "#334155" }} width={64} />
          <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 4" />
          <Tooltip content={<ChartTip fmt={fmt} />} />
          <Area type="linear" dataKey="pl" stroke="#fff" strokeWidth={2} fill="url(#pl)" dot={false} activeDot={{ r: 4, fill: "#fff" }} />
        </AreaChart>
      </ResponsiveContainer>
      </div>
    )}
  </div>
);

const ResultRow = ({ b, fmt }) => (
  <tr data-testid={`result-row-${b.id}`} className="border-t border-slate-800/80">
    <td className="py-2.5 px-4 text-slate-400 whitespace-nowrap">{day(b.created_at)}</td>
    <td className="py-2.5 px-4 whitespace-nowrap">
      <div className="flex items-center gap-2.5">
        <PlayerPhoto src={b.headshot} name={b.player} size={28} testid={`result-photo-${b.id}`} />
        <div className="text-white font-semibold">{b.player}<div className="text-xs font-normal text-slate-500">{b.game_label}</div></div>
      </div>
    </td>
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
  const [combo, setCombo] = useState([]);
  const [units, setUnits] = useState(true);
  const fmt = units ? fmtUnits : money;

  useEffect(() => { getAllBets().then(setBets).catch((e) => { toast.error(errMsg(e)); setBets([]); }); }, []);

  const combos = useMemo(() => {
    const n = {};
    (bets || []).forEach((b) => { n[b.combo] = (n[b.combo] || 0) + 1; });
    return Object.entries(n).sort((a, b) => b[1] - a[1]).map(([c, k]) => [c, `${c} (${k})`]);
  }, [bets]);

  const rows = useMemo(() => (bets || [])
    .filter((b) => !combo.length || combo.includes(b.combo))
    .map((b) => ({ ...b, pl: profit(b), odds: avgOdds(b), evX: b.ev })), [bets, combo]);

  const s = useMemo(() => {
    const settled = rows.filter((b) => b.status === "won" || b.status === "lost");
    const pl = settled.reduce((a, b) => a + b.pl, 0);
    const risked = settled.reduce((a, b) => a + b.stake, 0);
    const evs = rows.filter((b) => b.evX != null);
    let run = 0;
    const byDay = {};
    settled.forEach((b) => { const k = slateKey(b); byDay[k] = (byDay[k] || 0) + b.pl; });
    const points = [{ date: "Start", day: 0, pl: 0 }, ...Object.keys(byDay).sort().map((k) => ({ date: slateLabel(k), day: byDay[k], pl: Number((run += byDay[k]).toFixed(2)) }))];
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
      </div>

      <div className="flex items-center gap-5 flex-wrap">
        <ComboPicker items={combos} value={combo} onChange={setCombo} />
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
