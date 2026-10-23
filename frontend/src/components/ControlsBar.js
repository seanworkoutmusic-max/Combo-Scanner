import { RefreshCw } from "lucide-react";
import { Switch } from "./ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { METHODS, SOURCES } from "../lib/ev";

const Seg = ({ options, value, onChange, testid }) => (
  <div data-testid={testid} className="flex rounded border border-slate-800 bg-slate-950/60 p-0.5">
    {options.map((o) => (
      <button
        key={o.id}
        data-testid={`${testid}-${o.id}`}
        onClick={() => onChange(o.id)}
        className={`px-2.5 py-1 text-xs rounded-sm transition-colors ${
          value === o.id ? "bg-cyan-400 text-slate-950 font-semibold" : "text-slate-400 hover:text-slate-100"
        }`}
      >
        {o.label}
      </button>
    ))}
  </div>
);

const Lbl = ({ children }) => <div className="text-[10px] uppercase tracking-widest text-slate-500 font-mono mb-1">{children}</div>;

export const GameSelect = ({ games, value, onChange, testid }) => (
  <Select value={value || ""} onValueChange={onChange}>
    <SelectTrigger data-testid={testid} className="w-[210px] bg-slate-950/60 border-slate-800 font-mono text-xs">
      <SelectValue placeholder="Select game" />
    </SelectTrigger>
    <SelectContent className="bg-[#141414] border-slate-800">
      {games.map((g) => (
        <SelectItem key={g.code} value={g.code} data-testid={`game-option-${g.code}`} className="font-mono text-xs">
          {g.label} · {g.date.slice(5)}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

export const BookChips = ({ all, sgp, value, onChange }) => (
  <div data-testid="multiselect-sportsbooks" className="flex flex-wrap gap-1">
    {all.map((b) => {
      const on = value.includes(b);
      return (
        <button
          key={b}
          data-testid={`book-chip-${b}`}
          onClick={() => onChange(on ? value.filter((x) => x !== b) : [...value, b])}
          title={sgp.includes(b) ? "SGP + direct" : "Direct markets only (no SGP pricing)"}
          className={`px-2 py-1 text-[11px] font-mono rounded-sm border transition-colors ${
            on ? "border-cyan-400/50 text-cyan-200 bg-cyan-400/10" : "border-slate-800 text-slate-500 hover:text-slate-300"
          }`}
        >
          {b}
          {!sgp.includes(b) && <span className="text-slate-500">*</span>}
        </button>
      );
    })}
  </div>
);

export const ControlsBar = ({ games, game, setGame, settings, update, status, onRefresh, loading, updatedAt }) => (
  <div className="rounded-md border border-slate-800 bg-[#141414]/80 backdrop-blur p-4 flex flex-wrap gap-x-6 gap-y-4 items-end">
    <div>
      <Lbl>Game</Lbl>
      <GameSelect games={games} value={game} onChange={setGame} testid="select-game-filter" />
    </div>
    <div>
      <Lbl>Devig method</Lbl>
      <Seg options={METHODS} value={settings.method} onChange={(v) => update({ method: v })} testid="devig-method-toggle" />
    </div>
    <div>
      <Lbl>Fair source</Lbl>
      <Seg options={SOURCES} value={settings.source} onChange={(v) => update({ source: v })} testid="fair-source-toggle" />
    </div>
    <div className="flex gap-5">
      <div>
        <Lbl>Kalshi fees</Lbl>
        <Switch data-testid="toggle-kalshi-fees" checked={settings.fees} onCheckedChange={(v) => update({ fees: v })} />
      </div>
      <div>
        <Lbl>+EV only</Lbl>
        <Switch data-testid="toggle-positive-ev-only" checked={settings.positiveOnly} onCheckedChange={(v) => update({ positiveOnly: v })} />
      </div>
    </div>
    <div>
      <Lbl>Min EV %</Lbl>
      <input
        data-testid="filter-min-ev-input"
        type="number"
        value={settings.minEv}
        onChange={(e) => update({ minEv: Number(e.target.value) })}
        className="w-20 h-9 px-2 rounded border border-slate-800 bg-slate-950/60 font-mono text-xs"
      />
    </div>
    <div>
      <Lbl>SGP extra hold %</Lbl>
      <input
        data-testid="input-sgp-hold"
        type="number"
        step="0.5"
        value={settings.sgpHold}
        onChange={(e) => update({ sgpHold: Number(e.target.value) })}
        className="w-20 h-9 px-2 rounded border border-slate-800 bg-slate-950/60 font-mono text-xs"
      />
    </div>
    {status && settings.books && (
      <div>
        <Lbl>Sportsbooks</Lbl>
        <BookChips all={status.books} sgp={status.sgp_books} value={settings.books} onChange={(v) => update({ books: v })} />
      </div>
    )}
    <div className="ml-auto flex items-center gap-3">
      <span data-testid="last-updated-timestamp" className="text-[11px] font-mono text-slate-500">
        {updatedAt ? `Updated ${new Date(updatedAt).toLocaleTimeString()}` : ""}
      </span>
      <button
        data-testid="btn-refresh-data"
        onClick={onRefresh}
        disabled={!game || loading}
        className="flex items-center gap-1.5 h-9 px-3 rounded bg-cyan-400 text-slate-950 text-sm font-semibold hover:bg-cyan-300 disabled:opacity-50 transition-colors"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
      </button>
    </div>
  </div>
);
