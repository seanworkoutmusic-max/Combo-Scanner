import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, ExternalLink } from "lucide-react";
import { getPropsGames, getScannerGame, errMsg } from "../lib/api";
import { PlayerPhoto } from "../components/props/PlayerPhoto";
import { PriceTag } from "../components/props/MarketList";
import { kalshiGameUrl } from "../lib/slip";

const PREFERRED_GAME = "MEMPOR";
const valid = (p) => p != null && p > 0 && p < 1;
const HEADS = ["Player", "Double Double", "Triple Double"];

const Price = ({ p, format, className = "", testid }) => (
  <span data-testid={testid} className={`font-mono ${className}`}>{valid(p) ? <PriceTag p={p} format={format} /> : <span className="text-slate-600">—</span>}</span>
);

// Main price = Kalshi's own market; falls back to the live combo price. Sub-line shows the combo price for comparison.
const OddsCell = ({ market, combo, format, testid, minChance }) => {
  const main = valid(market) ? market : combo;
  const sub = valid(market) && valid(combo) ? "combo " : !valid(market) && valid(combo) ? "from combo" : null;
  return (
    <td className="py-3 px-4 text-right">
      <Price p={main} format={format} className="text-base font-bold text-white" testid={testid} />
      {sub && (
        <div className="text-[11px] font-mono text-slate-500">
          {sub}{valid(market) && <PriceTag p={combo} format={format} />}{minChance ? " · min." : ""}
        </div>
      )}
    </td>
  );
};

const Row = ({ p, format, i }) => {
  const dd = p.singles.find((s) => s.name === "Double Double")?.line;
  const td = p.singles.find((s) => s.name === "Triple Double")?.line;
  const tri = p.combos.find((c) => c.kind === "PRA")?.live?.yes_price;
  const built = p.built_dd;
  const lowerBound = built && (!built.exact || p.combos.some((c) => c.legs.some((l) => l.market === "Points" && l.threshold !== 10)));
  const slug = p.key.replace(/\s/g, "-");
  return (
    <tr data-testid={`scanner-row-${slug}`} style={{ animationDelay: `${i * 30}ms` }} className="row-in border-t border-slate-800/70 hover:bg-white/[0.03] transition-colors">
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <PlayerPhoto src={p.headshot} name={p.name} size={34} />
          <div className="leading-tight">
            <div className="text-sm font-semibold text-white whitespace-nowrap">{p.name}</div>
            <div className="text-[11px] font-mono text-slate-500">{p.team}</div>
          </div>
        </div>
      </td>
      <OddsCell market={dd?.yes_ask} combo={built?.price} format={format} testid={`dd-${slug}`} minChance={lowerBound} />
      <OddsCell market={td?.yes_ask} combo={tri} format={format} testid={`td-${slug}`} />
    </tr>
  );
};

export default function DDScanner({ settings }) {
  const format = settings.fees ? "fee" : "raw";
  const [games, setGames] = useState([]);
  const [game, setGame] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

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
      setData(await getScannerGame(game));
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [game]);

  useEffect(() => { setData(null); load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">Double & triple-double scanner</h1>
          <p className="text-sm text-slate-400 mt-1">Kalshi DD/TD markets next to live Kalshi combos built from 10+ points, rebounds and assists.</p>
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
        <div data-testid="scanner-game-tabs" className="flex items-center gap-1 overflow-x-auto">
          {games.map((g, i) => (
            <button key={g.code} data-testid={`scanner-game-${g.code}`} onClick={() => setGame(g.code)}
              className={`shrink-0 px-2.5 py-1 text-sm font-semibold transition-colors ${i ? "border-l border-slate-800" : ""} ${game === g.code ? "text-white" : "text-slate-500 hover:text-slate-200"}`}>
              {g.label}
            </button>
          ))}
        </div>
        {data?.players[0] && (
          <a data-testid="scanner-bet-on-kalshi" href={kalshiGameUrl(data.players[0].combos[0]?.legs[0]?.ticker || data.players[0].singles[0]?.line.ticker)}
            target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white">
            Bet on Kalshi <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#181818] overflow-x-auto max-w-3xl">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-slate-400">
              {HEADS.map((h, i) => (
                <th key={h} className={`py-3 font-semibold ${i ? "px-4 text-right" : "px-4 text-left"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data?.players.map((p, i) => <Row key={p.key} p={p} i={i} format={format} />)}
          </tbody>
        </table>
        {!data && (
          <div data-testid="scanner-loading" className="py-16 text-center text-sm text-slate-500">
            {loading ? "Asking Kalshi market makers for live combo odds… (about 10 seconds)" : "Pick a game."}
          </div>
        )}
        {data && !data.players.length && <div className="py-16 text-center text-sm text-slate-500">No double-double lines on Kalshi for this game.</div>}
      </div>
      <p className="text-xs text-slate-500 leading-relaxed max-w-3xl">
        Big number = Kalshi's own DD/TD market. Small "combo" = the price built from live Kalshi 10+ combos (or used on its own when Kalshi has no DD/TD market).
        "min." means Kalshi had no 10+ points line, so a higher points line was used.
      </p>
    </div>
  );
}
