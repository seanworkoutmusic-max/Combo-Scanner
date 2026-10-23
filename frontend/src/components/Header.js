import { Activity, BookOpen } from "lucide-react";
import { HowItWorks } from "./HowItWorks";

const Dot = ({ ok, label, testid }) => (
  <span data-testid={testid} className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-slate-400">
    <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-amber-400"}`} />
    {label}
  </span>
);

const TABS = [
  { id: "props", label: "Player Props", testid: "nav-tab-props" },
  { id: "scanner", label: "DD/TD Scanner", testid: "nav-tab-scanner" },
];

export const Header = ({ tab, setTab, status, kalshiOk }) => (
  <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#07090E]/85 backdrop-blur-xl">
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-6">
      <div className="flex items-center gap-2.5">
        <div className="h-8 w-8 rounded bg-cyan-400/10 border border-cyan-400/40 grid place-items-center">
          <Activity className="h-4 w-4 text-cyan-300" />
        </div>
        <div className="leading-none hidden sm:block">
          <div className="font-display font-bold text-lg tracking-tight">ODDS<span className="text-cyan-300">KING</span></div>
          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Kalshi prop EV</div>
        </div>
      </div>
      <nav className="flex items-center gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            data-testid={t.testid}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-sm rounded transition-colors ${
              tab === t.id ? "bg-cyan-400/10 text-cyan-200 border border-cyan-400/30" : "text-slate-400 hover:text-slate-100 border border-transparent"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-4">
        <Dot ok={kalshiOk} label="KALSHI" testid="nav-status-kalshi" />
        <Dot ok={status?.opticodds_key} label="OPTICODDS" testid="nav-status-opticodds" />
        <HowItWorks
          trigger={
            <button data-testid="nav-btn-how-it-works" className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-cyan-200 transition-colors">
              <BookOpen className="h-4 w-4" /> <span className="hidden md:inline">How it works</span>
            </button>
          }
        />
      </div>
    </div>
  </header>
);
