import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

const STEPS = [
  "Pulling Kalshi combo markets…",
  "Asking market makers for live quotes…",
  "Pricing DraftKings, Fanatics, BetMGM & Hard Rock…",
  "Devigging and ranking by EV…",
];

export const ScanReady = ({ onScan }) => (
  <div data-testid="scanner-ready" className="py-20 px-6 flex flex-col items-center text-center scan-fade-in">
    <h3 className="text-base font-bold text-white">Ready when you are</h3>
    <p className="mt-2 max-w-md text-sm text-slate-400">
      Pick your combos in the filter, then scan every game for live Kalshi combo prices against the sportsbooks.
    </p>
    <button data-testid="scanner-scan-btn" onClick={onScan}
      className="scan-glow mt-6 flex items-center gap-2 h-12 px-8 rounded-xl bg-dolphin text-white text-base font-bold hover:bg-dolphin-light hover:-translate-y-0.5 transition-[background-color,transform]">
      <Sparkles className="h-4 w-4" /> Scan combos
    </button>
  </div>
);

export const ScanLoader = ({ progress }) => {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 3200);
    return () => clearInterval(t);
  }, []);
  return (
    <div data-testid="scanner-loading" className="py-16 flex flex-col items-center scan-fade-in">
      <div className="scan-card relative w-56 h-72 rounded-2xl border border-dolphin/30 overflow-hidden flex flex-col items-center justify-center">
        <div className="scan-shine" />
        <div className="relative font-display text-xl font-extrabold tracking-[0.18em] text-white">
          PROP<span className="text-dolphin-light">OUTLIERS</span>
        </div>
        <div className="relative mt-2 text-[10px] tracking-[0.4em] text-slate-400">SGP SCANNER</div>
        <div key={step} data-testid="scanner-loading-step"
          className="relative mt-6 mx-4 px-3 py-1.5 rounded-full border border-white/10 bg-black/30 text-[11px] text-slate-300 text-center scan-fade-in">
          {STEPS[step]}
        </div>
      </div>
      <div className="mt-5 flex items-center gap-1.5">
        {[0, 1, 2].map((i) => <span key={i} className="scan-dot h-1.5 w-1.5 rounded-full bg-dolphin-light" style={{ animationDelay: `${i * 0.2}s` }} />)}
      </div>
      <p className="mt-3 text-xs font-mono text-slate-500">
        {progress ? `Combo ${Math.min(progress.done + 1, progress.total)} of ${progress.total} · ~25s each` : "Usually 10–40 seconds"}
      </p>
    </div>
  );
};
