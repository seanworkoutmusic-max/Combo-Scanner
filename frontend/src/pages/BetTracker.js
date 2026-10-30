import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ClipboardList, Trash2 } from "lucide-react";
import { getBets, setBetStatus, deleteBet, errMsg } from "../lib/api";
import { PlayerPhoto } from "../components/props/PlayerPhoto";
import { GameLabel } from "../components/props/TeamLogo";
import { PriceTag } from "../components/props/MarketList";

export const STAKE_KEY = "bet-stake";
export const getStake = () => Number(localStorage.getItem(STAKE_KEY)) || 10;

const profit = (b) => (b.status === "won" ? (b.stake * (1 - b.price)) / b.price : b.status === "lost" ? -b.stake : 0);
const money = (v) => `${v < 0 ? "-" : ""}$${Math.abs(v).toFixed(2)}`;
const STATUS = [["won", "Won", "bg-emerald-500 text-black"], ["lost", "Lost", "bg-red-500 text-white"], ["void", "Void", "bg-slate-500 text-white"]];

const Stat = ({ label, value, testid, tone = "text-white" }) => (
  <div className="rounded-xl border border-slate-800 bg-[#181818] px-4 py-3">
    <div className="text-[11px] uppercase tracking-widest font-mono text-slate-500">{label}</div>
    <div data-testid={testid} className={`mt-1 font-mono text-xl font-bold ${tone}`}>{value}</div>
  </div>
);

const BetRow = ({ b, onStatus, onDelete }) => {
  const p = profit(b);
  return (
    <tr data-testid={`bet-row-${b.id}`} className="border-t border-slate-800/70 hover:bg-white/[0.03] transition-colors">
      <td className="py-3 px-4 text-xs font-mono text-slate-500 whitespace-nowrap">{new Date(b.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <PlayerPhoto src={b.headshot} name={b.player} size={32} />
          <div className="leading-tight">
            <div className="text-sm font-semibold text-white whitespace-nowrap">{b.player}</div>
            <div className="text-[11px] font-mono text-slate-400">{b.combo}</div>
          </div>
        </div>
      </td>
      <td className="py-3 px-4 text-sm font-semibold text-slate-300 whitespace-nowrap"><GameLabel code={b.game_code} size={15} /></td>
      <td data-testid={`bet-price-${b.id}`} className="py-3 px-4 text-right font-mono text-sm font-bold text-white"><PriceTag p={b.price} format="raw" /></td>
      <td className={`py-3 px-4 text-right font-mono text-sm font-bold ${b.ev > 0 ? "text-emerald-400" : "text-red-400"}`}>{b.ev == null ? "—" : `${b.ev > 0 ? "+" : ""}${(b.ev * 100).toFixed(1)}%`}</td>
      <td className="py-3 px-4 text-right font-mono text-sm text-slate-300">{money(b.stake)}</td>
      <td className="py-3 px-4 text-right font-mono text-sm text-slate-300">{money((b.stake * (1 - b.price)) / b.price)}</td>
      <td className="py-3 px-4">
        <div className="flex justify-end gap-1">
          {STATUS.map(([s, l, on]) => (
            <button key={s} data-testid={`bet-${s}-${b.id}`} onClick={() => onStatus(b, s)}
              className={`h-7 px-2.5 rounded-md text-xs font-semibold transition-colors ${b.status === s ? on : "bg-white/[0.05] text-slate-400 hover:text-white hover:bg-white/[0.1]"}`}>{l}</button>
          ))}
        </div>
      </td>
      <td data-testid={`bet-profit-${b.id}`} className={`py-3 px-4 text-right font-mono text-sm font-bold ${b.status === "pending" ? "text-slate-500" : p > 0 ? "text-emerald-400" : p < 0 ? "text-red-400" : "text-slate-300"}`}>
        {b.status === "pending" ? "Pending" : money(p)}
      </td>
      <td className="py-3 pl-2 pr-4">
        <button data-testid={`bet-delete-${b.id}`} onClick={() => onDelete(b)} title="Delete bet" className="text-slate-600 hover:text-red-400 transition-colors"><Trash2 className="h-4 w-4" /></button>
      </td>
    </tr>
  );
};

export default function BetTracker() {
  const [bets, setBets] = useState(null);
  const [stake, setStake] = useState(getStake());

  const load = useCallback(() => getBets().then(setBets).catch((e) => toast.error(errMsg(e))), []);
  useEffect(() => { load(); }, [load]);

  const onStake = (v) => { setStake(v); if (Number(v) > 0) localStorage.setItem(STAKE_KEY, String(Number(v))); };
  const onStatus = async (b, s) => {
    try {
      const nb = await setBetStatus(b.id, b.status === s ? "pending" : s);
      setBets((xs) => xs.map((x) => (x.id === nb.id ? nb : x)));
    } catch (e) { toast.error(errMsg(e)); }
  };
  const onDelete = async (b) => {
    try { await deleteBet(b.id); setBets((xs) => xs.filter((x) => x.id !== b.id)); toast.success("Bet deleted"); } catch (e) { toast.error(errMsg(e)); }
  };

  const s = useMemo(() => {
    const xs = bets || [];
    const settled = xs.filter((b) => b.status === "won" || b.status === "lost");
    const pl = settled.reduce((a, b) => a + profit(b), 0);
    const risked = settled.reduce((a, b) => a + b.stake, 0);
    const evs = xs.filter((b) => b.ev != null);
    return {
      n: xs.length, pending: xs.filter((b) => b.status === "pending").length, pl, roi: risked ? pl / risked : null,
      record: `${xs.filter((b) => b.status === "won").length}-${xs.filter((b) => b.status === "lost").length}`,
      ev: evs.length ? evs.reduce((a, b) => a + b.ev, 0) / evs.length : null,
    };
  }, [bets]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="flex items-center gap-3 font-display text-3xl sm:text-4xl font-bold tracking-tight">
            <ClipboardList className="h-8 w-8 text-emerald-400" /> Bet Tracker
          </h1>
          <p className="text-sm text-slate-400 mt-1">Every combo you add with + on the TD Scanner, locked at the Kalshi price and EV from the moment you added it.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-400">
          Stake per bet
          <span className="flex items-center h-9 rounded-lg border border-slate-700 bg-[#0E0E0E] px-2.5 focus-within:border-white/60">
            <span className="text-slate-500 font-mono">$</span>
            <input data-testid="bet-stake-input" type="number" min="1" value={stake} onChange={(e) => onStake(e.target.value)}
              className="w-20 bg-transparent outline-none font-mono text-sm font-semibold text-white pl-1" />
          </span>
        </label>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Bets" value={s.n} testid="bet-stat-count" />
        <Stat label="Record (W-L)" value={s.record} testid="bet-stat-record" />
        <Stat label="Pending" value={s.pending} testid="bet-stat-pending" />
        <Stat label="Profit" value={money(s.pl)} testid="bet-stat-profit" tone={s.pl > 0 ? "text-emerald-400" : s.pl < 0 ? "text-red-400" : "text-white"} />
        <Stat label="ROI · Avg EV" value={`${s.roi == null ? "—" : `${(s.roi * 100).toFixed(1)}%`} · ${s.ev == null ? "—" : `${(s.ev * 100).toFixed(1)}%`}`} testid="bet-stat-roi" />
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#181818] overflow-x-auto">
        <table data-testid="bet-table" className="w-full min-w-[1100px]">
          <thead>
            <tr className="text-xs text-slate-400">
              {["Added", "Bet", "Game", "Kalshi", "EV", "Stake", "To win", "Result", "Profit", ""].map((h, i) => (
                <th key={i} className={`py-3 px-4 font-semibold ${i < 3 ? "text-left" : "text-right"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(bets || []).map((b) => <BetRow key={b.id} b={b} onStatus={onStatus} onDelete={onDelete} />)}
          </tbody>
        </table>
        {bets && !bets.length && (
          <div data-testid="bet-empty" className="py-16 text-center text-sm text-slate-500">No bets tracked yet. Tap + next to a player on the TD Scanner to add one.</div>
        )}
      </div>
      <p className="text-xs text-slate-500">Profit uses the locked Kalshi price before fees. Tap a result again to set the bet back to pending.</p>
    </div>
  );
}
