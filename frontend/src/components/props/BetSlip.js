import { Switch } from "../ui/switch";
import { METHODS } from "../../lib/ev";
import { ParlaySlip } from "./ParlaySlip";
import { StraightSlip } from "./StraightSlip";

const Num = ({ label, value, onChange, testid }) => (
  <label className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
    {label}
    <input data-testid={testid} type="number" step="0.5" value={value} onChange={(e) => e.target.value !== "" && onChange(Number(e.target.value))}
      className="w-14 h-7 px-1.5 rounded border border-slate-800 bg-slate-950/70 text-slate-100" />
  </label>
);

const Settings = ({ settings, update, mode }) => (
  <div className="rounded-xl border border-slate-800 bg-[#0E0E0E] p-3 space-y-2.5">
    {mode === "parlay" ? (
      <p data-testid="parlay-devig-note" className="text-[11px] text-slate-500 leading-relaxed">
        SGP odds only have one side, so fair = book odds with the assumed hold removed. Devig methods apply to Straight bets with Over and Under.
      </p>
    ) : (
    <div className="flex flex-wrap gap-1" data-testid="slip-devig-method">
      {METHODS.map((m) => (
        <button key={m.id} data-testid={`slip-method-${m.id}`} onClick={() => update({ method: m.id })}
          className={`px-2 py-1 text-[11px] rounded-sm transition-colors ${settings.method === m.id ? "bg-cyan-400 text-slate-950 font-semibold" : "text-slate-400 hover:text-slate-100 border border-slate-800"}`}>
          {m.label}
        </button>
      ))}
    </div>
    )}
    <div className="flex flex-wrap items-center gap-4">
      {mode === "parlay" ? (
        <Num label="Assumed SGP hold %" value={settings.parlayHold} onChange={(v) => update({ parlayHold: v })} testid="input-parlay-hold" />
      ) : (
        <Num label="Hold if no Under %" value={settings.singleHold} onChange={(v) => update({ singleHold: v })} testid="input-single-hold" />
      )}
      <label className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
        Kalshi fees (prices include them) <Switch data-testid="slip-toggle-fees" checked={settings.fees} onCheckedChange={(v) => update({ fees: v })} />
      </label>
    </div>
  </div>
);

export const BetSlip = ({ legs, mode, setMode, combo, parlayOdds, setParlayOdds, straightOdds, setStraightOdds, settings, update, format, remove, clear, live, onLiveQuote, liveLoading, kalshiKey, quoteSize, setQuoteSize }) => (
  <aside data-testid="bet-slip" className="space-y-4">
    <div className="flex items-center justify-between">
      <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
        <span className="h-6 w-6 grid place-items-center rounded-full bg-cyan-400 text-slate-950 text-xs font-mono font-bold">{legs.length}</span>
        Place Bets
      </h2>
      {legs.length > 0 && <button data-testid="clear-slip-btn" onClick={clear} className="text-xs text-slate-500 hover:text-red-400">Clear</button>}
    </div>
    <div className="grid grid-cols-2 rounded border border-slate-800 bg-slate-950/60 p-0.5">
      {["straight", "parlay"].map((m) => (
        <button key={m} data-testid={`slip-tab-${m}`} onClick={() => setMode(m)}
          className={`py-2 text-sm font-semibold capitalize rounded-sm transition-colors ${mode === m ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-200"}`}>
          {m}
        </button>
      ))}
    </div>
    {legs.length === 0 ? (
      <div data-testid="slip-empty" className="rounded-xl border border-dashed border-slate-800 py-12 text-center text-sm text-slate-500">
        Tap a line on the left to add it.
      </div>
    ) : (
      <>
        {mode === "straight" && <Settings settings={settings} update={update} mode={mode} />}
        {mode === "parlay" ? (
          legs.length < 2 ? (
            <div className="text-sm text-slate-500 text-center py-6">Add at least 2 legs for a parlay.</div>
          ) : (
            <ParlaySlip legs={legs} combo={combo} odds={parlayOdds} setOdds={setParlayOdds} settings={settings} format={format} remove={remove}
              live={live} onLiveQuote={onLiveQuote} liveLoading={liveLoading} kalshiKey={kalshiKey} quoteSize={quoteSize} setQuoteSize={setQuoteSize} />
          )
        ) : (
          <StraightSlip legs={legs} bookOdds={straightOdds} setBookOdds={setStraightOdds} settings={settings} format={format} remove={remove} />
        )}
      </>
    )}
  </aside>
);
