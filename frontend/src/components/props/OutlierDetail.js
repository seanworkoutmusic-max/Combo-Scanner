import { X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import { TeamLogo } from "./TeamLogo";
import { fmtAmerican } from "../../lib/ev";

const LOGOS = { Fanatics: "/fanatics-f.png", DraftKings: "/dk.png", FanDuel: "/fd.png", BetMGM: "/betmgm.png", "Hard Rock": "/hardrock.png" };
const dec = (a) => (a > 0 ? 1 + a / 100 : 1 + 100 / -a);
const ago = (s) => (s < 60 ? "just now" : s < 3600 ? `${Math.floor(s / 60)}m ago` : `${Math.floor(s / 3600)}h ago`);
const short = (s) => (s < 60 ? "new" : s < 3600 ? `${Math.floor(s / 60)}m` : `${Math.floor(s / 3600)}h`);
const when = (iso) => new Date(iso).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });
const MARKET_TITLE = { points: "Points", rebounds: "Rebounds", assists: "Assists", "pts + reb": "Pts + Reb", "pts + ast": "Pts + Ast", "reb + ast": "Reb + Ast", "pts + reb + ast": "Pts + Reb + Ast", threes: "Threes", steals: "Steals", blocks: "Blocks" };

const BookRow = ({ book, price, sub, diff, main }) => (
  <div data-testid={`outlier-book-${book.replace(/\s/g, "-").toLowerCase()}`}
    className={`flex items-center gap-3 px-4 py-3 border-t border-slate-800 first:border-t-0 ${main ? "border-l-2 border-l-red-500 bg-white/[0.03]" : ""}`}>
    <img src={LOGOS[book]} alt="" className="h-6 w-6 rounded-md object-cover shrink-0" />
    <div className="flex-1 min-w-0">
      <div className="text-sm font-semibold text-white">{book}</div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </div>
    <div className="font-mono font-bold text-white w-16 text-right">{fmtAmerican(price)}</div>
    <div className="font-mono text-xs text-slate-500 w-12 text-right">{diff}</div>
  </div>
);

export const OutlierDetail = ({ r, onClose }) => (
  <Dialog open={!!r} onOpenChange={(o) => !o && onClose()}>
    <DialogContent data-testid="outlier-detail" className="max-w-md bg-[#141414] border-slate-800 text-white p-6 [&>button]:hidden">
      {r && (
        <>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-1.5 text-sm font-bold">
              <TeamLogo team={r.game.away} size={18} />{r.game.away}<span className="text-slate-600 font-normal">@</span><TeamLogo team={r.game.home} size={18} />{r.game.home}
              <span className="ml-2 font-mono text-xs font-normal text-slate-500">{when(r.game.date)}</span>
            </div>
            <button data-testid="outlier-detail-close" onClick={onClose} className="text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
          </div>
          <DialogTitle className="mt-4 text-xl font-bold">Over {r.line} {MARKET_TITLE[r.market]}</DialogTitle>
          <div className="text-sm text-slate-400">{r.player}</div>
          <div className="mt-4 rounded-xl border border-slate-800 overflow-hidden">
            <BookRow book="Fanatics" price={r.price} sub={short(r.open_for)} main />
            {r.prices.map((p) => <BookRow key={p.book} book={p.book} price={p.price} diff={`${Math.round((dec(p.price) / dec(r.price) - 1) * 100)}%`} />)}
          </div>
          <div className="mt-5">
            <div className="text-xs font-semibold text-slate-500">What moved</div>
            <div className="mt-2 flex gap-3">
              <div className="flex flex-col items-center pt-1"><span className="h-2.5 w-2.5 rounded-full border-2 border-emerald-400" /><span className="w-px flex-1 bg-slate-700 mt-1" /></div>
              <div data-testid="outlier-opened">
                <div className="text-sm font-semibold text-white">Opened: Fanatics {fmtAmerican(r.price)} vs {r.opened.next_book} {fmtAmerican(r.opened.next_best)}</div>
                <div className="font-mono text-xs text-slate-500">{new Date(r.opened.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} · {ago(r.open_for)}</div>
              </div>
            </div>
          </div>
        </>
      )}
    </DialogContent>
  </Dialog>
);
