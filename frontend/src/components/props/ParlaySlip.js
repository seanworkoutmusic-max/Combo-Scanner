import { Trash2, ExternalLink } from "lucide-react";
import { BookOdds } from "./BookOdds";
import { PriceTag } from "./MarketList";
import { PlayerPhoto } from "./PlayerPhoto";
import { americanToProb, avg, devigOneSided, evPct, legOver, kalshiGameUrl } from "../../lib/slip";

const valid = (p) => p != null && p > 0 && p < 1;

export const kalshiParlayPrice = (legs, combo, live) => {
  if (live && valid(live.yes_price)) return { price: live.yes_price, source: "live" };
  if (combo && valid(combo.yes_ask)) return { price: combo.yes_ask, source: "exact" };
  if (legs.every((l) => valid(l.yes_ask))) return { price: legs.reduce((a, l) => a * l.yes_ask, 1), source: "estimate" };
  return { price: null, source: null };
};

const Leg = ({ l, format, onRemove }) => (
  <div data-testid={`parlay-leg-${l.ticker}`} className="flex items-center justify-between gap-3 py-2.5 border-b border-slate-800/60 last:border-0">
    <PlayerPhoto src={l.headshot} name={l.player} size={30} />
    <div className="min-w-0 flex-1">
      <div className="text-sm font-semibold text-slate-100 truncate">{legOver(l)} · {l.player} {l.market}</div>
      <div className="text-[11px] font-mono text-slate-500">{l.team}{l.threshold ? ` · ${l.threshold}+` : ""}</div>
    </div>
    <div className="flex items-center gap-3 shrink-0">
      <span className="font-mono text-sm text-emerald-400"><PriceTag p={l.yes_ask} format={format} /></span>
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
  const ev = evPct(fair, k.price, settings.fees);
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-[#181818]">
        <div className="flex items-center justify-between px-3 py-3 border-b border-slate-800">
          <span className="text-sm font-semibold">{legs.length}-Leg Same Game Parlay</span>
        </div>
        <div className="px-3">{legs.map((l) => <Leg key={l.ticker} l={l} format={format} onRemove={() => remove(l.ticker)} />)}</div>
        <div className="px-3 py-3 border-t border-slate-800 space-y-2.5">
          <a
            data-testid="bet-on-kalshi-btn"
            href={kalshiGameUrl(legs[0]?.ticker)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full h-10 rounded bg-white text-slate-950 text-sm font-bold tracking-widest uppercase hover:bg-slate-200 transition-colors"
          >
            Bet on Kalshi <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
      <BookOdds mode="parlay" odds={odds} setOdds={setOdds} prefix="parlay"
        kalshi={
          <span className="flex items-center gap-2">
            {ev != null && (
              <span data-testid="parlay-ev" className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${ev > 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                EV {ev > 0 ? "+" : ""}{(ev * 100).toFixed(1)}%
              </span>
            )}
            {k.price ? <PriceTag p={k.price} format={format} /> : liveLoading ? "…" : "—"}
          </span>
        } />
    </div>
  );
};
