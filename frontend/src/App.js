import { useEffect, useState } from "react";
import "@/App.css";
import { Toaster } from "./components/ui/sonner";
import { Sidebar } from "./components/Sidebar";
import DDScanner from "./pages/DDScanner";
import TDWatch from "./pages/TDWatch";
import LiveTracker from "./pages/LiveTracker";
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
    <div className="App min-h-screen bg-[#121212]">
      <Sidebar tab={tab} setTab={setTab} kalshiOk={!gamesErr && games.length > 0} />
      <main className="lg:pl-16 min-[1440px]:pl-56">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 2xl:px-10 py-6 lg:py-8 space-y-5">
          {tab === "props" ? (
            <Props settings={settings} update={update} status={status} />
          ) : tab === "tdwatch" ? (
            <TDWatch />
          ) : tab === "live" ? (
            <LiveTracker />
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
