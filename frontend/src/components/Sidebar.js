import { BookOpen, ClipboardList, Crosshair, Layers, Search } from "lucide-react";
import { HowItWorks } from "./HowItWorks";

const TABS = [
  { id: "props", label: "Parlay Builder", testid: "nav-tab-props", icon: Layers },
  { id: "scanner", label: "TD Scanner", testid: "nav-tab-scanner", icon: Search },
  { id: "live", label: "In-Game Tracker", testid: "nav-tab-live", icon: Crosshair },
  { id: "bets", label: "Bet Tracker", testid: "nav-tab-bets", icon: ClipboardList },
];

const Logo = ({ collapsible }) => (
  <div className="flex items-center gap-2.5">
    <img data-testid="site-logo" src="/logo.png" alt="Prop Outliers logo" className="h-6 w-6 rounded object-cover shrink-0" />
    <span data-testid="site-title" className={`font-display font-bold text-[17px] tracking-tight whitespace-nowrap ${collapsible ? "hidden min-[1440px]:inline" : ""}`}>Prop Outliers</span>
  </div>
);

const NavItem = ({ t, active, onClick, compact }) => {
  const Icon = t.icon;
  return (
    <button data-testid={compact ? `${t.testid}-mobile` : t.testid} onClick={onClick} title={t.label}
      className={`flex items-center gap-2.5 rounded-lg text-sm transition-colors ${compact ? "px-2.5 py-1.5 gap-1.5 whitespace-nowrap shrink-0" : "w-full px-3 py-2 justify-center min-[1440px]:justify-start"} ${
        active ? "bg-white/[0.08] text-white font-semibold" : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
      }`}>
      <Icon className="h-4 w-4 shrink-0" /> <span className={compact ? "" : "hidden min-[1440px]:inline whitespace-nowrap"}>{t.label}</span>
    </button>
  );
};

export const Sidebar = ({ tab, setTab, kalshiOk }) => (
  <>
    <aside className="hidden lg:flex fixed inset-y-0 left-0 w-16 min-[1440px]:w-56 flex-col border-r border-slate-800/80 bg-[#0E0E0E] px-3 py-5 z-30">
      <div className="px-2 mb-8"><Logo collapsible /></div>
      <div className="px-3 mb-2 text-xs font-medium text-slate-500 hidden min-[1440px]:block">Kalshi</div>
      <nav className="space-y-0.5">
        {TABS.map((t) => <NavItem key={t.id} t={t} active={tab === t.id} onClick={() => setTab(t.id)} />)}
      </nav>
      <div className="mt-auto space-y-3 px-1 min-[1440px]:px-3">
        <HowItWorks trigger={
          <button data-testid="nav-btn-how-it-works" title="How it works" className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
            <BookOpen className="h-4 w-4 shrink-0" /> <span className="hidden min-[1440px]:inline">How it works</span>
          </button>
        } />
        <div data-testid="nav-status-kalshi" title={kalshiOk ? "Kalshi live" : "Kalshi offline"} className="flex items-center gap-2 text-xs text-slate-500">
          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${kalshiOk ? "bg-emerald-400" : "bg-slate-600"}`} />
          <span className="hidden min-[1440px]:inline">{kalshiOk ? "Kalshi live" : "Kalshi offline"}</span>
        </div>
      </div>
    </aside>
    <header className="lg:hidden sticky top-0 z-30 border-b border-slate-800/80 bg-[#0E0E0E]/95 backdrop-blur-xl px-4 py-3 space-y-3">
      <Logo />
      <nav className="flex gap-1 overflow-x-auto">
        {TABS.map((t) => <NavItem key={t.id} t={t} compact active={tab === t.id} onClick={() => setTab(t.id)} />)}
      </nav>
    </header>
  </>
);
