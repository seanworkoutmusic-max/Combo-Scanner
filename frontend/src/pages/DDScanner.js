import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, ExternalLink } from "lucide-react";
import { getPropsGames, getScannerGame, errMsg } from "../lib/api";
import { PlayerPhoto } from "../components/props/PlayerPhoto";
import { GameLabel } from "../components/props/TeamLogo";
import { PriceTag } from "../components/props/MarketList";
import { kalshiGameUrl, americanToProb, devigOneSided, evPct } from "../lib/slip";

const valid = (p) => p != null && p > 0 && p < 1;
const HEADS = ["Player", "TD", "FanDuel", "DraftKings", "EV"];
const BOOKS = [["fd", "FanDuel"], ["dk", "DraftKings"]];
const HEAD_LOGOS = { FanDuel: "/fd.png", DraftKings: "/dk.png" };

const Price = ({ p, format, className = "", testid }) => (
  <span data-testid={testid} className={`font-mono ${className}`}>{valid(p) ? <PriceTag p={p} format={format} /> : <span className="text-slate-600">—</span>}</span>
);

const OddsBox = ({ value, onChange, testid, label, auto }) => {
  const bad = value && value.length > 1 && americanToProb(value) == null;
  return (
    <label className="flex items-center justify-end gap-1.5">
      {label && <span className="text-[10px] font-mono text-slate-500">{label}</span>}
      <input data-testid={testid} value={value || ""} inputMode="numeric" placeholder="+000"
        title={bad ? "Use American odds like +150 or -120" : auto ? "Live from the sportsbook. Type to override." : ""}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9+-]/g, ""))}
        className={`w-20 h-8 px-2 rounded-md border bg-[#0E0E0E] font-mono text-sm text-right placeholder:text-slate-700 outline-none ${auto ? "text-emerald-300" : "text-white"} ${bad ? "border-red-500/70" : "border-slate-700 focus:border-white/60"}`} />
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
  const slug = p.key.replace(/\s/g, "-");
  const auto = Object.fromEntries(Object.entries(p.books || {}).map(([b, v]) => [b, v > 0 ? `+${v}` : `${v}`]));
  const merged = Object.fromEntries(BOOKS.map(([b]) => [b, odds[tdKey]?.[b] || auto[b]]));
  const evTd = evPct(fairFrom(merged, settings.singleHold), tri, settings.fees);
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
        <Price p={tri} format={format} className="text-base font-bold text-white" testid={`td-${slug}`} />
        {!p.combos.length && <div className="text-[10px] font-mono text-slate-500">no Kalshi combo</div>}
      </td>
      {BOOKS.map(([b]) => (
        <td key={b} className="py-3 px-4">
          <OddsBox testid={`${b}-td-${slug}`} value={merged[b]} auto={!odds[tdKey]?.[b] && auto[b] != null} onChange={(v) => setOdds(tdKey, b, v)} />
        </td>
      ))}
      <td className="py-3 px-4 text-right"><EvLine ev={evTd} testid={`ev-td-${slug}`} /></td>
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
  const players = data?.players || [];

  useEffect(() => {
    getPropsGames().then((g) => {
      setGames(g);
      setGame((prev) => prev || g[0]?.code || "");
    }).catch((e) => toast.error(errMsg(e)));
  }, []);

  const reqId = useRef(0);
  const load = useCallback(async () => {
    if (!game) return;
    const id = ++reqId.current;
    setLoading(true);
    try {
      const d = await getScannerGame(game, tdPts);
      if (id === reqId.current) setData(d);
    } catch (e) {
      if (id === reqId.current) toast.error(errMsg(e));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [game, tdPts]);

  useEffect(() => { setData(null); load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">Triple-double scanner</h1>
          <p className="text-sm text-slate-400 mt-1">Live Kalshi combo prices for triple-doubles, with FanDuel and DraftKings odds pulled in automatically.</p>
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
        <div className="flex items-center gap-4 flex-wrap min-w-0 max-w-full">
        <div data-testid="scanner-game-tabs" className="flex items-center gap-1 overflow-x-auto max-w-full">
          {games.map((g, i) => (
            <button key={g.code} data-testid={`scanner-game-${g.code}`} onClick={() => setGame(g.code)}
              className={`shrink-0 px-2.5 py-1 text-sm font-semibold transition-colors ${i ? "border-l border-slate-800" : ""} ${game === g.code ? "text-white" : "text-slate-500 hover:text-slate-200"}`}>
              <GameLabel code={g.code} />
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
        {data && !players.length && (
          <div className="py-16 text-center text-sm text-slate-500">
            No player in this game has Kalshi {tdPts}+ points, 10+ rebounds and 10+ assists lines, so there's no triple-double combo to price.
          </div>
        )}
      </div>
      <p className="text-xs text-slate-500 leading-relaxed max-w-3xl">
        TD is the live Kalshi combo price for {tdPts}+ points, 10+ rebounds and 10+ assists (fee included). EV compares it to the FanDuel/DraftKings
        price with a {settings.singleHold}% hold removed (books averaged).
        {data?.books?.enabled && (tdPts === 10
          ? ` Green odds are live FanDuel/DraftKings "to record a triple-double" prices, refreshed every 5 minutes${data.books.credits_left ? ` (${data.books.credits_left} Odds API credits left this month)` : ""}. Type over them to use your own.`
          : " Live FanDuel/DraftKings odds fill in only at 10+ pts, because books price a regular triple-double.")}
      </p>
    </div>
  );
}
