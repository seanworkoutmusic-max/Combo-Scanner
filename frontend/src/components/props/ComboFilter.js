import { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Checkbox } from "../ui/checkbox";

// Multi-select combo filter; the selection is applied when the dropdown closes.
export const ComboFilter = ({ combos, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const toggle = (k) => setDraft((d) => (d.includes(k) ? d.filter((x) => x !== k) : [...d, k]));
  const onOpen = (o) => {
    setOpen(o);
    if (o) setDraft(value);
    else if (draft.length && draft.join() !== value.join()) onChange(combos.map(([k]) => k).filter((k) => draft.includes(k)));
  };
  const label = value.length === 1 ? combos.find(([k]) => k === value[0])?.[1] : `${value.length} combos`;
  return (
    <Popover open={open} onOpenChange={onOpen}>
      <PopoverTrigger asChild>
        <button data-testid="combo-filter-btn"
          className="flex items-center gap-2 h-8 pl-2.5 pr-2 rounded-lg border border-slate-700 bg-[#0E0E0E] text-sm font-semibold text-white hover:border-white/60 transition-colors">
          <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />{label}<ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1.5 bg-[#141414] border-slate-700 text-white">
        {combos.map(([k, l]) => (
          <label key={k} data-testid={`combo-filter-${k}`} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm cursor-pointer hover:bg-white/[0.05]">
            <Checkbox checked={draft.includes(k)} onCheckedChange={() => toggle(k)}
              className="border-slate-500 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 data-[state=checked]:text-black" />
            {l}
          </label>
        ))}
        <div className="flex items-center justify-between gap-2 border-t border-slate-800 mt-1 pt-1.5 px-1">
          <button data-testid="combo-filter-all" onClick={() => setDraft(combos.map(([k]) => k))} className="text-xs text-slate-400 hover:text-white">Select all</button>
          <button data-testid="combo-filter-apply" disabled={!draft.length} onClick={() => onOpen(false)}
            className="h-7 px-3 rounded-md bg-white text-slate-950 text-xs font-semibold hover:bg-slate-200 disabled:opacity-40">Apply</button>
        </div>
        <p className="px-2 pb-1 pt-1.5 text-[10px] text-slate-500">More than one combo loads each in turn (~25s each); each player keeps their best-EV combo.</p>
      </PopoverContent>
    </Popover>
  );
};
