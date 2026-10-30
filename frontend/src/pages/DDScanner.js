import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, ExternalLink } from "lucide-react";
import { getPropsGames, getScannerGame, errMsg } from "../lib/api";
import { PlayerPhoto } from "../components/props/PlayerPhoto";
import { PriceTag } from "../components/props/MarketList";
import { kalshiGameUrl, americanToProb, devigOneSided, evPct } from "../lib/slip";

const PREFERRED_GAME = "MEMPOR";
const valid = (p) => p != null && p > 0 && p < 1;
const HEADS = ["Player", "DD", "TD", "FanDuel", "DraftKings", "EV"];
const BOOKS = [["fd", "FanDuel"], ["dk", "DraftKings"]];
const HEAD_LOGOS = { FanDuel: "/fd.png", DraftKings: "/dk.png" };

const Price = ({ p, format, className = "", testid }) => (
  <span data-testid={testid} className={`font-mono ${className}`}>{valid(p) ? <PriceTag p={p} format={format} /> : <span className="text-slate-600">—</span>}</span>
);

const OddsBox = ({ value, onChange, testid, label }) => {
  const bad = value && value.length > 1 && americanToProb(value) == null;
  return (
    <label className="flex items-center justify-end gap-1.5">
      {label && <span className="text-[10px] font-mono text-slate-500">{label}</span>}
      <input data-testid={testid} value={value || ""} inputMode="numeric" placeholder="+000" title={bad ? "Use American odds like +150 or -120" : ""}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9+-]/g, ""))}
        className={`w-20 h-8 px-2 rounded-md border bg-[#0E0E0E] font-mono text-sm text-white text-right placeholder:text-slate-700 outline-none ${bad ? "border-red-500/70" : "border-slate-700 focus:border-white/60"}`} />
    </label>
  );
};

const fairFrom = (odds, hold) => {
  const ps = BOOKS.map(([b]) => americanToProb(odds?.[b])).filter((p) => p != null).map((p) => devigOneSided(p, hold));
  return ps.length ? ps.reduce((a, x) => a + x, 0) / ps.length : null;
};

const EvLine = ({ ev, label, testid }) => (
  <div data-testid={testid} className={`font-mono text-sm font-bold ${ev == null ? "text-slate-600" : ev > 0 ? "text-emerald-400" : "text-red-400"}`}>
    {label && <span className="text-[10px] font-normal text-slate-500 mr-1.5">{label}</span>}
    {ev == null ? "—" : `${ev > 0 ? "+" : ""}${(ev * 100).toFixed(1)}%`}
  </div>
);

const Row = ({ p, format, i, odds, setOdds, settings, tdPts }) => {
  const tri = p.combos.find((c) => c.kind === "TD" || c.also_td)?.live?.yes_price;
  const tdKey = `td${tdPts}`;
  const dd = p.built_dd?.price;
  const lowerBound = p.built_dd && (!p.built_dd.exact || p.combos.some((c) => c.legs.some((l) => l.market === "Points" && l.threshold !== 10)));
  const slug = p.key.replace(/\s/g, "-");
  const hasTd = valid(tri);
  const evDd = evPct(fairFrom(odds.dd, settings.singleHold), dd, settings.fees);
  const evTd = hasTd ? evPct(fairFrom(odds[tdKey], settings.singleHold), tri, settings.fees) : null;
  return (
    <tr data-testid={`scanner-row-${slug}`} style={{ animationDelay: `${i * 30}ms` }} className="row-in border-t border-slate-800/70 hover:bg-white/[0.03] transition-colors">
      <td className="py-3 px-4 sticky left-0 z-10 bg-[#181818]">
        <div className="flex items-center gap-3">
          <PlayerPhoto src={p.headshot} name={p.name} size={34} />
          <div className="leading-tight">
            <div className="text-sm font-semibold text-white whitespace-nowrap">{p.name}</div>
            <div className="text-[11px] font-mono text-slate-500">{p.team}</div>
          </div>
        </div>
      </td>
      <td className="py-3 px-4 text-right">
        <Price p={dd} format={format} className="text-base font-bold text-white" testid={`dd-${slug}`} />
        {lowerBound && <div className="text-[10px] font-mono text-slate-500">min.</div>}
      </td>
      <td className="py-3 px-4 text-right"><Price p={tri} format={format} className="text-base font-bold text-white" testid={`td-${slug}`} /></td>
      {BOOKS.map(([b]) => (
        <td key={b} className="py-3 px-4">
          <div className="space-y-1.5">
            <OddsBox testid={`${b}-dd-${slug}`} label={hasTd ? "DD" : null} value={odds.dd?.[b]} onChange={(v) => setOdds("dd", b, v)} />
            {hasTd && <OddsBox testid={`${b}-td-${slug}`} label="TD" value={odds[tdKey]?.[b]} onChange={(v) => setOdds(tdKey, b, v)} />}
          </div>
        </td>
      ))}
      <td className="py-3 px-4 text-right space-y-1.5">
        <EvLine ev={evDd} label={hasTd ? "DD" : null} testid={`ev-dd-${slug}`} />
        {hasTd && <EvLine ev={evTd} label="TD" testid={`ev-td-${slug}`} />}
      </td>
    </tr>
  );
};

export default function DDScanner({ settings }) {
  const format = settings.fees ? "fee" : "raw";
  const [games, setGames] = useState([]);
  const [game, setGame] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tdPts, setTdPts] = useState(10);
  const [bookOdds, setBookOdds] = useState(() => {
    try { return JSON.parse(localStorage.getItem("dd-book-odds") || "{}"); } catch { return {}; }
  });
  useEffect(() => localStorage.setItem("dd-book-odds", JSON.stringify(bookOdds)), [bookOdds]);
  const players = (data?.players || []).filter((p) => valid(p.built_dd?.price) || p.combos.some((c) => (c.kind === "TD" || c.also_td) && valid(c.live?.yes_price)));

  useEffect(() => {
    getPropsGames().then((g) => {
      setGames(g);
      setGame((g.find((x) => x.code.endsWith(PREFERRED_GAME)) || g[0])?.code || "");
    }).catch((e) => toast.error(errMsg(e)));
  }, []);

  const load = useCallback(async () => {
    if (!game) return;
    setLoading(true);
    try {
      setData(await getScannerGame(game, tdPts));
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [game, tdPts]);

  useEffect(() => { setData(null); load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">Double & triple-double scanner</h1>
          <p className="text-sm text-slate-400 mt-1">Live Kalshi combo prices for double-doubles and triple-doubles. Add FanDuel or DraftKings odds to see EV.</p>
          <p data-testid="scanner-updated" className="text-sm font-semibold text-white mt-1">
            {data ? `Updated ${new Date(data.updated_at).toLocaleTimeString()}` : loading ? "Pricing combos with Kalshi market makers…" : ""}
          </p>
        </div>
        <button data-testid="scanner-refresh-btn" onClick={load} disabled={loading}
          className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white text-slate-950 text-sm font-semibold hover:bg-slate-200 disabled:opacity-50 transition-colors">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
        <div data-testid="scanner-game-tabs" className="flex items-center gap-1 overflow-x-auto">
          {games.map((g, i) => (
            <button key={g.code} data-testid={`scanner-game-${g.code}`} onClick={() => setGame(g.code)}
              className={`shrink-0 px-2.5 py-1 text-sm font-semibold transition-colors ${i ? "border-l border-slate-800" : ""} ${game === g.code ? "text-white" : "text-slate-500 hover:text-slate-200"}`}>
              {g.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-400">
          TD points
          <select data-testid="td-points-select" value={tdPts} onChange={(e) => setTdPts(Number(e.target.value))}
            className="h-8 pl-2.5 pr-7 rounded-lg border border-slate-700 bg-[#0E0E0E] text-sm font-semibold text-white outline-none focus:border-white/60 cursor-pointer">
            {[10, 15, 20].map((n) => <option key={n} value={n}>{n}+ pts</option>)}
          </select>
        </label>
        </div>
        {data?.players[0] && (
          <a data-testid="scanner-bet-on-kalshi" href={kalshiGameUrl(data.players[0].combos[0]?.legs[0]?.ticker || data.players[0].singles[0]?.line.ticker)}
            target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white">
            Bet on Kalshi <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#181818] overflow-x-auto">
        <table className="w-full min-w-[820px]">
          <thead>
            <tr className="text-xs text-slate-400">
              {HEADS.map((h) => (h === "TD" ? `TD (${tdPts}+ pts)` : h)).map((h, i) => (
                <th key={h} className={`py-3 font-semibold ${i ? "px-4 text-right" : "px-4 text-left sticky left-0 z-10 bg-[#181818]"}`}>
                  {HEAD_LOGOS[h] ? (
                    <span className="inline-flex items-center gap-1.5">
                      <img data-testid={`logo-${h.toLowerCase()}`} src={HEAD_LOGOS[h]} alt="" className="h-4 w-4 rounded-[3px]" />{h}
                    </span>
                  ) : h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((p, i) => (
              <Row key={p.key} p={p} i={i} format={format} settings={settings} tdPts={tdPts} odds={bookOdds[p.key] || {}}
                setOdds={(m, b, v) => setBookOdds((o) => ({ ...o, [p.key]: { ...o[p.key], [m]: { ...o[p.key]?.[m], [b]: v } } }))} />
            ))}
          </tbody>
        </table>
        {!data && (
          <div data-testid="scanner-loading" className="py-16 text-center text-sm text-slate-500">
            {loading ? "Asking Kalshi market makers for live combo odds… (about 10 seconds)" : "Pick a game."}
          </div>
        )}
        {data && !players.length && <div className="py-16 text-center text-sm text-slate-500">No double-double lines on Kalshi for this game.</div>}
      </div>
      <p className="text-xs text-slate-500 leading-relaxed max-w-3xl">
        DD and TD are live Kalshi combo prices built from 10+ points, rebounds and assists (fee included). Type FanDuel and/or DraftKings odds and EV
        updates instantly: the book odds have a {settings.singleHold}% hold removed, the books are averaged, then compared to the Kalshi combo price.
        "min." means Kalshi had no 10+ points line, so a higher points line was used.
      </p>
    </div>
  );
}
