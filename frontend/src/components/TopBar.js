export const TopBar = ({ crumb, kalshiOk, updatedAt }) => (
  <div data-testid="top-bar" className="hidden lg:flex sticky top-0 z-20 h-11 items-center justify-between border-b border-slate-800/80 bg-[#0B0B0B]/90 backdrop-blur-xl px-8 font-mono text-xs">
    <div data-testid="top-bar-crumb" className="text-slate-500">
      {crumb[0]} <span className="mx-1.5 text-slate-700">/</span> <span className="text-white">{crumb[1]}</span>
    </div>
    <div className="flex items-center gap-4 text-slate-400">
      <span data-testid="nav-status-kalshi" className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${kalshiOk ? "bg-white" : "bg-slate-600"}`} />
        {kalshiOk ? "Kalshi connected" : "Kalshi offline"}
      </span>
      <span data-testid="top-bar-books">DK · Fanatics · BetMGM · Hard Rock</span>
      <span data-testid="top-bar-updated">odds updated {updatedAt ? new Date(updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—"}</span>
    </div>
  </div>
);

export const PageTitle = ({ eyebrow, children, testid }) => (
  <div>
    <div className="font-mono text-xs tracking-[0.15em] text-slate-500 uppercase">{eyebrow}</div>
    <h1 data-testid={testid} className="mt-2 font-display text-4xl sm:text-5xl font-bold tracking-tight text-white">{children}</h1>
  </div>
);
