import { useEffect, useState } from "react";
import "@/App.css";
import { Toaster } from "./components/ui/sonner";
import { Sidebar, TABS } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import DDScanner from "./pages/DDScanner";
import LiveTracker from "./pages/LiveTracker";
import BetTracker from "./pages/BetTracker";
import SharedBets from "./pages/SharedBets";
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
  const [tab, setTabState] = useState(window.location.pathname.replace(/\/+$/, "") === "/sean" ? "sean" : "props");
  const setTab = (t) => {
    if (window.location.pathname !== "/") window.history.pushState({}, "", "/");
    setTabState(t);
  };
  const [status, setStatus] = useState(null);
  const [games, setGames] = useState([]);
  const [gamesErr, setGamesErr] = useState(null);
  const [settings, setSettings] = useState(loadSettings);
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    getStatus().then((s) => {
      setStatus(s);
      setSettings((p) => (p.books ? p : { ...p, books: s.default_books }));
    });
    getGames().then(setGames).catch((e) => setGamesErr(errMsg(e)));
  }, []);

  useEffect(() => {
    const onPop = () => { if (window.location.pathname.replace(/\/+$/, "") === "/sean") setTabState("sean"); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => localStorage.setItem("ev-settings", JSON.stringify(settings)), [settings]);

  const update = (patch) => setSettings((p) => ({ ...p, ...patch }));

  return (
    <div className="App min-h-screen bg-[#0A0A0A]">
      <Sidebar tab={tab} setTab={setTab} />
      <main className="lg:pl-16">
        <TopBar crumb={(TABS.find((t) => t.id === tab) || { crumb: ["shared", "sean"] }).crumb} kalshiOk={!gamesErr && games.length > 0} updatedAt={updatedAt} />
        <div className="max-w-[1180px] mx-auto px-4 sm:px-6 2xl:px-10 py-6 lg:py-12 space-y-5">
          {tab === "props" ? (
            <Props settings={settings} update={update} status={status} />
          ) : tab === "live" ? (
            <LiveTracker />
          ) : tab === "bets" ? (
            <BetTracker />
          ) : tab === "sean" ? (
            <SharedBets />
          ) : (
            <DDScanner settings={settings} onUpdated={setUpdatedAt} />
          )}
        </div>
      </main>
      <Toaster theme="dark" />
    </div>
  );
}

export default App;
