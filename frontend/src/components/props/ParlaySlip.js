import { useState } from "react";
import { Trash2, ChevronDown, RefreshCw, ExternalLink } from "lucide-react";
import { BookOdds } from "./BookOdds";
import { Verdict } from "./Verdict";
import { PriceTag } from "./MarketList";
import { PlayerPhoto } from "./PlayerPhoto";
import { Ladder } from "./Ladder";
import { americanToProb, avg, devigOneSided, evPct, legOver, kalshiGameUrl } from "../../lib/slip";
import { fmtAmerican, probToAmerican } from "../../lib/ev";

const valid = (p) => p != null && p > 0 && p < 1;

export const kalshiParlayPrice = (legs, combo, live) => {
  if (live && valid(live.yes_price)) return { price: live.yes_price, source: "live" };
  if (combo && valid(combo.yes_ask)) return { price: combo.yes_ask, source: "exact" };
  if (legs.every((l) => valid(l.yes_ask))) return { price: legs.reduce((a, l) => a * l.yes_ask, 1), source: "estimate" };
  return { price: null, source: null };
};

const SOURCE_TEXT = {
  live: "Live Kalshi combo quote",
  exact: "Live Kalshi combo market",
  estimate: "Estimated: Kalshi legs multiplied (ignores correlation)",
};

const LiquidityDropdown = ({ rows, format }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <button data-testid="show-liquidity-btn" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between h-8 px-2.5 rounded border border-slate-800 bg-slate-950/60 text-[11px] font-mono font-semibold uppercase tracking-widest text-slate-300 hover:text-white transition-colors">
        {open ? "Hide liquidity" : "Show liquidity"}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <Ladder rows={rows} format={format} testid="combo-liquidity" title="Order book" />}
    </div>
  );
};

const Leg = ({ l, format, onRemove }) => (
  <div data-testid={`parlay-leg-${l.ticker}`} className="flex items-center justify-between gap-3 py-2.5 border-b border-slate-800/60 last:border-0">
    <PlayerPhoto src={l.headshot} name={l.player} size={30} />
    <div className="min-w-0 flex-1">
      <div className="text-sm font-semibold text-slate-100 truncate">{legOver(l)} · {l.player} {l.market}</div>
      <div className="text-[11px] font-mono text-slate-500">{l.team}{l.threshold ? ` · ${l.threshold}+` : ""}</div>
    </div>
    <div className="flex items-center gap-3 shrink-0">
      <span className="font-mono text-sm text-sky-300"><PriceTag p={l.yes_ask} format={format} /></span>
      <button data-testid={`remove-leg-${l.ticker}`} onClick={onRemove} className="text-slate-500 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
    </div>
  </div>
);

export const ParlaySlip = ({ legs, combo, odds, setOdds, settings, format, remove, live, onLiveQuote, liveLoading, kalshiKey, quoteSize, setQuoteSize }) => {
  const k = kalshiParlayPrice(legs, combo, live);
  const fairs = Object.values(odds)
    .map((o) => americanToProb(o?.price))
    .filter((p) => p != null)
    .map((p) => devigOneSided(p, settings.parlayHold, settings.method));
  const fair = avg(fairs);
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-slate-800 bg-[#0F131C]">
        <div className="flex items-center justify-between px-3 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{legs.length}-Leg Same Game Parlay</span>
            <button
              data-testid="refresh-live-quote-btn"
              onClick={onLiveQuote}
              disabled={!kalshiKey || liveLoading}
              title={kalshiKey ? "Refresh live Kalshi odds" : "Connect Kalshi API key for live odds"}
              className="h-6 w-6 grid place-items-center rounded-full text-slate-400 hover:text-sky-300 hover:bg-slate-800 disabled:opacity-40 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${liveLoading ? "animate-spin text-sky-300" : ""}`} />
            </button>
          </div>
          <div data-testid="parlay-kalshi-price" className="font-mono text-lg font-bold text-sky-300"><PriceTag p={k.price} format={format} /></div>
        </div>
        <div className="px-3">{legs.map((l) => <Leg key={l.ticker} l={l} format={format} onRemove={() => remove(l.ticker)} />)}</div>
        <div className="px-3 py-2.5 border-t border-slate-800">
          <span data-testid="parlay-price-source" className={`text-[11px] font-mono ${k.source === "exact" || k.source === "live" ? "text-emerald-400" : "text-amber-300"}`}>
            {SOURCE_TEXT[k.source] || "No Kalshi price yet"}
            {k.source === "live" && <span className="block text-slate-500">{live.quotes} market maker quotes · {new Date(live.fetched_at * 1000).toLocaleTimeString()}</span>}
            {live && !valid(live.yes_price) && <span className="block text-slate-500">No market maker quoted this combo</span>}
            {combo && valid(combo.yes_ask) && k.source !== "exact" && (
              <span className="block text-emerald-400">Live combo market: {fmtAmerican(probToAmerican(combo.yes_ask))}</span>
            )}
          </span>
        </div>
        <div className="px-3 pb-3 space-y-2.5">
          <a
            data-testid="bet-on-kalshi-btn"
            href={kalshiGameUrl(legs[0]?.ticker)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full h-10 rounded bg-cyan-400 text-slate-950 text-sm font-bold tracking-widest uppercase hover:bg-cyan-300 transition-colors"
          >
            Bet on Kalshi <ExternalLink className="h-3.5 w-3.5" />
          </a>
          {live?.ladder?.length > 0 && <LiquidityDropdown key={live.market_ticker} rows={live.ladder} format={format} />}
        </div>
      </div>
      <Verdict fair={fair} price={k.price} ev={evPct(fair, k.price, settings.fees)} books={fairs.length} format={format} prefix="parlay" />
      <BookOdds mode="parlay" odds={odds} setOdds={setOdds} prefix="parlay" />
    </div>
  );
};
