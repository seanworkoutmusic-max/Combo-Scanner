import { useState } from "react";
import { Trash2 } from "lucide-react";
import { BookOdds } from "./BookOdds";
import { Verdict } from "./Verdict";
import { PriceTag } from "./MarketList";
import { PlayerPhoto } from "./PlayerPhoto";
import { Ladder } from "./Ladder";
import { toast } from "sonner";
import { getOrderbook, errMsg } from "../../lib/api";
import { americanToProb, avg, devig, devigOneSided, evPct, legLabel, legOver } from "../../lib/slip";

const StraightLeg = ({ leg, odds, setOdds, settings, format, onRemove }) => {
  const [open, setOpen] = useState(false);
  const [book, setBook] = useState(null);
  const toggleBook = async () => {
    if (book) return setBook(null);
    try {
      setBook(await getOrderbook(leg.ticker));
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  const fairs = Object.values(odds || {})
    .map((o) => {
      const po = americanToProb(o?.over);
      if (po == null) return null;
      const pu = americanToProb(o?.under);
      return pu != null ? devig(po, pu, settings.method) : devigOneSided(po, settings.singleHold, settings.method);
    })
    .filter((x) => x != null);
  const fair = avg(fairs);
  const id = leg.ticker;
  return (
    <div data-testid={`straight-leg-${id}`} className="rounded-xl border border-slate-800 bg-[#121212] p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <PlayerPhoto src={leg.headshot} name={leg.player} size={34} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-100">{legOver(leg)} · {leg.player} {leg.market}</div>
          <div className="text-[11px] font-mono text-slate-500">{leg.team} · {legLabel(leg)}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-sky-300"><PriceTag p={leg.yes_ask} format={format} /></span>
          <button data-testid={`remove-leg-${id}`} onClick={onRemove} className="text-slate-500 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      <Verdict fair={fair} price={leg.yes_ask} ev={evPct(fair, leg.yes_ask, settings.fees)} books={fairs.length} format={format} prefix={`straight-${id}`} />
      <div className="flex gap-4">
        <button data-testid={`toggle-book-odds-${id}`} onClick={() => setOpen(!open)} className="text-xs text-cyan-300 hover:text-cyan-200">
          {open ? "Hide book odds" : "Enter book odds"}
        </button>
        <button data-testid={`toggle-orderbook-${id}`} onClick={toggleBook} className="text-xs text-cyan-300 hover:text-cyan-200">
          {book ? "Hide order book" : "Kalshi order book"}
        </button>
      </div>
      {book && <Ladder rows={book.yes_asks} format={format} testid={`orderbook-${id}`} title="Kalshi YES asks · available now" cumulative />}
      {open && <BookOdds mode="straight" odds={odds || {}} setOdds={setOdds} prefix={`straight-${id}`} />}
    </div>
  );
};

export const StraightSlip = ({ legs, bookOdds, setBookOdds, settings, format, remove }) => (
  <div className="space-y-3">
    {legs.map((l) => (
      <StraightLeg
        key={l.ticker}
        leg={l}
        odds={bookOdds[l.ticker]}
        setOdds={(b, v) => setBookOdds(l.ticker, b, v)}
        settings={settings}
        format={format}
        onRemove={() => remove(l.ticker)}
      />
    ))}
  </div>
);
