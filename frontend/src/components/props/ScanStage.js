import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

const STEPS = [
  "Pulling Kalshi combo markets…",
  "Asking market makers for live quotes…",
  "Pricing FanDuel same-game parlays…",
  "Devigging and ranking by EV…",
];

const STEPS_HOW = [
  ["Choose combos", "Points, boards, triple-doubles"],
  ["We devig FanDuel", "FanDuel SGP fair odds"],
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
          className="mt-6 inline-flex items-center gap-2 h-12 px-7 rounded-xl bg-white text-slate-950 text-base font-bold hover:bg-slate-200 hover:-translate-y-0.5 transition-[background-color,transform]">
          <Sparkles className="h-4 w-4" /> Scan all {games ? `${games} ` : ""}games
        </button>
      </div>
      <div className="space-y-3">
        {STEPS_HOW.map(([t, s], i) => (
          <div key={t} data-testid={`scanner-step-${i + 1}`} className="flex items-center gap-4 rounded-xl border border-slate-800 bg-[#0E0E0E] px-4 py-3">
            <span className="grid place-items-center h-7 w-7 shrink-0 rounded-full bg-white/10 text-xs font-bold text-white">{i + 1}</span>
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
    <div data-testid="scanner-loading" className="py-20 flex flex-col items-center scan-fade-in">
      <Loader2 data-testid="scanner-spinner" className="h-8 w-8 text-white animate-spin" />
      <div key={step} data-testid="scanner-loading-step" className="mt-5 text-sm text-slate-300 scan-fade-in">{STEPS[step]}</div>
      <p className="mt-2 text-xs font-mono text-slate-500">
        {progress ? `Combo ${Math.min(progress.done + 1, progress.total)} of ${progress.total} · ~25s each` : "Usually 10–40 seconds"}
      </p>
    </div>
  );
};
