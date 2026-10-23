import { fmtAmerican, fmtPct, probToAmerican } from "../../lib/ev";
import { PriceTag } from "./MarketList";

const Ev = ({ ev, testid }) => (
  <span data-testid={testid} className={`font-mono font-bold ${ev == null ? "text-slate-600" : ev > 0 ? "text-emerald-400" : "text-red-400"}`}>
    {ev == null ? "—" : `${ev > 0 ? "+" : ""}${(ev * 100).toFixed(1)}%`}
  </span>
);

export const Verdict = ({ fair, price, ev, books, format, prefix }) => (
  <div data-testid={`${prefix}-verdict`} className="grid grid-cols-3 gap-2">
    <div className="rounded border border-slate-800 bg-slate-950/50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest font-mono text-slate-500">Fair ({books} bk)</div>
      <div data-testid={`${prefix}-fair`} className="font-mono text-base text-cyan-200 truncate">{fair == null ? "—" : fmtAmerican(probToAmerican(fair))}</div>
      <div className="text-[10px] font-mono text-slate-500">{fmtPct(fair)}</div>
    </div>
    <div className="rounded border border-slate-800 bg-slate-950/50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest font-mono text-slate-500">Kalshi{format === "fee" ? " (incl. fee)" : ""}</div>
      <div data-testid={`${prefix}-kalshi`} className="font-mono text-base text-sky-300"><PriceTag p={price} format={format} /></div>
      <div className="text-[10px] font-mono text-slate-500">{price ? fmtPct(price) : "—"}</div>
    </div>
    <div className={`rounded border px-3 py-2 ${ev > 0 ? "border-emerald-500/50 bg-emerald-500/10" : "border-slate-800 bg-slate-950/50"}`}>
      <div className="text-[10px] uppercase tracking-widest font-mono text-slate-500">EV</div>
      <div className="text-base"><Ev ev={ev} testid={`${prefix}-ev`} /></div>
    </div>
  </div>
);
