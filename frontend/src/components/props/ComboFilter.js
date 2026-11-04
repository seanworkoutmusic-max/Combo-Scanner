import { SlidersHorizontal, X } from "lucide-react";
import { Checkbox } from "../ui/checkbox";

const SPORTS = [["NBA", "/nba.png", true], ["NFL", "/nfl.png", false], ["MLB", "/mlb.png", false]];
const EVS = [0, 3, 5, 10];
const CHECK = "border-slate-500 data-[state=checked]:bg-white data-[state=checked]:border-white data-[state=checked]:text-black";

const Heading = ({ children, right }) => (
  <div className="flex items-center justify-between mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
    {children}{right}
  </div>
);

const OddsBox = ({ value, onChange, testid, placeholder }) => (
  <input data-testid={testid} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode="numeric"
    className="h-9 w-full min-w-0 px-2.5 rounded-lg border border-slate-700 bg-[#0E0E0E] font-mono text-sm font-semibold text-white text-center outline-none focus:border-white/60 placeholder:text-slate-600" />
);

const Seg = ({ items, value, onPick, testid }) => (
  <div data-testid={testid} className="grid auto-cols-fr grid-flow-col rounded-lg border border-slate-700 bg-[#0E0E0E] p-0.5">
    {items.map(([k, l, extra]) => (
      <button key={k} data-testid={`${testid}-${k}`} onClick={() => onPick(k)}
        className={`flex items-center justify-center gap-1.5 h-8 rounded-md text-sm font-semibold transition-colors ${value === k ? "bg-white text-slate-950" : "text-slate-400 hover:text-white"}`}>
        {extra}{l}
      </button>
    ))}
  </div>
);

const ComboList = ({ combos, draft, setDraft }) => {
  const toggle = (k) => setDraft(draft.includes(k) ? draft.filter((x) => x !== k) : combos.map(([c]) => c).filter((c) => c === k || draft.includes(c)));
  return (
    <div>
      <Heading right={<span data-testid="combo-filter-count" className="font-mono normal-case tracking-normal text-white">{draft.length} selected</span>}>Combos</Heading>
      {combos.map(([k, l]) => (
        <label key={k} data-testid={`combo-filter-${k}`} className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm cursor-pointer transition-colors ${draft.includes(k) ? "bg-white/[0.05] text-white" : "text-slate-300 hover:bg-white/[0.03]"}`}>
          <Checkbox checked={draft.includes(k)} onCheckedChange={() => toggle(k)} className={CHECK} />{l}
        </label>
      ))}
      <button data-testid="combo-filter-all" onClick={() => setDraft(combos.map(([k]) => k))} className="mt-2 px-2 text-xs text-slate-400 hover:text-white underline underline-offset-4">Select all combos</button>
    </div>
  );
};

// Scanner filter panel: combos apply on the next scan; market, odds and EV apply right away.
export const ComboFilter = ({ combos, draft, setDraft, live, setLive, minOdds, maxOdds, setMinOdds, setMaxOdds, minEv, setMinEv, onReset }) => (
  <aside data-testid="scanner-filters" className="space-y-6 rounded-xl border border-slate-800 bg-[#0E0E0E] p-4 lg:rounded-none lg:border-0 lg:border-r lg:fixed lg:top-0 lg:bottom-0 lg:left-16 min-[1440px]:left-56 lg:w-64 lg:overflow-y-auto lg:px-4 lg:py-5 lg:z-20">
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-sm font-bold text-white"><SlidersHorizontal className="h-4 w-4" /> Filters</span>
      <button data-testid="filters-reset-btn" onClick={onReset} className="text-xs text-slate-400 hover:text-white">Reset</button>
    </div>
    <div>
      <Heading>Market</Heading>
      <Seg testid="scanner-mode" value={live ? "live" : "pregame"} onPick={(k) => setLive(k === "live")}
        items={[["pregame", "Pregame"], ["live", "Live", <span key="d" className={`h-1.5 w-1.5 rounded-full ${live ? "bg-red-500 animate-pulse" : "bg-red-500/60"}`} />]]} />
    </div>
    <ComboList combos={combos} draft={draft} setDraft={setDraft} />
    <div>
      <Heading>Odds range</Heading>
      <div className="flex items-center gap-2">
        <OddsBox value={minOdds} onChange={setMinOdds} testid="odds-min-input" placeholder="+500" />
        <span className="text-xs text-slate-500">to</span>
        <OddsBox value={maxOdds} onChange={setMaxOdds} testid="odds-max-input" placeholder="+3000" />
      </div>
    </div>
    <div>
      <Heading>Min EV</Heading>
      <Seg testid="min-ev" value={minEv} onPick={setMinEv} items={EVS.map((v) => [v, `${v}%`])} />
    </div>
    <div>
      <Heading>Sport</Heading>
      {SPORTS.map(([s, logo, on]) => (
        <label key={s} data-testid={`sport-filter-${s.toLowerCase()}`} title={on ? "" : "Coming soon"}
          className={`flex items-center gap-2.5 px-2 py-1.5 text-sm ${on ? "text-white" : "opacity-45"}`}>
          <Checkbox checked={on} disabled className={CHECK} />
          <img src={logo} alt={s} className="h-4 w-4 object-contain shrink-0" />{s}
          {!on && <span className="ml-auto text-[9px] font-mono uppercase tracking-wider text-slate-500">Soon</span>}
        </label>
      ))}
    </div>
    <div>
      <Heading>Books</Heading>
      <label data-testid="book-filter-kalshi" className="flex items-center gap-2.5 px-2 py-1.5 text-sm text-white">
        <Checkbox checked disabled className={CHECK} />
        <img src="/kalshi.png" alt="" data-testid="book-filter-logo-kalshi" className="h-4 w-4 rounded-[3px] object-cover shrink-0" />Kalshi
      </label>
    </div>
  </aside>
);

const Chip = ({ children, onRemove, testid }) => (
  <span data-testid={testid} className="inline-flex items-center gap-1.5 h-7 pl-3 pr-2 rounded-full border border-slate-700 bg-[#0E0E0E] text-xs font-semibold text-white">
    {children}
    {onRemove && <button data-testid={`${testid}-remove`} onClick={onRemove} className="text-slate-500 hover:text-white"><X className="h-3 w-3" /></button>}
  </span>
);

export const ActiveFilters = ({ combos, draft, setDraft, minOdds, maxOdds, clearOdds, minEv, setMinEv, pending }) => (
  <div data-testid="active-filters" className="flex items-center gap-2 flex-wrap">
    <span className="text-xs text-slate-500 mr-1">Active</span>
    {combos.filter(([k]) => draft.includes(k)).map(([k, l]) => (
      <Chip key={k} testid={`active-combo-${k}`} onRemove={draft.length > 1 ? () => setDraft(draft.filter((x) => x !== k)) : null}>{l}</Chip>
    ))}
    {(minOdds || maxOdds) && <Chip testid="active-odds" onRemove={clearOdds}>{minOdds || "any"} to {maxOdds || "any"}</Chip>}
    {minEv > 0 && <Chip testid="active-ev" onRemove={() => setMinEv(0)}>EV ≥{minEv}%</Chip>}
    {pending && <span data-testid="filters-pending" className="text-xs text-slate-400">· press Scan to apply</span>}
  </div>
);
