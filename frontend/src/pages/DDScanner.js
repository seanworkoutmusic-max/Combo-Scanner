import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, ExternalLink, Search } from "lucide-react";
import { getPropsPlayers, getScannerPlayer, errMsg } from "../lib/api";
import { PlayerPhoto } from "../components/props/PlayerPhoto";
import { PriceTag } from "../components/props/MarketList";
import { kalshiGameUrl } from "../lib/slip";

const DEFAULT_PLAYER = "luka doncic";
const valid = (p) => p != null && p > 0 && p < 1;
const norm = (s) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const PlayerSearch = ({ players, onPick }) => {
  const [q, setQ] = useState("");
  const nq = norm(q).trim();
  const shown = nq ? players.filter((p) => norm(p.name).includes(nq)).slice(0, 8) : [];
  return (
    <div className="relative w-full sm:w-72">
      <div className="flex items-center gap-2 px-3 h-10 rounded-md border border-slate-800 bg-[#141414]">
        <Search className="h-3.5 w-3.5 text-slate-500" />
        <input data-testid="scanner-player-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search any player"
          className="w-full bg-transparent text-sm outline-none placeholder:text-slate-600" />
      </div>
      {shown.length > 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-slate-800 bg-[#141414] shadow-xl">
          {shown.map((p) => (
            <button key={`${p.game}-${p.key}`} data-testid={`scanner-player-option-${p.key.replace(/\s/g, "-")}`}
              onClick={() => { onPick(p); setQ(""); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800/60">
              <PlayerPhoto src={p.headshot} name={p.name} size={26} />
              <span className="flex-1 truncate">{p.name}</span>
              <span className="text-[10px] font-mono text-slate-500">{p.game_label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const SingleCard = ({ s, format }) => (
  <div data-testid={`single-card-${s.name.toLowerCase().replace(/\s/g, "-")}`} className="rounded-md border border-slate-800 bg-[#141414] p-4">
    <div className="text-[10px] uppercase tracking-widest font-mono text-slate-500">{s.name}</div>
    <div className="font-mono text-3xl font-bold text-white mt-1"><PriceTag p={s.line.yes_ask} format={format} /></div>
    <div className="text-[11px] font-mono text-slate-500 mt-1">Kalshi market</div>
  </div>
);

const ComboRow = ({ c, format, i }) => {
  const est = c.legs.every((l) => valid(l.yes_ask)) ? c.legs.reduce((a, l) => a * l.yes_ask, 1) : null;
  const live = c.live && valid(c.live.yes_price) ? c.live.yes_price : null;
  return (
    <tr data-testid={`combo-row-${i}`} className="border-t border-slate-800/70 hover:bg-slate-800/20 transition-colors">
      <td className="py-3 px-4">
        <div className="text-sm font-semibold text-slate-100">{c.name}</div>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {c.legs.map((l) => (
            <span key={l.ticker} className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm border border-slate-700 text-slate-400">
              {l.threshold}+ {l.market} · <span className="text-slate-200"><PriceTag p={l.yes_ask} format={format} /></span>
            </span>
          ))}
        </div>
      </td>
      <td data-testid={`combo-live-${i}`} className="py-3 px-4 text-right font-mono text-xl font-bold text-cyan-300">
        {live ? <PriceTag p={live} format={format} /> : <span className="text-sm text-slate-600">{c.error ? "error" : "no quote"}</span>}
      </td>
      <td className="py-3 px-4 text-right font-mono text-sm text-slate-400 hidden sm:table-cell"><PriceTag p={est} format={format} /></td>
      <td className="py-3 px-4 text-right font-mono text-xs text-slate-500 hidden sm:table-cell">{c.live?.quotes ?? "—"}</td>
    </tr>
  );
};

export default function DDScanner({ settings }) {
  const format = settings.fees ? "fee" : "raw";
  const [players, setPlayers] = useState([]);
  const [pick, setPick] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getPropsPlayers().then((ps) => {
      setPlayers(ps);
      setPick(ps.find((p) => p.key === DEFAULT_PLAYER) || ps[0] || null);
    }).catch((e) => toast.error(errMsg(e)));
  }, []);

  const load = useCallback(async () => {
    if (!pick) return;
    setLoading(true);
    try {
      setData(await getScannerPlayer(pick.game, pick.key));
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [pick]);

  useEffect(() => { load(); }, [load]);

  const p = data?.player;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PlayerSearch players={players} onPick={(x) => { setData(null); setPick(x); }} />
        <div className="flex items-center gap-3">
          <span data-testid="scanner-updated" className="text-[11px] font-mono text-slate-500">
            {data ? `Updated ${new Date(data.updated_at).toLocaleTimeString()}` : ""}
          </span>
          <button data-testid="scanner-refresh-btn" onClick={load} disabled={loading}
            className="h-9 w-9 grid place-items-center rounded-full border border-slate-800 text-slate-300 hover:text-cyan-300 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-cyan-300" : ""}`} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-4">
          <PlayerPhoto src={p?.headshot || pick?.headshot} name={p?.name || pick?.name} size={80} testid="scanner-player-photo" />
          <div>
            <h1 data-testid="scanner-player-name" className="font-display text-4xl sm:text-5xl font-bold tracking-tight">{p?.name || pick?.name || "—"}</h1>
            <div className="text-xs font-mono text-slate-500 mt-1">{data ? `${p.team} · ${data.game.label} · ${data.game.date}` : pick?.game_label || ""}</div>
          </div>
        </div>
        {data && (
          <a data-testid="scanner-bet-on-kalshi" href={kalshiGameUrl(data.combos[0]?.legs[0]?.ticker || data.singles[0]?.line.ticker)} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 h-10 px-5 rounded bg-cyan-400 text-slate-950 text-sm font-bold tracking-widest uppercase hover:bg-cyan-300 transition-colors">
            Bet on Kalshi <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {!data ? (
        <div data-testid="scanner-loading" className="py-16 text-center text-sm text-slate-500">
          {loading ? "Asking Kalshi market makers for live combo odds…" : "Pick a player."}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 max-w-md">
            {data.singles.map((s) => <SingleCard key={s.name} s={s} format={format} />)}
          </div>
          <div className="rounded-md border border-slate-800 bg-[#141414] overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest font-mono text-slate-500">
                  <th className="text-left py-3 px-4 font-medium">Combo</th>
                  <th className="text-right py-3 px-4 font-medium">Live Kalshi</th>
                  <th className="text-right py-3 px-4 font-medium hidden sm:table-cell">Legs multiplied</th>
                  <th className="text-right py-3 px-4 font-medium hidden sm:table-cell">Quotes</th>
                </tr>
              </thead>
              <tbody>
                {data.combos.map((c, i) => <ComboRow key={c.name} c={c} i={i} format={format} />)}
              </tbody>
            </table>
            {!data.combos.length && <div className="py-10 text-center text-sm text-slate-500">No combo pairings available for this player.</div>}
          </div>
        </>
      )}
    </div>
  );
}
