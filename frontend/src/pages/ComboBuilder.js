import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { GameSelect, BookChips } from "../components/ControlsBar";
import { postCombo, errMsg } from "../lib/api";
import { METHODS, evaluate, fmtAmerican, fmtPct, probToAmerican } from "../lib/ev";

const STATS = [
  { id: "pts", label: "Points" },
  { id: "reb", label: "Rebounds" },
  { id: "ast", label: "Assists" },
];

const Lbl = ({ children }) => <div className="text-[10px] uppercase tracking-widest text-slate-500 font-mono mb-1.5">{children}</div>;

const LegPicker = ({ legs, setLegs }) => (
  <div className="space-y-2">
    {STATS.map((s) => {
      const leg = legs[s.id];
      return (
        <div key={s.id} className={`flex items-center gap-3 rounded border px-3 py-2 transition-colors ${leg.on ? "border-cyan-400/40 bg-cyan-400/5" : "border-slate-800"}`}>
          <input
            type="checkbox"
            data-testid={`combo-leg-checkbox-${s.id}`}
            checked={leg.on}
            onChange={(e) => setLegs({ ...legs, [s.id]: { ...leg, on: e.target.checked } })}
            className="accent-cyan-400 h-4 w-4"
          />
          <span className="text-sm w-24">{s.label}</span>
          <input
            type="number"
            min={1}
            data-testid={`combo-leg-threshold-${s.id}`}
            value={leg.thr}
            onChange={(e) => setLegs({ ...legs, [s.id]: { ...leg, thr: Number(e.target.value) } })}
            className="w-16 h-8 px-2 rounded border border-slate-800 bg-slate-950/60 font-mono text-xs"
          />
          <span className="text-xs font-mono text-slate-500">+ (Over {leg.thr - 0.5})</span>
        </div>
      );
    })}
  </div>
);

export default function ComboBuilder({ games, status, settings, update }) {
  const [game, setGame] = useState(null);
  const [player, setPlayer] = useState("");
  const [legs, setLegs] = useState({ pts: { on: true, thr: 10 }, reb: { on: true, thr: 10 }, ast: { on: false, thr: 10 } });
  const [quote, setQuote] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!game && games.length) setGame(games[0].code);
  }, [games, game]);

  const players = useMemo(() => games.find((g) => g.code === game)?.players || [], [games, game]);

  const calc = async () => {
    const chosen = STATS.filter((s) => legs[s.id].on).map((s) => ({ stat: s.id, threshold: legs[s.id].thr }));
    if (!player || !chosen.length) return toast.error("Pick a player and at least one leg");
    setLoading(true);
    try {
      setResult(await postCombo({ game, player, legs: chosen, books: settings.books }));
    } catch (e) {
      setResult(null);
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  };

  const ests = (result?.books || []).filter((b) => b.mult != null).map((b) => {
    const div = 1 + (settings.sgpHold || 0) / 100;
    const vals = [b.mult, b.add, b.power].map((v) => v / div);
    const yes = settings.method === "worst" ? Math.min(...vals) : b[settings.method] / div;
    return { book: b.book, src: "SGP", yes, no: 1 - (settings.method === "worst" ? Math.max(...vals) : yes) };
  });
  const price = quote ? Number(quote) / 100 : null;
  const res = evaluate({ yes_ask: price }, ests, settings.fees);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">Combo builder</h1>
        <p className="text-sm text-slate-400 mt-1">Price any custom stat combo with real book SGPs, then compare to your Kalshi combo quote.</p>
      </div>
      <div className="grid lg:grid-cols-[380px_1fr] gap-5">
        <div className="rounded-md border border-slate-800 bg-[#0F131C]/80 p-5 space-y-5">
          <div>
            <Lbl>Game</Lbl>
            <GameSelect games={games} value={game} onChange={(v) => { setGame(v); setPlayer(""); }} testid="combo-game-select" />
          </div>
          <div>
            <Lbl>Player</Lbl>
            <Select value={player} onValueChange={setPlayer}>
              <SelectTrigger data-testid="combo-player-select" className="bg-slate-950/60 border-slate-800 text-sm">
                <SelectValue placeholder="Select player" />
              </SelectTrigger>
              <SelectContent className="bg-[#0F131C] border-slate-800 max-h-72">
                {players.map((p) => (
                  <SelectItem key={p.key} value={p.name} data-testid={`player-option-${p.key.replace(/\s/g, "-")}`}>
                    {p.name} <span className="text-slate-500 text-xs font-mono ml-1">{p.team}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Lbl>Legs</Lbl>
            <LegPicker legs={legs} setLegs={setLegs} />
          </div>
          <div>
            <Lbl>Kalshi combo quote (¢ for YES)</Lbl>
            <input
              data-testid="combo-kalshi-quote-input"
              type="number"
              min={1}
              max={99}
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              placeholder="e.g. 24"
              className="w-full h-9 px-3 rounded border border-slate-800 bg-slate-950/60 font-mono text-sm"
            />
            <p className="text-[11px] text-slate-500 mt-1">Kalshi combos are quoted on request, so paste the price Kalshi shows you.</p>
          </div>
          {status && settings.books && (
            <div>
              <Lbl>Sportsbooks</Lbl>
              <BookChips all={status.books} sgp={status.sgp_books} value={settings.books} onChange={(v) => update({ books: v })} />
            </div>
          )}
          <button
            data-testid="combo-calc-ev-btn"
            onClick={calc}
            disabled={loading || !status?.opticodds_key}
            className="w-full h-10 rounded bg-cyan-400 text-slate-950 font-semibold hover:bg-cyan-300 disabled:opacity-50 transition-colors"
          >
            {loading ? "Pricing…" : status?.opticodds_key ? "Price combo" : "Needs OpticOdds key"}
          </button>
        </div>
        <ComboResults result={result} res={res} ests={ests} settings={settings} update={update} />
      </div>
    </div>
  );
}

const Stat = ({ label, value, testid, cls = "text-slate-100" }) => (
  <div className="rounded border border-slate-800 bg-slate-950/40 px-4 py-3">
    <div className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">{label}</div>
    <div data-testid={testid} className={`font-mono text-2xl font-semibold mt-1 ${cls}`}>{value}</div>
  </div>
);

const ComboResults = ({ result, res, ests, settings, update }) => (
  <div data-testid="combo-results-panel" className="rounded-md border border-slate-800 bg-[#0F131C]/80 p-5 space-y-5">
    <div className="flex flex-wrap gap-1">
      {METHODS.map((m) => (
        <button
          key={m.id}
          data-testid={`combo-method-${m.id}`}
          onClick={() => update({ method: m.id })}
          className={`px-2.5 py-1 text-xs rounded-sm border transition-colors ${settings.method === m.id ? "bg-cyan-400 text-slate-950 border-cyan-400 font-semibold" : "border-slate-800 text-slate-400"}`}
        >
          {m.label}
        </button>
      ))}
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Stat label="Fair prob" value={fmtPct(res.fairYes)} testid="combo-fair-prob-display" cls="text-cyan-200" />
      <Stat label="Fair odds" value={fmtAmerican(probToAmerican(res.fairYes))} testid="combo-fair-odds-display" />
      <Stat label="Break-even ¢" value={res.fairYes ? `${(res.fairYes * 100).toFixed(1)}¢` : "—"} testid="combo-breakeven-display" />
      <Stat
        label="EV (YES)"
        value={res.evYes == null ? "—" : `${res.evYes > 0 ? "+" : ""}${(res.evYes * 100).toFixed(1)}%`}
        testid="combo-ev-percentage-display"
        cls={res.evYes == null ? "text-slate-500" : res.evYes > 0 ? "text-emerald-400" : "text-red-400"}
      />
    </div>
    {result ? (
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">
              <th className="py-2 px-2">Book</th><th className="py-2 px-2">Legs (O / U)</th><th className="py-2 px-2">SGP</th>
              <th className="py-2 px-2">Corr</th><th className="py-2 px-2 text-cyan-300">Fair</th>
            </tr>
          </thead>
          <tbody>
            {result.books.map((b) => (
              <tr key={b.book} data-testid={`combo-book-row-${b.book}`} className="border-t border-slate-800/60 font-mono text-xs">
                <td className="py-2 px-2 text-slate-200 font-semibold">{b.book}</td>
                <td className="py-2 px-2 text-slate-400">{b.legs.map((l) => `${l.stat} ${fmtAmerican(l.over)}/${fmtAmerican(l.under)}`).join(" · ")}</td>
                <td className="py-2 px-2 text-slate-200">{fmtAmerican(b.sgp_price)}</td>
                <td className="py-2 px-2 text-slate-400">{b.corr ? `${b.corr.toFixed(2)}×` : "—"}</td>
                <td className="py-2 px-2 text-cyan-200">{fmtPct(ests.find((e) => e.book === b.book)?.yes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!result.books.length && <div className="text-sm text-slate-500 py-6 text-center">No book could price this combo.</div>}
      </div>
    ) : (
      <div className="text-sm text-slate-500 py-10 text-center">Pick a player and legs, then price the combo.</div>
    )}
  </div>
);
