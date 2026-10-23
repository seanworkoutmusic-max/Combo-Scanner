import { useEffect, useState } from "react";
import "@/App.css";
import { Toaster } from "./components/ui/sonner";
import { Header } from "./components/Header";
import DDScanner from "./pages/DDScanner";
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
        {tab === "props" ? (
          <Props settings={settings} update={update} status={status} />
        ) : (
          <DDScanner settings={settings} />
        )}
      </main>
      <Toaster theme="dark" />
    </div>
  );
}

export default App;
