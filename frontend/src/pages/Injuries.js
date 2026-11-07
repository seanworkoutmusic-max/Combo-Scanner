import { Fragment, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Search } from "lucide-react";
import { getInjuries, errMsg } from "../lib/api";
import { PlayerPhoto } from "../components/props/PlayerPhoto";
import { TeamLogo } from "../components/props/TeamLogo";
import { LineupPanel } from "../components/props/LineupPanel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";

const POS = ["ALL", "PG", "SG", "SF", "PF", "C"];
const STATUSES = ["all", "Out", "Doubtful", "Questionable", "Probable"];
const TONE = {
  out: "bg-red-500/15 text-red-300", doubtful: "bg-orange-500/15 text-orange-300", questionable: "bg-amber-500/15 text-amber-300",
  probable: "bg-emerald-500/15 text-emerald-300", "day-to-day": "bg-amber-500/15 text-amber-300",
};
const tip = (iso) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const ret = (d, status) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : status);

const InjuryRow = ({ r, g, settings, open, onToggle, i }) => (
  <>
    <tr data-testid={`injury-row-${i}`} onClick={onToggle} className="border-t border-slate-800/80 cursor-pointer hover:bg-white/[0.02] transition-colors">
      <td className="py-3 px-5">
        <div className="flex items-center gap-3">
          <PlayerPhoto src={r.headshot} name={r.name} size={36} />
          <div><div className="font-semibold text-white">{r.name}</div><div className="text-xs text-slate-400"><span className="font-bold text-slate-300">{r.team}</span> · {r.pos || "—"}</div></div>
        </div>
      </td>
      <td className="py-3 px-4"><span data-testid={`injury-status-${i}`} className={`px-2.5 py-1 rounded-full text-xs font-bold ${TONE[r.status.toLowerCase()] || "bg-slate-700 text-slate-200"}`}>{r.status}</span></td>
      <td className="py-3 px-4 text-slate-300">{r.injury}</td>
      <td className="py-3 px-4 text-slate-300 whitespace-nowrap">{ret(r.return, r.status)}</td>
      <td className="py-3 pr-5 text-right whitespace-nowrap text-slate-400">
        Starting 5 <ChevronDown className={`inline h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </td>
    </tr>
    {open && (
      <tr data-testid={`injury-depth-${i}`}><td colSpan={5} className="px-5 pb-5">
        <LineupPanel r={r} g={g} settings={settings} />
        {r.comment && <p className="mt-3 text-xs text-slate-400 sm:pl-12">{r.comment}</p>}
      </td></tr>
    )}
  </>
);

export default function Injuries({ settings }) {
  const [data, setData] = useState(null);
  const [pos, setPos] = useState("ALL");
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);

  useEffect(() => { getInjuries().then(setData).catch((e) => { toast.error(errMsg(e)); setData({ games: [] }); }); }, []);

  const games = useMemo(() => (data?.games || []).map((g) => ({ ...g, rows: g.rows.filter((r) => (pos === "ALL" || r.pos === pos)
    && (status === "all" || r.status === status) && (!q || [r.name, ...(r.lineup || []).map((p) => p.name)].some((n) => n.toLowerCase().includes(q.toLowerCase())))) }))
    .filter((g) => g.rows.length), [data, pos, status, q]);
  const day = data?.games?.[0] ? new Date(data.games[0].start).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "";

  return (
    <div data-testid="injuries-page" className="space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs font-semibold text-slate-500">NBA · {day}</div>
          <h1 className="mt-1 font-display text-3xl sm:text-4xl font-bold tracking-tight">Injuries &amp; depth chart</h1>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="flex flex-1 sm:flex-none items-center gap-2 h-10 px-3 rounded-lg border border-slate-700 bg-[#0E0E0E] text-sm min-w-0">
            <Search className="h-4 w-4 text-slate-500 shrink-0" />
            <input data-testid="injuries-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search players" className="bg-transparent outline-none text-white placeholder:text-slate-500 w-full sm:w-40 min-w-0" />
          </label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger data-testid="injuries-status-filter" className="h-10 w-36 sm:w-40 shrink-0 border-slate-700 bg-[#0E0E0E] text-white"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-[#0E0E0E] border-slate-700 text-white">
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s === "all" ? "All statuses" : s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center text-sm">
          {POS.map((p, k) => (
            <button key={p} data-testid={`injuries-pos-${p.toLowerCase()}`} onClick={() => setPos(p)}
              className={`px-3.5 py-1 ${k ? "border-l border-slate-700" : "pl-0"} ${pos === p ? "font-bold text-white" : "text-slate-400 hover:text-white"}`}>{p}</button>
          ))}
        </div>
        <span className="text-sm text-slate-500">Click a row for the projected lineup and Kalshi combos</span>
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#181818] overflow-x-auto">
        {!data ? <div className="py-16 text-center text-sm text-slate-500">Loading injury report…</div>
          : !games.length ? <div data-testid="injuries-empty" className="py-16 text-center text-sm text-slate-500">No injuries match these filters.</div> : (
          <table className="w-full text-sm">
            <thead><tr className="text-xs font-semibold text-slate-300 text-left">
              <th className="py-3.5 px-5">Player</th><th className="py-3.5 px-4">Status</th><th className="py-3.5 px-4">Injury</th>
              <th className="py-3.5 px-4">Est. return</th><th className="py-3.5 pr-5 text-right">Lineup</th>
            </tr></thead>
            <tbody>
              {games.map((g) => (
                <Fragment key={`${g.away}${g.home}`}>
                  <tr><td colSpan={5} className="pt-3"><div className="border-t border-slate-300/70" />
                    <span data-testid={`injuries-game-${g.away}-${g.home}`} className="relative -top-3 ml-0 inline-flex items-center gap-1.5 rounded-r-md bg-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-900"><TeamLogo team={g.away} size={16} light />{g.away} @ <TeamLogo team={g.home} size={16} light />{g.home} · {tip(g.start)}</span>
                  </td></tr>
                  {g.rows.map((r) => {
                    const id = `${g.away}${g.home}-${r.name}`;
                    return <InjuryRow key={id} r={r} g={g} settings={settings} i={id.replace(/\W+/g, "-").toLowerCase()} open={open === id} onToggle={() => setOpen(open === id ? null : id)} />;
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
