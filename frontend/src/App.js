import { useEffect, useState } from "react";
import "@/App.css";
import { Toaster } from "./components/ui/sonner";
import { Sidebar } from "./components/Sidebar";
import DDScanner from "./pages/DDScanner";
import LiveTracker from "./pages/LiveTracker";
import BetTracker from "./pages/BetTracker";
import SharedBets from "./pages/SharedBets";
import Results from "./pages/Results";
import Outliers from "./pages/Outliers";
import Injuries from "./pages/Injuries";
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

const PATH_TAB = { "/sean": "sean", "/kalshi": "scanner", "/parlay": "props", "/live": "live", "/bets": "bets", "/performance": "results", "/results": "results", "/outliers": "outliers", "/injuries": "injuries" };
const TAB_PATH = { scanner: "/kalshi", props: "/parlay", live: "/live", bets: "/bets", results: "/performance", outliers: "/outliers", injuries: "/injuries" };
const pathTab = () => PATH_TAB[window.location.pathname.replace(/\/+$/, "")];

function App() {
  const [tab, setTabState] = useState(() => pathTab() || "scanner");
  const setTab = (t) => {
    if (window.location.pathname !== TAB_PATH[t]) window.history.pushState({}, "", TAB_PATH[t]);
    setTabState(t);
  };
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

  useEffect(() => {
    if (!pathTab()) window.history.replaceState({}, "", "/kalshi");
    const onPop = () => setTabState(pathTab() || "scanner");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => localStorage.setItem("ev-settings", JSON.stringify(settings)), [settings]);

  const update = (patch) => setSettings((p) => ({ ...p, ...patch }));

  return (
    <div className="App min-h-screen bg-[#121212]">
      <Sidebar tab={tab} setTab={setTab} kalshiOk={!gamesErr && games.length > 0} />
      <main className={`lg:pl-16 min-[1440px]:pl-56 min-h-screen ${["scanner", "live", "bets"].includes(tab) ? "dot-grid" : ""}`}>
        <div className={`max-w-[1320px] ${tab === "scanner" ? "" : "mx-auto"} px-4 sm:px-6 2xl:px-10 py-6 lg:py-8 space-y-5`}>
          {tab === "props" ? (
            <Props settings={settings} update={update} status={status} />
          ) : tab === "live" ? (
            <LiveTracker />
          ) : tab === "bets" ? (
            <BetTracker />
          ) : tab === "sean" ? (
            <SharedBets />
          ) : tab === "results" ? (
            <Results />
          ) : tab === "outliers" ? (
            <Outliers />
          ) : tab === "injuries" ? (
            <Injuries settings={settings} />
          ) : (
            <DDScanner settings={settings} />
          )}
        </div>
      </main>
      <Toaster theme="dark" />
    </div>
  );
}

export default App;
