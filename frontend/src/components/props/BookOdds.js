import { BOOKS, BOOK_COLORS } from "../../lib/slip";

const OddsInput = ({ value, onChange, testid, placeholder = "+000" }) => (
  <input
    data-testid={testid}
    value={value || ""}
    onChange={(e) => onChange(e.target.value.replace(/[^0-9+-]/g, ""))}
    placeholder={placeholder}
    inputMode="numeric"
    className="w-full h-8 px-2 rounded border border-slate-800 bg-slate-950/70 font-mono text-sm text-slate-100 placeholder:text-slate-700 focus:border-cyan-400/60 outline-none"
  />
);

const BookName = ({ b }) => (
  <span className="flex items-center gap-2 text-xs text-slate-300">
    <span className="h-2 w-2 rounded-sm" style={{ background: BOOK_COLORS[b] }} />
    {b}
  </span>
);

// Parlay: one SGP price per book. Straight: Over / Under per book.
export const BookOdds = ({ mode, odds, setOdds, prefix }) => (
  <div data-testid={`${prefix}-book-odds`} className="space-y-1.5">
    <div className="grid grid-cols-[1fr_90px] gap-2 text-[10px] uppercase tracking-widest font-mono text-slate-500 px-1"
      style={mode === "straight" ? { gridTemplateColumns: "1fr 80px 80px" } : undefined}>
      <span>Book</span>
      {mode === "straight" ? (<><span>Over</span><span>Under</span></>) : <span>SGP odds</span>}
    </div>
    {BOOKS.map((b) => (
      <div key={b} className="grid gap-2 items-center rounded border border-slate-800/70 bg-[#0E0E0E] px-2 py-1.5"
        style={{ gridTemplateColumns: mode === "straight" ? "1fr 80px 80px" : "1fr 90px" }}>
        <BookName b={b} />
        {mode === "straight" ? (
          <>
            <OddsInput testid={`${prefix}-over-${b}`} value={odds[b]?.over} onChange={(v) => setOdds(b, { ...odds[b], over: v })} />
            <OddsInput testid={`${prefix}-under-${b}`} value={odds[b]?.under} onChange={(v) => setOdds(b, { ...odds[b], under: v })} placeholder="opt." />
          </>
        ) : (
          <OddsInput testid={`${prefix}-sgp-${b}`} value={odds[b]?.price} onChange={(v) => setOdds(b, { price: v })} />
        )}
      </div>
    ))}
  </div>
);
