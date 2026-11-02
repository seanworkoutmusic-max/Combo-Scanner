import { TeamLogo } from "./TeamLogo";

const Card = ({ label, value, sub, tone = "text-white", testid }) => (
  <div data-testid={testid} className="rounded-xl border border-slate-800 bg-[#0D1B33] px-5 py-4">
    <div className="text-xs text-slate-400">{label}</div>
    <div className={`mt-2 font-mono text-2xl font-bold ${tone}`}>{value}</div>
    <div className="mt-1.5 text-[11px] text-slate-500 truncate">{sub}</div>
  </div>
);

const fmtDay = (d) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "2-digit", day: "2-digit" });

export const ScannerStats = ({ games, books, best, plusEv, scanned }) => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
    <Card testid="stat-games" label="Games on the slate" value={games?.length ?? "—"} sub={games?.length ? `NBA · ${fmtDay(games[0].date)}` : "NBA"} />
    <Card testid="stat-books" label="Books compared" value={books.length} sub={books.join(" · ")} />
    <Card testid="stat-best" label="Best edge" tone={best ? "text-emerald-400" : "text-white"}
      value={best ? `+${(best.ev * 100).toFixed(1)}%` : "—"} sub={best ? `${best.name} · ${best.combos[0].legs.length}-leg SGP` : "Run a scan to find it"} />
    <Card testid="stat-plus-ev" label="+EV combos found" value={scanned ? plusEv : "—"} sub={scanned ? "On the current board" : "Run a scan to fill this in"} />
  </div>
);

const tip = (g) => (g.start ? new Date(g.start).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Tip-off TBA");

const GameCard = ({ g, status, busy, onScan }) => {
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
      <button data-testid={`slate-scan-${g.code}`} onClick={onScan} disabled={busy}
        className="h-9 rounded-lg border border-slate-700 text-sm font-semibold text-white hover:border-dolphin hover:bg-dolphin/15 disabled:opacity-50 transition-colors">
        Scan this game
      </button>
    </div>
  );
};

export const SlateCards = ({ games, counts, scanning, onScan }) => !games?.length ? null : (
  <div className="space-y-3">
    <div className="flex items-end justify-between">
      <h2 className="font-display text-lg font-bold text-white">Tonight's slate</h2>
      <span className="text-xs text-slate-500">{new Date(`${games[0].date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
      {games.map((g) => <GameCard key={g.code} g={g} status={counts[g.code]} busy={scanning === g.code} onScan={() => onScan(g.code)} />)}
    </div>
  </div>
);
