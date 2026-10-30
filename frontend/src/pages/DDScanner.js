import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, ExternalLink } from "lucide-react";
import { getPropsPlayers, getScannerPlayer, errMsg } from "../lib/api";
import { PlayerPhoto } from "../components/props/PlayerPhoto";
import { PriceTag } from "../components/props/MarketList";
import { kalshiGameUrl } from "../lib/slip";

// Players shown in the scanner. Add more keys here later.
const SCANNER_PLAYERS = ["luka doncic"];
const HEADS = ["Player", "Market", "Kalshi Yes", "Kalshi No", "Legs multiplied", "Quotes", "Source"];
const valid = (p) => p != null && p > 0 && p < 1;

const Tag = ({ kind, children }) => {
  const cls = kind === "td" ? "border-slate-500 text-slate-100" : kind === "dd" ? "border-cyan-400/50 text-cyan-300" : "border-slate-700 text-slate-300";
  return <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-sm border whitespace-nowrap ${cls}`}>{children}</span>;
};

const C = ({ children, className = "", testid }) => (
  <td data-testid={testid} className={`py-2.5 px-3 font-mono text-sm text-right ${className}`}>{children}</td>
);

const rowsFor = (d) => [
  ...d.singles.map((s) => ({ id: s.name === "Double Double" ? "dd" : "td", kind: s.name === "Double Double" ? "dd" : "td",
    tag: s.name === "Double Double" ? "DOUBLE-DBL" : "TRIPLE-DBL", label: null, yes: s.line.yes_ask, no: s.line.no_ask, src: "Kalshi market" })),
  ...d.combos.map((c, i) => ({ id: `combo-${i}`, kind: "combo", tag: "COMBO", label: c.name, legs: c.legs,
    yes: valid(c.live?.yes_price) ? c.live.yes_price : null,
    est: c.legs.every((l) => valid(l.yes_ask)) ? c.legs.reduce((a, l) => a * l.yes_ask, 1) : null,
    quotes: c.live?.quotes, src: valid(c.live?.yes_price) ? "Live quote" : c.error ? "Error" : "No quote" })),
];

const Row = ({ r, player, format, index }) => (
  <tr data-testid={`scanner-row-${r.id}`} style={{ animationDelay: `${index * 25}ms` }}
    className="row-in border-t border-slate-800/70 hover:bg-slate-800/25 transition-colors">
    <td className="py-2.5 px-3">
      <div className="flex items-center gap-2.5">
        <PlayerPhoto src={player.headshot} name={player.name} size={30} />
        <span className="text-sm text-slate-100 whitespace-nowrap">{player.name}</span>
        <span className="text-[10px] font-mono text-slate-500">{player.team}</span>
      </div>
    </td>
    <td className="py-2.5 px-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Tag kind={r.kind}>{r.tag}</Tag>
        {r.label && <span className="text-xs text-slate-300">{r.label}</span>}
      </div>
    </td>
    <C testid={`scanner-yes-${r.id}`} className={r.kind === "combo" ? "text-cyan-300 font-bold" : "text-white"}>
      {r.yes ? <PriceTag p={r.yes} format={format} /> : <span className="text-slate-600">—</span>}
    </C>
    <C className="text-slate-400">{r.no ? <PriceTag p={r.no} format={format} /> : "—"}</C>
    <C className="text-slate-400">{r.est ? <PriceTag p={r.est} format={format} /> : "—"}</C>
    <C className="text-slate-500">{r.quotes ?? "—"}</C>
    <td className="py-2.5 px-3 text-[10px] font-mono text-slate-500 whitespace-nowrap">{r.src}</td>
  </tr>
);

export default function DDScanner({ settings }) {
  const format = settings.fees ? "fee" : "raw";
  const [targets, setTargets] = useState(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getPropsPlayers()
      .then((ps) => setTargets(SCANNER_PLAYERS.map((k) => ps.find((p) => p.key === k)).filter(Boolean)))
      .catch((e) => { setTargets([]); toast.error(errMsg(e)); });
  }, []);

  const load = useCallback(async () => {
    if (!targets?.length) return;
    setLoading(true);
    try {
      setData(await Promise.all(targets.map((t) => getScannerPlayer(t.game, t.key))));
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [targets]);

  useEffect(() => { load(); }, [load]);

  const updated = data[0]?.updated_at;
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">Double & triple-double scanner</h1>
          <p className="text-sm text-slate-400 mt-1">Live Kalshi odds for double-doubles, triple-doubles and stat combos.</p>
        </div>
        <div className="flex items-center gap-3">
          <span data-testid="scanner-updated" className="text-[11px] font-mono text-slate-500">
            {updated ? `Updated ${new Date(updated).toLocaleTimeString()}` : ""}
          </span>
          <button data-testid="scanner-refresh-btn" onClick={load} disabled={loading}
            className="flex items-center gap-1.5 h-9 px-3 rounded bg-cyan-400 text-slate-950 text-sm font-semibold hover:bg-cyan-300 disabled:opacity-50 transition-colors">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {data.map((d) => (
        <div key={d.player.key} data-testid={`scanner-table-${d.player.key.replace(/\s/g, "-")}`} className="rounded-xl border border-slate-800 bg-[#181818]/80 overflow-x-auto">
          <div className="flex items-center justify-between gap-3 px-3 py-2.5 border-b border-slate-800">
            <span className="text-xs font-mono text-slate-500">{d.game.label} · {d.game.date}</span>
            <a data-testid="scanner-bet-on-kalshi" href={kalshiGameUrl(d.singles[0]?.line.ticker || d.combos[0]?.legs[0]?.ticker)} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[11px] font-mono font-semibold uppercase tracking-widest text-cyan-300 hover:text-cyan-200">
              Bet on Kalshi <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">
                {HEADS.map((h, i) => (
                  <th key={h} className={`py-3 px-3 font-medium ${i < 2 || i === 6 ? "text-left" : "text-right"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowsFor(d).map((r, i) => <Row key={r.id} r={r} index={i} player={d.player} format={format} />)}
            </tbody>
          </table>
        </div>
      ))}
      {!data.length && (
        <div data-testid="scanner-loading" className="rounded-xl border border-slate-800 bg-[#181818]/70 py-16 text-center text-sm text-slate-500">
          {targets === null || loading ? "Asking Kalshi market makers for live combo odds…" : "Luka Dončić has no game on Kalshi today. He'll show up here on his next game day."}
        </div>
      )}
    </div>
  );
}
