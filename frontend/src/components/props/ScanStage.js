import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

const STEPS = [
  "Pulling Kalshi combo markets…",
  "Asking market makers for live quotes…",
  "Pricing DraftKings, Fanatics, BetMGM & Hard Rock…",
  "Devigging and ranking by EV…",
];

const STEPS_HOW = [
  ["Choose combos", "Points, boards, triple-doubles"],
  ["We devig the books", "DraftKings, Fanatics, BetMGM & Hard Rock fair odds"],
  ["Bet the edge on Kalshi", "Ranked by EV, one tap to place"],
];


export const ScanReady = ({ onScan, games }) => (
  <div data-testid="scanner-ready" className="relative overflow-hidden px-6 sm:px-10 py-12 scan-fade-in">
    <div className="relative grid lg:grid-cols-[1fr_minmax(0,380px)] gap-8 items-center">
      <div>
        <h3 className="font-display text-3xl font-bold text-white">Ready when you are</h3>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-300">
          Pick your combos in the filter, then we scan every game for live Kalshi combo prices against the sportsbooks.
        </p>
        <button data-testid="scanner-scan-btn" onClick={onScan}
          className="scan-glow mt-6 inline-flex items-center gap-2 h-12 px-7 rounded-xl bg-emerald-400 text-slate-950 text-base font-bold hover:bg-emerald-300 hover:-translate-y-0.5 transition-[background-color,transform]">
          <Sparkles className="h-4 w-4" /> Scan all {games ? `${games} ` : ""}games
        </button>
      </div>
      <div className="space-y-3">
        {STEPS_HOW.map(([t, s], i) => (
          <div key={t} data-testid={`scanner-step-${i + 1}`} className="flex items-center gap-4 rounded-xl border border-slate-800 bg-[#0E0E0E] px-4 py-3">
            <span className="grid place-items-center h-7 w-7 shrink-0 rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-400">{i + 1}</span>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-white">{t}</div>
              <div className="text-xs text-slate-400 mt-0.5">{s}</div>
            </div>
          </div>
        ))}
      </div>
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
    <div data-testid="scanner-loading" className="py-16 flex flex-col items-center scan-fade-in">
      <div className="scan-card relative w-56 h-72 rounded-2xl border border-emerald-500/30 overflow-hidden flex flex-col items-center justify-center">
        <div className="scan-shine" />
        <div className="relative font-display text-xl font-extrabold tracking-[0.18em] text-white">
          PROP<span className="text-emerald-400">OUTLIERS</span>
        </div>
        <div className="relative mt-2 text-[10px] tracking-[0.4em] text-slate-400">SGP SCANNER</div>
        <div key={step} data-testid="scanner-loading-step"
          className="relative mt-6 mx-4 px-3 py-1.5 rounded-full border border-white/10 bg-black/30 text-[11px] text-slate-300 text-center scan-fade-in">
          {STEPS[step]}
        </div>
      </div>
      <div className="mt-5 flex items-center gap-1.5">
        {[0, 1, 2].map((i) => <span key={i} className="scan-dot h-1.5 w-1.5 rounded-full bg-emerald-400" style={{ animationDelay: `${i * 0.2}s` }} />)}
      </div>
      <p className="mt-3 text-xs font-mono text-slate-500">
        {progress ? `Combo ${Math.min(progress.done + 1, progress.total)} of ${progress.total} · ~25s each` : "Usually 10–40 seconds"}
      </p>
    </div>
  );
};
