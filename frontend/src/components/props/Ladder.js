import { useState } from "react";
import { PriceTag } from "./MarketList";

const usd = (n) => `$${n >= 1000 ? n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : n.toFixed(2)}`;

// rows: [{price, contracts}] sorted best (cheapest YES) first.
export const Ladder = ({ rows, format, testid, title, cumulative }) => {
  const [all, setAll] = useState(false);
  if (!rows?.length) return <div className="text-[11px] text-slate-500 py-2">No liquidity right now.</div>;
  let cum = 0, cumPay = 0;
  const shown = (all ? rows : rows.slice(0, 6)).map((r) => {
    cum += r.contracts * r.price;
    cumPay += r.contracts;
    return { ...r, cum, cumPay };
  });
  return (
    <div data-testid={testid} className="rounded border border-slate-800 bg-[#0A1730]">
      <div className="px-2.5 py-1.5 border-b border-slate-800 text-[10px] uppercase tracking-widest font-mono text-slate-500">{title}</div>
      <table className="w-full font-mono text-[11px]">
        <thead>
          <tr className="text-slate-500">
            <th className="text-left px-2.5 py-1 font-normal">Odds</th>
            <th className="text-right px-2 py-1 font-normal">Contracts</th>
            <th className="text-right px-2 py-1 font-normal">{cumulative ? "Total cost" : "Cost"}</th>
            <th className="text-right px-2.5 py-1 font-normal">Pays</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => (
            <tr key={i} data-testid={`${testid}-row-${i}`} className={`border-t border-slate-800/60 ${i === 0 ? "text-emerald-300" : "text-slate-300"}`}>
              <td className="px-2.5 py-1"><PriceTag p={r.price} format={format} /></td>
              <td className="text-right px-2 py-1">{r.contracts.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
              <td className="text-right px-2 py-1 text-slate-400">{usd(cumulative ? r.cum : r.contracts * r.price)}</td>
              <td className="text-right px-2.5 py-1">{usd(cumulative ? r.cumPay : r.contracts)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 6 && (
        <button data-testid={`${testid}-toggle`} onClick={() => setAll(!all)} className="w-full py-1 text-[11px] text-cyan-300 hover:text-cyan-200 border-t border-slate-800">
          {all ? "Show less" : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  );
};
