import { BookOpen, ClipboardList, Crosshair, Layers, Search } from "lucide-react";
import { HowItWorks } from "./HowItWorks";

export const TABS = [
  { id: "props", label: "Parlay Builder", testid: "nav-tab-props", icon: Layers, crumb: ["builder", "parlay"] },
  { id: "scanner", label: "SGP Scanner", testid: "nav-tab-scanner", icon: Search, crumb: ["scanner", "sgp"] },
  { id: "live", label: "In-Game Tracker", testid: "nav-tab-live", icon: Crosshair, crumb: ["tracker", "in-game"] },
  { id: "bets", label: "Bet Tracker", testid: "nav-tab-bets", icon: ClipboardList, crumb: ["tracker", "bets"] },
];

const Logo = () => (
  <div className="grid place-items-center h-9 w-9 rounded-lg bg-white">
    <img data-testid="site-logo" src="/logo.png" alt="Kalshi Combo Scanner logo" className="h-6 w-6 object-contain invert" />
  </div>
);

const Tip = ({ children }) => (
  <span className="pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md border border-slate-800 bg-[#0E0E0E] px-2.5 py-1 text-xs font-semibold text-white opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-[opacity,transform] z-50">
    {children}
  </span>
);

const NavItem = ({ t, active, onClick, compact }) => {
  const Icon = t.icon;
  if (compact) {
    return (
      <button data-testid={`${t.testid}-mobile`} onClick={onClick}
        className={`flex items-center gap-1.5 rounded-lg text-sm px-2.5 py-1.5 whitespace-nowrap shrink-0 transition-colors ${active ? "bg-white/[0.08] text-white font-semibold" : "text-slate-400 hover:text-white"}`}>
        <Icon className="h-4 w-4" /> {t.label}
      </button>
    );
  }
  return (
    <button data-testid={t.testid} onClick={onClick} aria-label={t.label}
      className={`group relative grid place-items-center h-10 w-10 rounded-lg border transition-colors ${active ? "border-slate-700 bg-white/[0.06] text-white" : "border-transparent text-slate-500 hover:text-white hover:bg-white/[0.04]"}`}>
      <Icon className="h-4 w-4" />
      <Tip>{t.label}</Tip>
    </button>
  );
};

export const Sidebar = ({ tab, setTab }) => (
  <>
    <aside className="hidden lg:flex fixed inset-y-0 left-0 w-16 flex-col items-center border-r border-slate-800/80 bg-[#0B0B0B] py-4 z-30">
      <Logo />
      <nav className="mt-8 flex flex-col items-center gap-2">
        {TABS.map((t) => <NavItem key={t.id} t={t} active={tab === t.id} onClick={() => setTab(t.id)} />)}
      </nav>
      <div className="mt-auto">
        <HowItWorks trigger={
          <button data-testid="nav-btn-how-it-works" aria-label="How it works"
            className="group relative grid place-items-center h-10 w-10 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.04] transition-colors">
            <BookOpen className="h-4 w-4" />
            <Tip>How it works</Tip>
          </button>
        } />
      </div>
    </aside>
    <header className="lg:hidden sticky top-0 z-30 border-b border-slate-800/80 bg-[#0B0B0B]/95 backdrop-blur-xl px-4 py-3 space-y-3">
      <Logo />
      <nav className="flex gap-1 overflow-x-auto">
        {TABS.map((t) => <NavItem key={t.id} t={t} compact active={tab === t.id} onClick={() => setTab(t.id)} />)}
      </nav>
    </header>
  </>
);
