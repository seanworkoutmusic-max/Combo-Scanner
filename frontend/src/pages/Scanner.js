import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ControlsBar } from "../components/ControlsBar";
import { ScannerRow } from "../components/ScannerRow";
import { getScan, errMsg } from "../lib/api";
import { bookEstimates, evaluate } from "../lib/ev";

const HEADS = ["Player", "Market", "Yes ask", "No ask", "Fair %", "Fair odds", "EV Yes", "EV No", "Books", "Source"];

export default function Scanner({ games, status, settings, update }) {
  const [game, setGame] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState({});

  useEffect(() => {
    if (!game && games.length) setGame(games[0].code);
  }, [games, game]);

  const load = useCallback(async () => {
    if (!game || !settings.books) return;
    setLoading(true);
    try {
      setData(await getScan(game, settings.books));
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [game, settings.books]);

  useEffect(() => {
    load();
  }, [load]);

  const items = useMemo(() => {
    if (!data) return [];
    const out = [];
    data.rows.forEach((row) =>
      ["dd", "td"].forEach((kind) => {
        const market = row[kind];
        if (!market) return;
        const res = evaluate(market, bookEstimates(row.books, kind, settings.method, settings.source, settings.sgpHold), settings.fees);
        out.push({ row, kind, market, res, best: Math.max(res.evYes ?? -9, res.evNo ?? -9) });
      })
    );
    const hasFair = out.some((i) => i.res.n);
    return out
      .filter((i) => !hasFair || !settings.positiveOnly || i.best > 0)
      .filter((i) => !hasFair || !settings.minEv || i.best * 100 >= settings.minEv)
      .sort((a, b) => b.best - a.best || (b.market.yes_ask || 0) - (a.market.yes_ask || 0));
  }, [data, settings]);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">Double & triple-double scanner</h1>
          <p className="text-sm text-slate-400 mt-1">Kalshi prices vs devigged sportsbook SGP average.</p>
        </div>
        {data?.fixture && (
          <div data-testid="fixture-info" className="text-xs font-mono text-slate-500">
            {data.fixture.away} @ {data.fixture.home} · {new Date(data.fixture.start_date).toLocaleString()}
          </div>
        )}
      </div>
      <ControlsBar
        games={games}
        game={game}
        setGame={setGame}
        settings={settings}
        update={update}
        status={status}
        onRefresh={load}
        loading={loading}
        updatedAt={data?.updated_at}
      />
      {data?.message && (
        <div data-testid="scan-message" className="text-xs font-mono text-amber-300 border border-amber-500/30 bg-amber-500/5 rounded px-3 py-2">
          {data.message}
        </div>
      )}
      <div data-testid="scanner-table-container" className="rounded-md border border-slate-800 bg-[#0F131C]/70 overflow-x-auto">
        <table className="w-full min-w-[960px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">
              {HEADS.map((h, i) => (
                <th key={h} className={`py-3 px-3 font-medium ${i < 2 || i === 9 ? "text-left" : "text-right"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => {
              const k = `${it.row.key}-${it.kind}`;
              return <ScannerRow key={k} index={i} item={it} open={!!open[k]} onToggle={() => setOpen((o) => ({ ...o, [k]: !o[k] }))} settings={settings} />;
            })}
          </tbody>
        </table>
        {!items.length && (
          <div data-testid="scanner-empty" className="py-16 text-center text-sm text-slate-500">
            {loading ? "Loading markets…" : games.length ? "No markets match your filters." : "No open Kalshi DD/TD markets right now."}
          </div>
        )}
      </div>
    </div>
  );
}
