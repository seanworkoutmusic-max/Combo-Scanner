import { KeyRound } from "lucide-react";

export const SetupBanner = () => (
  <div data-testid="banner-opticodds-warning" className="flex items-start gap-3 border border-slate-500/40 bg-slate-500/5 rounded-md px-4 py-3">
    <KeyRound className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
    <div className="text-sm text-slate-300">
      <span className="font-semibold text-slate-300">OpticOdds key not connected.</span> Live Kalshi prices are shown, but fair values
      and EV need sportsbook SGP prices. Add your OpticOdds API key to turn them on.
    </div>
  </div>
);
