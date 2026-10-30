import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { getPropsGames, getPropsGame, getPropsPlayers, postSlip, postKalshiQuote, errMsg } from "../lib/api";
import { MarketList } from "../components/props/MarketList";
import { BetSlip } from "../components/props/BetSlip";
import { PlayerPhoto } from "../components/props/PlayerPhoto";
import { GameLabel } from "../components/props/TeamLogo";

const useStored = (key, init) => {
  const [v, setV] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key)) ?? init; } catch { return init; }
  });
  useEffect(() => localStorage.setItem(key, JSON.stringify(v)), [key, v]);
  return [v, setV];
};

// Quote size matches the Kalshi app's "$10 pays" view; makers quote worse prices for big orders.
const QUOTE_SIZE = 10;

const GameStrip = ({ games, game, setGame }) => (
  <div data-testid="game-strip" className="flex gap-2 overflow-x-auto pb-1">
    {games.map((g) => (
      <button key={g.code} data-testid={`game-chip-${g.code}`} onClick={() => setGame(g.code)}
        className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono text-xs transition-colors ${game === g.code ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-200" : "border-slate-800 text-slate-400 hover:text-slate-100"}`}>
        <GameLabel code={g.code} /> <span className="text-slate-500">· {g.date.slice(5)}</span>
      </button>
    ))}
  </div>
);

const norm = (s) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const PlayerList = ({ players, allPlayers, player, onPick }) => {
  const [q, setQ] = useState("");
  const nq = norm(q).trim();
  const shown = nq ? allPlayers.filter((p) => norm(p.name).includes(nq) || p.key.includes(nq)) : players;
  return (
    <div className="rounded-xl border border-slate-800 bg-[#181818]/80">
      <div className="flex items-center gap-2 px-3 border-b border-slate-800">
        <Search className="h-3.5 w-3.5 text-slate-500" />
        <input data-testid="player-search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search any player"
          className="w-full h-10 bg-transparent text-sm outline-none placeholder:text-slate-600" />
      </div>
      <div className="max-h-[260px] lg:max-h-[640px] overflow-y-auto">
        {nq && !shown.length && <div className="px-3 py-4 text-xs text-slate-500">No Kalshi lines for "{q}" right now.</div>}
        {shown.map((p) => (
          <button key={`${p.game || ""}-${p.key}`} data-testid={`player-item-${p.key.replace(/\s/g, "-")}`} onClick={() => { onPick(p); setQ(""); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${player === p.key ? "bg-cyan-400/10 text-cyan-100" : "text-slate-300 hover:bg-slate-800/30"}`}>
            <PlayerPhoto src={p.headshot} name={p.name} size={30} />
            <span className="flex-1 truncate">{p.name}</span>
            <span className="text-[10px] font-mono text-slate-500">{nq ? p.game_label : p.team}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default function Props({ settings, update, status }) {
  const [games, setGames] = useState([]);
  const [game, setGame] = useState(null);
  const [data, setData] = useState(null);
  const [player, setPlayer] = useState(null);
  const [legs, setLegs] = useStored("slip-legs", []);
  const [mode, setMode] = useStored("slip-mode", "parlay");
  const format = settings.fees ? "fee" : "raw";
  const [combo, setCombo] = useState(null);
  const [live, setLive] = useState(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [parlayOdds, setParlayOdds] = useState({});
  const [straightOdds, setStraightOdds] = useState({});
  const [allPlayers, setAllPlayers] = useState([]);
  const pending = useRef(null);

  useEffect(() => {
    getPropsGames().then((g) => { setGames(g); if (g.length) setGame(g[0].code); }).catch((e) => toast.error(errMsg(e)));
    getPropsPlayers().then(setAllPlayers).catch(() => {});
  }, []);

  useEffect(() => {
    if (!game) return;
    getPropsGame(game).then((d) => {
      setData(d);
      const want = pending.current && d.players.find((p) => p.key === pending.current);
      pending.current = null;
      setPlayer(want ? want.key : d.players[0]?.key || null);
    }).catch((e) => toast.error(errMsg(e)));
  }, [game]);

  const pickPlayer = (p) => {
    if (!p.game || p.game === game) return setPlayer(p.key);
    pending.current = p.key;
    setGame(p.game);
  };

  const tickers = legs.map((l) => l.ticker).join(",");
  const refreshSlip = useCallback(async () => {
    if (!tickers) return setCombo(null);
    try {
      const r = await postSlip(tickers.split(","));
      setCombo(r.combo);
      setLegs((prev) => prev.map((l, i) => (r.legs[i] ? { ...l, ...r.legs[i] } : l)));
    } catch (e) { /* keep last prices */ }
  }, [tickers, setLegs]);

  useEffect(() => {
    refreshSlip();
    setParlayOdds({});
    setLive(null);
    const auto = status?.kalshi_key && legs.length >= 2 ? setTimeout(getLiveQuote, 800) : null;
    const t = setInterval(refreshSlip, 30000);
    return () => { clearInterval(t); clearTimeout(auto); };
  }, [tickers, status?.kalshi_key]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = useMemo(() => data?.players.find((p) => p.key === player), [data, player]);
  const selected = useMemo(() => new Set(legs.map((l) => l.ticker)), [legs]);

  const toggle = (line) => {
    if (selected.has(line.ticker)) return setLegs(legs.filter((l) => l.ticker !== line.ticker));
    const same = legs.find((l) => l.player === current.name && l.market === line.market);
    if (same) toast.info(`Replaced ${same.threshold ? `${same.threshold}+` : ""} ${line.market}: lines in the same market overlap`);
    else toast.success(`Added ${current.name} ${line.threshold ? `${line.threshold}+ ` : ""}${line.market}`, { duration: 1500 });
    setLegs([...legs.filter((l) => l !== same), { ...line, player: current.name, team: current.team, headshot: current.headshot }]);
  };
  const remove = (t) => setLegs(legs.filter((l) => l.ticker !== t));

  const getLiveQuote = async () => {
    const sent = legs.map((l) => l.ticker);
    setLiveLoading(true);
    try {
      const r = await postKalshiQuote(sent, QUOTE_SIZE);
      const now = JSON.parse(localStorage.getItem("slip-legs") || "[]").map((l) => l.ticker);
      if (now.join(",") !== sent.join(",")) return;
      setLive(r);
      if (!r.yes_price) toast.info("No Kalshi market maker quoted this combo right now");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLiveLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <GameStrip games={games} game={game} setGame={setGame} />
      <div className="grid gap-5 lg:grid-cols-[180px_minmax(0,1fr)_320px] xl:grid-cols-[200px_minmax(0,1fr)_360px] 2xl:grid-cols-[220px_minmax(0,1fr)_400px]">
        <PlayerList players={data?.players || []} allPlayers={allPlayers} player={player} onPick={pickPlayer} />
        <section className="min-w-0">
          <div className="flex items-end justify-between gap-3 border-b border-slate-800 pb-3 mb-1">
            <div className="flex items-center gap-4 min-w-0">
              <PlayerPhoto src={current?.headshot} name={current?.name} size={72} testid="player-photo-heading" />
              <div className="min-w-0">
                <h1 data-testid="player-name-heading" className="font-display text-3xl 2xl:text-4xl font-bold tracking-tight truncate">
                  {current?.name || "—"}
                </h1>
                <div className="text-xs font-mono text-slate-500 mt-1">{current ? `${current.team} · ${data.game.label} · ${data.game.date}` : ""}</div>
              </div>
            </div>
          </div>
          {current ? <MarketList player={current} selected={selected} onToggle={toggle} format={format} /> :
            <div className="py-16 text-center text-sm text-slate-500">{games.length ? "Loading…" : "No open Kalshi NBA player props right now."}</div>}
        </section>
        <BetSlip
          legs={legs} mode={mode} setMode={setMode} combo={combo}
          parlayOdds={parlayOdds} setParlayOdds={(b, v) => setParlayOdds((o) => ({ ...o, [b]: v }))}
          straightOdds={straightOdds} setStraightOdds={(t, b, v) => setStraightOdds((o) => ({ ...o, [t]: { ...o[t], [b]: v } }))}
          settings={settings} update={update} format={format} remove={remove} clear={() => setLegs([])}
          live={live} onLiveQuote={getLiveQuote} liveLoading={liveLoading} kalshiKey={status?.kalshi_key}
          quoteSize={QUOTE_SIZE}
        />
      </div>
    </div>
  );
}
