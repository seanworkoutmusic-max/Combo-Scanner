import { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Checkbox } from "../ui/checkbox";

const BOOKS = ["Kalshi"];
const CHECK = "border-slate-500 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 data-[state=checked]:text-black";

const Heading = ({ children }) => <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">{children}</div>;

const OddsBox = ({ label, value, onChange, testid, placeholder }) => (
  <label className="block px-2 pb-2 text-xs text-slate-400">
    {label}
    <input data-testid={testid} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode="numeric"
      className="mt-1 h-8 w-full px-2.5 rounded-lg border border-slate-700 bg-[#0E0E0E] font-mono text-sm font-semibold text-white outline-none focus:border-white/60 placeholder:text-slate-600" />
  </label>
);

// Filter dropdown: combos (applied when it closes), odds range (instant) and books.
export const ComboFilter = ({ combos, value, onChange, minOdds, maxOdds, setMinOdds, setMaxOdds }) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const toggle = (k) => setDraft((d) => (d.includes(k) ? d.filter((x) => x !== k) : [...d, k]));
  const onOpen = (o) => {
    setOpen(o);
    if (o) setDraft(value);
    else if (draft.length && draft.join() !== value.join()) onChange(combos.map(([k]) => k).filter((k) => draft.includes(k)));
  };
  const label = value.length === 1 ? combos.find(([k]) => k === value[0])?.[1] : `${value.length} combos`;
  const odds = minOdds || maxOdds ? ` · ${minOdds || "any"} to ${maxOdds || "any"}` : "";
  return (
    <Popover open={open} onOpenChange={onOpen}>
      <PopoverTrigger asChild>
        <button data-testid="combo-filter-btn"
          className="flex items-center gap-2 h-8 pl-2.5 pr-2 rounded-lg border border-slate-700 bg-[#0E0E0E] text-sm font-semibold text-white hover:border-white/60 transition-colors">
          <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />{label}<span className="font-mono text-xs text-slate-400">{odds}</span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[calc(100vw-2rem)] max-w-[600px] p-2 bg-[#141414] border-slate-700 text-white">
        <div className="grid grid-cols-1 sm:grid-cols-[1.5fr_1fr_0.8fr] gap-2 sm:divide-x divide-slate-800">
          <div>
            <Heading>Combos</Heading>
            {combos.map(([k, l]) => (
              <label key={k} data-testid={`combo-filter-${k}`} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm cursor-pointer hover:bg-white/[0.05]">
                <Checkbox checked={draft.includes(k)} onCheckedChange={() => toggle(k)} className={CHECK} />
                <img src="/nba.png" alt="NBA" data-testid={`combo-nba-logo-${k}`} className="h-4 w-4 object-contain shrink-0" />{l}
              </label>
            ))}
          </div>
          <div className="sm:pl-2">
            <Heading>Odds</Heading>
            <OddsBox label="Min odds" value={minOdds} onChange={setMinOdds} testid="odds-min-input" placeholder="+500" />
            <OddsBox label="Max odds" value={maxOdds} onChange={setMaxOdds} testid="odds-max-input" placeholder="+3000" />
            {(minOdds || maxOdds) && (
              <button data-testid="odds-clear-btn" onClick={() => { setMinOdds(""); setMaxOdds(""); }}
                className="px-2 text-xs text-slate-400 hover:text-white underline underline-offset-2">Clear odds</button>
            )}
          </div>
          <div className="sm:pl-2">
            <Heading>Books</Heading>
            {BOOKS.map((b) => (
              <label key={b} data-testid={`book-filter-${b.toLowerCase()}`} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm">
                <Checkbox checked disabled className={CHECK} />{b}
              </label>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-slate-800 mt-2 pt-2 px-1">
          <button data-testid="combo-filter-all" onClick={() => setDraft(combos.map(([k]) => k))} className="text-xs text-slate-400 hover:text-white">Select all combos</button>
          <button data-testid="combo-filter-apply" disabled={!draft.length} onClick={() => onOpen(false)}
            className="h-7 px-3 rounded-md bg-white text-slate-950 text-xs font-semibold hover:bg-slate-200 disabled:opacity-40">Apply</button>
        </div>
        <p className="px-2 pb-1 pt-1.5 text-[10px] text-slate-500">More than one combo loads each in turn (~25s each); each player keeps their best-EV combo. Odds filter the Kalshi price instantly.</p>
      </PopoverContent>
    </Popover>
  );
};
