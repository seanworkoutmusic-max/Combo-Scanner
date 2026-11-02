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

const HeroWaves = () => (
  <div className="absolute inset-x-0 bottom-0 h-16 pointer-events-none">
    <svg className="scan-wave scan-wave-back" viewBox="0 0 400 40" preserveAspectRatio="none"><path d="M0 20 Q25 10 50 20 T100 20 T150 20 T200 20 T250 20 T300 20 T350 20 T400 20 V40 H0Z" /></svg>
    <svg className="scan-wave scan-wave-front" style={{ opacity: 0.35 }} viewBox="0 0 400 40" preserveAspectRatio="none"><path d="M0 24 Q25 14 50 24 T100 24 T150 24 T200 24 T250 24 T300 24 T350 24 T400 24 V40 H0Z" /></svg>
  </div>
);

export const ScanReady = ({ onScan, games }) => (
  <div data-testid="scanner-ready" className="relative overflow-hidden px-6 sm:px-10 pt-10 pb-16 bg-gradient-to-br from-[#12264a] via-[#0f1f3d] to-[#0b1830] scan-fade-in">
    <HeroWaves />
    <div className="relative grid lg:grid-cols-[auto_1fr_minmax(0,380px)] gap-8 items-center">
      <img src="/logo.png" alt="" className="hidden sm:block h-36 w-36 object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.5)]" />
      <div>
        <h3 className="font-display text-3xl font-bold text-white">Ready to dive in?</h3>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-300">
          Pick your combos in the filter, then we scan every game for live Kalshi combo prices against the sportsbooks.
        </p>
        <button data-testid="scanner-scan-btn" onClick={onScan}
          className="scan-glow mt-6 inline-flex items-center gap-2 h-12 px-7 rounded-xl bg-dolphin text-white text-base font-bold hover:bg-dolphin-light hover:-translate-y-0.5 transition-[background-color,transform]">
          <Sparkles className="h-4 w-4" /> Scan all {games ? `${games} ` : ""}games
        </button>
      </div>
      <div className="space-y-3">
        {STEPS_HOW.map(([t, s], i) => (
          <div key={t} data-testid={`scanner-step-${i + 1}`} className="flex items-center gap-4 rounded-xl border border-slate-700/80 bg-[#0b1830]/80 px-4 py-3">
            <span className="grid place-items-center h-7 w-7 shrink-0 rounded-full bg-dolphin/20 text-xs font-bold text-dolphin-light">{i + 1}</span>
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
      <div className="scan-card relative w-56 h-72 rounded-2xl border border-dolphin/30 overflow-hidden flex flex-col items-center justify-center">
        <div className="scan-shine" />
        <div className="relative w-full h-36 overflow-hidden">
          <img src="/logo.png" alt="" data-testid="scanner-loading-dolphin" className="scan-dolphin absolute left-1/2 bottom-6 h-20 w-20 -ml-10 object-contain" />
          <div className="scan-water absolute inset-x-0 bottom-0 h-10">
            <svg className="scan-wave scan-wave-back" viewBox="0 0 400 40" preserveAspectRatio="none"><path d="M0 20 Q25 10 50 20 T100 20 T150 20 T200 20 T250 20 T300 20 T350 20 T400 20 V40 H0Z" /></svg>
            <svg className="scan-wave scan-wave-front" viewBox="0 0 400 40" preserveAspectRatio="none"><path d="M0 22 Q25 12 50 22 T100 22 T150 22 T200 22 T250 22 T300 22 T350 22 T400 22 V40 H0Z" /></svg>
          </div>
        </div>
        <div className="relative mt-1 text-[10px] tracking-[0.4em] text-slate-400">SGP SCANNER</div>
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
