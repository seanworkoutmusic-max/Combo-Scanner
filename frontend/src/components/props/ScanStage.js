import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

const STEPS = [
  "Pulling Kalshi combo markets…",
  "Asking market makers for live quotes…",
  "Pricing DraftKings, Fanatics, BetMGM & Hard Rock…",
  "Devigging and ranking by EV…",
];

const SKELETON = [["w-[52%]", "w-16", "w-20", "w-24", "w-16"], ["w-[42%]", "w-16", "w-20", "w-24", "w-12"], ["w-[48%]", "w-16", "w-20", "w-24", "w-16"], ["w-[36%]", "w-16", "w-20", "w-24", "w-14"]];

export const ScanReady = ({ onScan, games }) => (
  <div data-testid="scanner-ready" className="scan-fade-in">
    <div className="hidden sm:grid grid-cols-[minmax(0,2.2fr)_1fr_1fr_1fr_1fr] px-5 py-3 font-mono text-[11px] tracking-[0.12em] text-slate-500 border-b border-slate-800">
      <span>COMBO</span><span>GAME</span><span>KALSHI</span><span>BEST BOOK</span><span className="text-right">EV</span>
    </div>
    {SKELETON.map((r, i) => (
      <div key={i} className="hidden sm:grid grid-cols-[minmax(0,2.2fr)_1fr_1fr_1fr_1fr] items-center px-5 py-4 border-b border-slate-800/60 opacity-40">
        {r.map((w, j) => <div key={j} className={`h-2 rounded-full bg-slate-700 ${j === 0 ? "w-full" : w} ${j === 4 ? "ml-auto" : ""}`} style={j === 0 ? { maxWidth: w.slice(3, -1) } : undefined} />)}
      </div>
    ))}
    <div className="py-12 text-center px-6">
      <h3 className="text-base font-bold text-white">Nothing scanned yet</h3>
      <p className="mt-3 mx-auto max-w-sm text-sm leading-relaxed text-slate-400">
        Pick your combos in the filter, then scan all {games ? `${games} ` : ""}games for live Kalshi prices against the books.
      </p>
      <button data-testid="scanner-scan-btn" onClick={onScan}
        className="mt-6 inline-flex items-center h-11 px-5 rounded-lg bg-white text-slate-950 text-sm font-semibold hover:bg-slate-200 hover:-translate-y-0.5 transition-[background-color,transform]">
        Scan combos
      </button>
    </div>
  </div>
);

export const ScanLoader = ({ progress }) => {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 3200);
    return () => clearInterval(t);
  }, []);
  return (
    <div data-testid="scanner-loading" className="py-20 flex flex-col items-center scan-fade-in">
      <Loader2 data-testid="scanner-spinner" className="h-8 w-8 text-white animate-spin" />
      <div key={step} data-testid="scanner-loading-step" className="mt-5 text-sm text-slate-300 scan-fade-in">{STEPS[step]}</div>
      <p className="mt-2 text-xs font-mono text-slate-500">
        {progress ? `Combo ${Math.min(progress.done + 1, progress.total)} of ${progress.total} · ~25s each` : "Usually 10–40 seconds"}
      </p>
    </div>
  );
};
