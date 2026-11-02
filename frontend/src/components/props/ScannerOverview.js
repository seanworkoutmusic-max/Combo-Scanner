import { TeamLogo } from "./TeamLogo";




const tip = (g) => (g.start ? new Date(g.start).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Tip-off TBA");

const GameCard = ({ g, status, busy }) => {
  const [away, home] = [g.code.slice(-6, -3), g.code.slice(-3)];
  return (
    <div data-testid={`slate-game-${g.code}`} className="rounded-xl border border-slate-800 bg-[#0D1B33] p-4 flex flex-col gap-3 hover:border-dolphin/50 transition-colors">
      <div className="flex items-center justify-between font-mono text-base font-bold text-white">
        <span className="flex items-center gap-1.5"><TeamLogo team={away} size={20} />{away}</span>
        <span className="text-[10px] font-sans font-normal text-slate-500">at</span>
        <span className="flex items-center gap-1.5">{home}<TeamLogo team={home} size={20} /></span>
      </div>
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="text-slate-400 font-mono">{tip(g)}</span>
        <span data-testid={`slate-status-${g.code}`} className={`px-2 py-0.5 rounded-md ${busy ? "bg-dolphin/20 text-dolphin-light" : status != null ? "bg-emerald-500/10 text-emerald-400" : "bg-white/[0.04] text-slate-400"}`}>
          {busy ? "Scanning…" : status != null ? `${status} combo${status === 1 ? "" : "s"}` : "Not scanned"}
        </span>
      </div>
    </div>
  );
};

export const SlateCards = ({ games, counts, scanning }) => !games?.length ? null : (
  <div className="space-y-3">
    <div className="flex items-end justify-between">
      <h2 className="font-display text-lg font-bold text-white">Tonight's slate</h2>
      <span className="text-xs text-slate-500">{new Date(`${games[0].date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
      {games.map((g) => <GameCard key={g.code} g={g} status={counts[g.code]} busy={scanning === "all" || scanning === g.code} />)}
    </div>
  </div>
);
