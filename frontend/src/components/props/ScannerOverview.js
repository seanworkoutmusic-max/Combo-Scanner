const tip = (g) => (g.start ? new Date(g.start).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "TBA");

const GameCard = ({ g, status, busy }) => {
  const [away, home] = [g.code.slice(-6, -3), g.code.slice(-3)];
  return (
    <div data-testid={`slate-game-${g.code}`} className="rounded-xl border border-slate-800 bg-[#121212] px-4 py-3.5 hover:border-slate-600 transition-colors">
      <div className="font-mono text-base font-bold text-white">{away} <span className="text-slate-600 font-normal">@</span> {home}</div>
      <div className="mt-1.5 font-mono text-[11px] text-slate-500">
        {tip(g)} · <span data-testid={`slate-status-${g.code}`} className={busy ? "text-white" : status ? "text-emerald-400" : ""}>
          {busy ? "scanning…" : status != null ? `${status} combo${status === 1 ? "" : "s"}` : "not scanned"}
        </span>
      </div>
    </div>
  );
};

export const SlateCards = ({ games, counts, scanning }) => !games?.length ? null : (
  <div className="space-y-3">
    <div className="flex items-end justify-between">
      <h2 className="text-base font-bold text-white">Tonight</h2>
      <span className="font-mono text-xs text-slate-500">{new Date(`${games[0].date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "2-digit", day: "2-digit" }).replace(",", " ·")}</span>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
      {games.map((g) => <GameCard key={g.code} g={g} status={counts[g.code]} busy={scanning === "all" || scanning === g.code} />)}
    </div>
  </div>
);

const Stat = ({ label, value, accent, testid }) => (
  <div className="px-5 py-5 border-slate-800 [&:nth-child(even)]:border-l md:[&:not(:first-child)]:border-l [&:nth-child(-n+2)]:border-b md:[&:nth-child(-n+2)]:border-b-0">
    <div className="font-mono text-[11px] tracking-[0.12em] text-slate-500 uppercase">{label}</div>
    <div data-testid={testid} className={`mt-3 font-mono text-3xl font-bold ${accent ? "text-emerald-400" : "text-white"}`}>{value}</div>
  </div>
);

export const StatsRow = ({ games, books, evCount, best }) => (
  <div data-testid="scanner-stats" className="grid grid-cols-2 md:grid-cols-4 rounded-xl border border-slate-800 bg-[#121212] overflow-hidden">
    <Stat label="Games" value={games ?? "—"} testid="stat-games" />
    <Stat label="Books" value={books} testid="stat-books" />
    <Stat label="+EV Combos" value={evCount ?? "—"} testid="stat-ev-combos" />
    <Stat label="Best Edge" value={best == null ? "—" : `${best > 0 ? "+" : ""}${(best * 100).toFixed(1)}%`} accent={best > 0} testid="stat-best-edge" />
  </div>
);
