import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { fmtAmerican, probToAmerican } from "../../lib/ev";

const cents = (p) => `${(p * 100).toFixed(p < 0.1 ? 2 : 1)}¢`;

// Market-maker quotes (RFQ ladder) for one Kalshi combo, opened by clicking its price.
export const ComboBook = ({ live, slug, children }) => {
  const ladder = live?.ladder || [];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button data-testid={`combo-book-btn-${slug}`} className="rounded-md px-1.5 -mx-1.5 underline decoration-dotted decoration-slate-600 underline-offset-4 hover:bg-white/[0.06] transition-colors">
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" data-testid={`combo-book-${slug}`} className="w-80 p-0 bg-[#0E0E0E] border-slate-700 text-white">
        <div className="px-4 py-3 border-b border-slate-800">
          <div className="text-sm font-bold">Kalshi combo quotes</div>
          <div className="text-[11px] text-slate-500">{ladder.length} market maker{ladder.length === 1 ? "" : "s"} quoting a ${live?.size?.target_cost_dollars ? Number(live.size.target_cost_dollars).toFixed(0) : 10} ticket · best first</div>
        </div>
        {!ladder.length ? <div className="px-4 py-6 text-center text-sm text-slate-500">No live quotes right now.</div> : (
          <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-[10px] uppercase tracking-wider text-slate-500">
              <th className="py-2 pl-4 text-left font-semibold">Odds</th><th className="py-2 text-right font-semibold">Price</th>
              <th className="py-2 text-right font-semibold">Contracts</th><th className="py-2 pr-4 text-right font-semibold">Cost</th>
            </tr></thead>
            <tbody>
              {ladder.map((q, i) => (
                <tr key={i} data-testid={`combo-book-row-${slug}-${i}`} className={`border-t border-slate-800/70 font-mono ${i === 0 ? "text-white font-bold" : "text-slate-300"}`}>
                  <td className="py-2 pl-4">{fmtAmerican(probToAmerican(q.price))}</td>
                  <td className="py-2 text-right">{cents(q.price)}</td>
                  <td className="py-2 text-right">{q.contracts.toFixed(0)}</td>
                  <td className="py-2 pr-4 text-right">${(q.contracts * q.price).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
        {live?.book_yes_ask && (
          <div data-testid={`combo-book-ask-${slug}`} className="px-4 py-2.5 border-t border-slate-800 text-xs text-slate-400 flex justify-between">
            <span>Resting order book ask</span><span className="font-mono text-white">{fmtAmerican(probToAmerican(live.book_yes_ask))} · {cents(live.book_yes_ask)}</span>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
