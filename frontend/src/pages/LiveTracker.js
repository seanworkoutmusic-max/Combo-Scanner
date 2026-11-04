import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { PageTitle } from "../components/TopBar";
import { getLiveTracker, getBets, errMsg } from "../lib/api";
import { PlayerPhoto } from "../components/props/PlayerPhoto";
import { TeamLogo } from "../components/props/TeamLogo";

const STATS = [["pts", "PTS"], ["reb", "REB"], ["ast", "AST"]];
// Green heat on "Need": brightest for players closest to a triple-double.
const heat = (need) => `rgba(16, 185, 129, ${Math.max(0.06, 0.7 - need * 0.06).toFixed(3)})`;
// Hidden test hook: ?date=YYYYMMDD&final=1 replays a past slate.
const testParams = () => {
  const q = new URLSearchParams(window.location.search);
  return q.get("date") ? { date: q.get("date"), include_final: q.get("final") === "1" } : {};
};

const normName = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+(jr|sr|ii|iii|iv)$/, "").trim();
const LEG_STAT = { Points: ["pts", "PTS"], Rebounds: ["reb", "REB"], Assists: ["ast", "AST"] };
const BET_TONE = { won: "text-emerald-400", lost: "text-red-400", void: "text-slate-500", pending: "text-white" };

const MyBets = ({ p, bets, slug }) => (
  <td data-testid={`live-mybets-${slug}`} className="py-2.5 px-4 text-left">
    {bets.length ? bets.map((b) => (
      <div key={b.id} className={`text-[11px] font-mono whitespace-nowrap ${BET_TONE[b.status]}`}>
        {b.legs.map((l) => {
          const [k, lbl] = LEG_STAT[l.market] || [null, l.market];
          const v = k ? p[k] : null, hit = v != null && v >= l.threshold;
          return <span key={l.ticker} className={`mr-2 ${hit ? "text-emerald-400 font-bold" : ""}`}>{lbl} {v ?? "–"}/{l.threshold}</span>;
        })}
        <span className="text-[10px] uppercase tracking-wider text-slate-500">{b.status === "pending" ? "live" : b.status}</span>
      </div>
    )) : <span className="text-slate-700">—</span>}
  </td>
);

const GameChip = ({ g }) => (
  <div data-testid={`live-game-${g.id}`} className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800 bg-[#121212] text-sm font-semibold">
    <TeamLogo team={g.away} size={16} />{g.away} <span className="font-mono text-white">{g.away_score}</span>
    <span className="text-slate-600">–</span>
    <span className="font-mono text-white">{g.home_score}</span> {g.home}<TeamLogo team={g.home} size={16} />
    <span className="ml-1 text-[11px] font-mono font-normal text-emerald-400">{g.clock}</span>
  </div>
);

const Row = ({ p, i, game, bets }) => {
  const slug = `${p.game}-${p.key.replace(/\s/g, "-")}`;
  return (
    <tr data-testid={`live-row-${slug}`} className="border-t border-slate-800/70 hover:bg-white/[0.03] transition-colors">
      <td className="py-2.5 px-4 text-sm text-slate-400 font-mono">{i + 1}</td>
      <td className="py-2.5 px-4">
        <div className="flex items-center gap-3">
          <PlayerPhoto src={p.headshot} name={p.name} size={32} />
          <div className="flex items-center gap-1.5 text-sm whitespace-nowrap">
            <span className="font-semibold text-white">{p.name}</span>
            {p.on_court && <span data-testid={`live-oncourt-${slug}`} title="On the court" className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />}
            <TeamLogo team={p.team} size={15} />
            <span className="text-slate-400">{p.team}</span>
            <span className="text-slate-500">vs {p.opp}</span>
          </div>
        </div>
      </td>
      <td className="py-2.5 px-4 text-right font-mono text-xs text-slate-500 whitespace-nowrap">{game?.clock}</td>
      <td className="py-2.5 px-4 text-right font-mono text-sm text-slate-400">{p.min}</td>
      {STATS.map(([k]) => (
        <td key={k} data-testid={`live-${k}-${slug}`} className={`py-2.5 px-4 text-right font-mono text-sm ${p[k] >= 10 ? "text-emerald-400 font-bold" : "text-slate-200"}`}>{p[k]}</td>
      ))}
      <td data-testid={`live-need-${slug}`} style={{ background: heat(p.need) }} className="py-2.5 px-4 text-center font-mono text-sm font-bold text-white">
        {p.need === 0 ? "10/10" : p.need}
      </td>
      {bets && <MyBets p={p} bets={bets} slug={slug} />}
    </tr>
  );
};

export default function LiveTracker() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [bets, setBets] = useState([]);
  const [mine, setMine] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    getBets().then(setBets).catch(() => {});
    try {
      setData(await getLiveTracker(testParams()));
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const games = Object.fromEntries((data?.games || []).map((g) => [g.id, g]));
  const betsBy = {};
  bets.forEach((b) => { (betsBy[normName(b.player)] ||= []).push(b); });
  const all = data?.players || [];
  const players = mine ? all.filter((p) => betsBy[normName(p.name)]) : all;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <PageTitle eyebrow="Tools / 03" testid="live-tracker-title">In-Game Tracker</PageTitle>
          <p className="text-sm text-slate-400 mt-3 max-w-xl">Every player in games in progress, ranked by how many rebounds and assists they still need to reach 10 of each (points ignored).</p>
          <p data-testid="live-updated" className="text-sm font-semibold text-white mt-1">
            {data ? `Updated ${new Date(data.updated_at).toLocaleTimeString()} · refreshes every 30 seconds` : "Loading live box scores…"}
          </p>
        </div>
        <div className="flex items-center gap-3">
        <button data-testid="live-refresh-btn" onClick={load} disabled={loading}
          className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white text-slate-950 text-sm font-semibold hover:bg-slate-200 disabled:opacity-50 transition-colors">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
        </div>
      </div>

      {data?.games?.length > 0 && (
        <div data-testid="live-games" className="flex gap-2 overflow-x-auto">{data.games.map((g) => <GameChip key={g.id} g={g} />)}</div>
      )}

      <div data-testid="live-view-tabs" className="flex items-center gap-6 border-b border-slate-800">
        {[[false, "All Players"], [true, "My Bets"]].map(([v, l]) => (
          <button key={l} data-testid={`live-tab-${v ? "mine" : "all"}`} onClick={() => setMine(v)}
            className={`flex items-center gap-2 pb-2.5 -mb-px border-b-2 text-sm font-semibold transition-colors ${mine === v ? "border-white text-white" : "border-transparent text-slate-500 hover:text-slate-300"}`}>
            {l}
            {v && <span className="text-[11px] font-mono text-slate-500">{all.filter((p) => betsBy[normName(p.name)]).length}</span>}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#121212] overflow-x-auto">
        <table data-testid="live-table" className="w-full min-w-[1040px]">
          <thead>
            <tr className="text-xs text-slate-400">
              <th className="py-3 px-4 text-left font-semibold">#</th>
              <th className="py-3 px-4 text-left font-semibold">Player</th>
              <th className="py-3 px-4 text-right font-semibold">Game</th>
              <th className="py-3 px-4 text-right font-semibold">MIN</th>
              {STATS.map(([k, l]) => <th key={k} className="py-3 px-4 text-right font-semibold">{l}</th>)}
              <th className="py-3 px-4 text-center font-semibold text-white border-b-2 border-slate-300" title="Rebounds + assists still needed to reach 10/10">Need (RA)</th>
              {mine && <th className="py-3 px-4 text-left font-semibold">My Bets</th>}
            </tr>
          </thead>
          <tbody>
            {players.map((p, i) => <Row key={`${p.game}-${p.key}`} p={p} i={i} game={games[p.game]} bets={mine ? betsBy[normName(p.name)] || [] : null} />)}
          </tbody>
        </table>
        {data && !players.length && (
          <div data-testid="live-empty" className="py-16 text-center text-sm text-slate-500">
            {mine && all.length ? "None of your tracked players are in a game right now." : "No games in progress right now."}
            {!(mine && all.length) && data.next_tip && ` Next tip-off: ${new Date(data.next_tip).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}.`}
          </div>
        )}
      </div>
    </div>
  );
}
