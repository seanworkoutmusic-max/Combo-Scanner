import { useEffect, useMemo, useState } from "react";
import { PageTitle } from "../components/TopBar";
import { getBets, gradeBets } from "../lib/api";
import { PlayerPhoto } from "../components/props/PlayerPhoto";
import { GameLabel } from "../components/props/TeamLogo";
import { PriceTag } from "../components/props/MarketList";
import { LegProgress, Stat, STATUS_LABEL } from "./BetTracker";

const TONE = { won: "text-emerald-400", lost: "text-red-400", void: "text-slate-400", pending: "text-slate-500" };

const Row = ({ b, live }) => (
  <tr data-testid={`shared-bet-row-${b.id}`} className="border-t border-slate-800/70 hover:bg-white/[0.03] transition-colors">
    <td className="py-3 px-4 text-xs font-mono text-slate-500 whitespace-nowrap">{new Date(b.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</td>
    <td className="py-3 px-4">
      <div className="flex items-center gap-3">
        <PlayerPhoto src={b.headshot} name={b.player} size={32} />
        <div className="leading-tight">
          <div className="text-sm font-semibold text-white whitespace-nowrap">{b.player}</div>
          <div className="text-[11px] font-mono text-slate-400">{b.combo}</div>
          <LegProgress b={b} live={live} />
        </div>
      </div>
    </td>
    <td className="py-3 px-4 text-sm font-semibold text-slate-300 whitespace-nowrap"><GameLabel code={b.game_code} size={15} /></td>
    <td data-testid={`shared-bet-price-${b.id}`} className="py-3 px-4 text-right font-mono text-sm font-bold text-white"><PriceTag p={b.price} format="raw" /></td>
    <td className={`py-3 px-4 text-right font-mono text-sm font-bold ${b.ev > 0 ? "text-emerald-400" : "text-red-400"}`}>{b.ev == null ? "—" : `${b.ev > 0 ? "+" : ""}${(b.ev * 100).toFixed(1)}%`}</td>
    <td data-testid={`shared-bet-result-${b.id}`} className={`py-3 px-4 text-right font-mono text-sm font-bold ${TONE[b.status]}`}>{STATUS_LABEL[b.status] || "Pending"}</td>
  </tr>
);

// Read-only, shareable view of today's tracked bets (no stakes or profit).
export default function SharedBets() {
  const [bets, setBets] = useState(null);
  const [live, setLive] = useState({});
  useEffect(() => {
    gradeBets().catch(() => null).then((g) => { setLive(g?.live || {}); return getBets(); }).then(setBets).catch(() => setBets([]));
  }, []);

  const s = useMemo(() => {
    const xs = bets || [];
    const evs = xs.filter((b) => b.ev != null);
    return {
      n: xs.length, pending: xs.filter((b) => b.status === "pending").length,
      record: `${xs.filter((b) => b.status === "won").length}-${xs.filter((b) => b.status === "lost").length}`,
      ev: evs.length ? evs.reduce((a, b) => a + b.ev, 0) / evs.length : null,
    };
  }, [bets]);
  const day = new Date(Date.now() - 6 * 3600e3).toLocaleDateString("en-US", { timeZone: "America/New_York", weekday: "long", month: "long", day: "numeric" });

  return (
    <div data-testid="shared-bets-page" className="space-y-6">
      <div>
        <PageTitle eyebrow="Shared" testid="shared-bets-title">Sean's Plays</PageTitle>
        <p data-testid="shared-bets-date" className="text-sm text-slate-400 mt-3">{day} · Kalshi combos, graded from ESPN box scores</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Plays" value={s.n} testid="shared-stat-count" />
        <Stat label="Record (W-L)" value={s.record} testid="shared-stat-record" />
        <Stat label="Pending" value={s.pending} testid="shared-stat-pending" />
        <Stat label="Avg EV" value={s.ev == null ? "—" : `${(s.ev * 100).toFixed(1)}%`} testid="shared-stat-ev" />
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#121212] overflow-x-auto">
        <table data-testid="shared-bet-table" className="w-full min-w-[760px]">
          <thead>
            <tr className="text-xs text-slate-400">
              {["Added", "Play", "Game", "Kalshi", "EV", "Result"].map((h, i) => (
                <th key={h} className={`py-3 px-4 font-semibold ${i < 3 ? "text-left" : "text-right"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>{(bets || []).map((b) => <Row key={b.id} b={b} live={live[b.id]} />)}</tbody>
        </table>
        {!bets && <div data-testid="shared-bets-loading" className="py-16 text-center text-sm text-slate-500">Loading today's plays…</div>}
        {bets && !bets.length && <div data-testid="shared-bets-empty" className="py-16 text-center text-sm text-slate-500">No plays tracked yet today. Check back soon.</div>}
      </div>
    </div>
  );
}
