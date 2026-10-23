import { useEffect, useState } from "react";
import "@/App.css";
import { Toaster } from "./components/ui/sonner";
import { Header } from "./components/Header";
import { SetupBanner } from "./components/SetupBanner";
import Scanner from "./pages/Scanner";
import Props from "./pages/Props";
import { getGames, getStatus, errMsg } from "./lib/api";

const DEFAULTS = { method: "mult", source: "blend", fees: true, minEv: 0, positiveOnly: false, sgpHold: 0, books: null, parlayHold: 15, singleHold: 5 };

const loadSettings = () => {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem("ev-settings") || "{}") };
  } catch {
    return DEFAULTS;
  }
};

function App() {
  const [tab, setTab] = useState("props");
  const [status, setStatus] = useState(null);
  const [games, setGames] = useState([]);
  const [gamesErr, setGamesErr] = useState(null);
  const [settings, setSettings] = useState(loadSettings);

  useEffect(() => {
    getStatus().then((s) => {
      setStatus(s);
      setSettings((p) => (p.books ? p : { ...p, books: s.default_books }));
    });
    getGames().then(setGames).catch((e) => setGamesErr(errMsg(e)));
  }, []);

  useEffect(() => localStorage.setItem("ev-settings", JSON.stringify(settings)), [settings]);

  const update = (patch) => setSettings((p) => ({ ...p, ...patch }));

  return (
    <div className="App grid-bg">
      <Header tab={tab} setTab={setTab} status={status} kalshiOk={!gamesErr && games.length > 0} />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {tab === "scanner" && status && !status.opticodds_key && <SetupBanner />}
        {gamesErr && (
          <div data-testid="kalshi-error" className="text-sm text-red-400 border border-red-900/60 bg-red-950/30 rounded px-4 py-3">
            Kalshi error: {gamesErr}
          </div>
        )}
        {tab === "props" ? (
          <Props settings={settings} update={update} />
        ) : (
          <Scanner games={games} status={status} settings={settings} update={update} />
        )}
      </main>
      <Toaster theme="dark" />
    </div>
  );
}

export default App;
