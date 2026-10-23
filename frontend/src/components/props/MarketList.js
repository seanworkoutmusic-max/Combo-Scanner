import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { fmtAmerican, probToAmerican } from "../../lib/ev";

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const PriceTag = ({ p, format }) => {
  if (p == null || p <= 0 || p >= 1) return <span className="text-slate-600">—</span>;
  const eff = format === "fee" ? Math.min(p + 0.07 * p * (1 - p), 0.999) : p;
  return fmtAmerican(probToAmerican(eff));
};

const LineButton = ({ line, selected, onToggle, format }) => (
  <button
    data-testid={`line-btn-${line.ticker}`}
    onClick={() => onToggle(line)}
    className={`flex items-center justify-between gap-3 rounded border px-3 py-2 text-left transition-colors ${
      selected ? "border-cyan-400/70 bg-cyan-400/10" : "border-slate-800 bg-slate-950/40 hover:border-slate-600"
    }`}
  >
    <span className="text-sm text-slate-200">{line.threshold ? `${line.threshold}+` : "Yes"}</span>
    <span className="font-mono text-sm font-semibold text-sky-300">
      <PriceTag p={line.yes_ask} format={format} />
    </span>
  </button>
);

const MarketRow = ({ player, market, selected, onToggle, format }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-800/80">
      <button
        data-testid={`market-row-${slug(market.label)}`}
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-3 px-2 hover:bg-slate-800/20 transition-colors"
      >
        <span className="text-sm font-semibold text-slate-100">{player.name} {market.label}</span>
        <span className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-500">{market.lines.length} {market.lines.length === 1 ? "line" : "lines"}</span>
          <span className="h-5 w-5 grid place-items-center rounded border border-slate-700">
            <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
          </span>
        </span>
      </button>
      {open && (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 px-2 pb-4">
          {market.lines.map((l) => (
            <LineButton key={l.ticker} line={l} selected={selected.has(l.ticker)} onToggle={onToggle} format={format} />
          ))}
        </div>
      )}
    </div>
  );
};

export const MarketList = ({ player, selected, onToggle, format }) => (
  <div data-testid="market-list">
    {player.markets.map((m) => (
      <MarketRow key={m.label} player={player} market={m} selected={selected} onToggle={onToggle} format={format} />
    ))}
  </div>
);
