import { fmtAmerican, fmtPct, bookEstimates } from "../lib/ev";

const SGP_KEYS = [
  ["pts+reb", "P+R"],
  ["pts+ast", "P+A"],
  ["reb+ast", "R+A"],
  ["pts+reb+ast", "P+R+A"],
];

const Td = ({ children, className = "" }) => <td className={`py-1.5 px-2 font-mono text-xs ${className}`}>{children}</td>;

export const BookBreakdown = ({ row, settings }) => {
  if (!row.books.length)
    return <div data-testid={`row-expansion-empty-${row.key.replace(/\s/g, "-")}`} className="text-xs text-slate-500 py-3 px-4">No sportsbook prices found for this player yet.</div>;
  const fairFor = (kind, book) => {
    const e = bookEstimates([book], kind, settings.method, settings.source, settings.sgpHold);
    return e.length ? e.reduce((a, b) => a + b.yes, 0) / e.length : null;
  };
  return (
    <div data-testid={`row-expansion-breakdown-${row.key}`} className="overflow-x-auto px-2 py-3">
      <table className="w-full text-left">
        <thead>
          <tr className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">
            <th className="px-2 py-1">Book</th>
            <th className="px-2 py-1">Pts 9.5 O/U</th>
            <th className="px-2 py-1">Reb 9.5 O/U</th>
            <th className="px-2 py-1">Ast 9.5 O/U</th>
            {SGP_KEYS.map(([, l]) => (
              <th key={l} className="px-2 py-1">SGP {l}</th>
            ))}
            <th className="px-2 py-1">Direct DD</th>
            <th className="px-2 py-1">Direct TD</th>
            <th className="px-2 py-1 text-cyan-300">Fair DD</th>
            <th className="px-2 py-1 text-cyan-300">Fair TD</th>
          </tr>
        </thead>
        <tbody>
          {row.books.map((b) => (
            <tr key={b.book} className="border-t border-slate-800/60" data-testid={`breakdown-book-${row.key}-${b.book}`}>
              <Td className="text-slate-200 font-semibold">{b.book}</Td>
              {["pts", "reb", "ast"].map((s) => (
                <Td key={s} className="text-slate-400">
                  {fmtAmerican(b.legs?.[s])} / {fmtAmerican(b.legs_under?.[s])}
                </Td>
              ))}
              {SGP_KEYS.map(([k]) => (
                <Td key={k} className="text-slate-300">{fmtAmerican(b.sgp_prices?.[k])}</Td>
              ))}
              {["dd", "td"].map((k) => (
                <Td key={k} className="text-slate-400">
                  {b[k]?.direct_prices ? `${fmtAmerican(b[k].direct_prices.yes)} / ${fmtAmerican(b[k].direct_prices.no)}` : "—"}
                </Td>
              ))}
              <Td className="text-cyan-200">{fmtPct(fairFor("dd", b))}</Td>
              <Td className="text-cyan-200">{fmtPct(fairFor("td", b))}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
