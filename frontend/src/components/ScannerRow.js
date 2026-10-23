import { ChevronRight } from "lucide-react";
import { fmtAmerican, fmtPct, probToAmerican } from "../lib/ev";
import { BookBreakdown } from "./BookBreakdown";

const EvCell = ({ ev, testid }) => {
  const cls = ev == null ? "text-slate-600" : ev > 0 ? "text-emerald-400 font-bold" : "text-red-400/80";
  return (
    <td data-testid={testid} className={`py-2.5 px-3 font-mono text-sm text-right ${cls}`}>
      {ev == null ? "—" : `${ev > 0 ? "+" : ""}${(ev * 100).toFixed(1)}%`}
    </td>
  );
};

const C = ({ children, className = "", testid }) => (
  <td data-testid={testid} className={`py-2.5 px-3 font-mono text-sm text-right ${className}`}>{children}</td>
);

export const ScannerRow = ({ item, open, onToggle, settings, index }) => {
  const { row, kind, market, res } = item;
  const id = `${row.key.replace(/\s/g, "-")}-${kind}`;
  const best = Math.max(res.evYes ?? -9, res.evNo ?? -9);
  return (
    <>
      <tr
        data-testid={`row-player-market-${id}`}
        onClick={onToggle}
        style={{ animationDelay: `${Math.min(index, 20) * 25}ms` }}
        className={`row-in cursor-pointer border-t border-slate-800/70 hover:bg-slate-800/25 transition-colors ${
          best > 0 ? "bg-emerald-500/[0.04]" : ""
        }`}
      >
        <td className="py-2.5 px-3">
          <button data-testid={`btn-expand-row-${id}`} className="flex items-center gap-2 text-left">
            <ChevronRight className={`h-3.5 w-3.5 text-slate-500 transition-transform ${open ? "rotate-90" : ""}`} />
            <span className="text-sm text-slate-100">{row.name}</span>
            <span className="text-[10px] font-mono text-slate-500">{row.team}</span>
          </button>
        </td>
        <td className="py-2.5 px-3">
          <span
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded-sm border ${
              kind === "td" ? "border-slate-500 text-slate-100" : "border-sky-400/40 text-sky-300"
            }`}
          >
            {kind === "td" ? "TRIPLE-DBL" : "DOUBLE-DBL"}
          </span>
        </td>
        <C testid={`cell-kalshi-yes-ask-${id}`} className="text-sky-300">{fmtAmerican(probToAmerican(market.yes_ask))}</C>
        <C testid={`cell-kalshi-no-ask-${id}`} className="text-slate-400">{fmtAmerican(probToAmerican(market.no_ask))}</C>
        <C testid={`cell-fair-prob-${id}`} className="text-cyan-200">{fmtPct(res.fairYes)}</C>
        <C testid={`cell-fair-odds-${id}`} className="text-slate-300">{fmtAmerican(probToAmerican(res.fairYes))}</C>
        <EvCell ev={res.evYes} testid={`cell-ev-yes-${id}`} />
        <EvCell ev={res.evNo} testid={`cell-ev-no-${id}`} />
        <C className="text-slate-400">{res.n || "—"}</C>
        <td data-testid={`cell-source-tag-${id}`} className="py-2.5 px-3 text-[10px] font-mono text-slate-500">
          {res.srcs.join(" + ") || "—"}
        </td>
      </tr>
      {open && (
        <tr className="bg-slate-950/50">
          <td colSpan={10}>
            <BookBreakdown row={row} settings={settings} />
          </td>
        </tr>
      )}
    </>
  );
};
