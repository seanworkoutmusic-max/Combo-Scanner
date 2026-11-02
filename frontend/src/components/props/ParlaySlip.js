import { useState } from "react";
import { Trash2, ChevronDown, ExternalLink } from "lucide-react";
import { BookOdds } from "./BookOdds";
import { Ev } from "./Verdict";
import { PriceTag } from "./MarketList";
import { PlayerPhoto } from "./PlayerPhoto";
import { Ladder } from "./Ladder";
import { americanToProb, avg, devigOneSided, evPct, legOver, kalshiGameUrl } from "../../lib/slip";

const valid = (p) => p != null && p > 0 && p < 1;

export const kalshiParlayPrice = (legs, combo, live) => {
  if (live && valid(live.yes_price)) return { price: live.yes_price, source: "live" };
  if (combo && valid(combo.yes_ask)) return { price: combo.yes_ask, source: "exact" };
  if (legs.every((l) => valid(l.yes_ask))) return { price: legs.reduce((a, l) => a * l.yes_ask, 1), source: "estimate" };
  return { price: null, source: null };
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
            className="flex items-center justify-center gap-2 w-full h-10 rounded bg-emerald-400 text-slate-950 text-sm font-bold tracking-widest uppercase hover:bg-emerald-300 transition-colors"
          >
            Bet on Kalshi <ExternalLink className="h-3.5 w-3.5" />
          </a>
          {live?.ladder?.length > 0 && <LiquidityDropdown key={live.market_ticker} rows={live.ladder} format={format} />}
        </div>
      </div>
      <BookOdds mode="parlay" odds={odds} setOdds={setOdds} prefix="parlay"
        kalshi={k.price ? <PriceTag p={k.price} format={format} /> : liveLoading ? "…" : "—"} />
      <div data-testid="parlay-verdict" className={`flex items-center justify-between rounded border px-3 py-2.5 ${ev > 0 ? "border-emerald-500/50 bg-emerald-500/10" : "border-slate-800 bg-slate-950/50"}`}>
        <span className="text-[10px] uppercase tracking-widest font-mono text-slate-500">EV</span>
        <span className="text-lg"><Ev ev={ev} testid="parlay-ev" /></span>
      </div>
    </div>
  );
};
