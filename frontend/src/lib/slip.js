import { kalshiFee } from "./ev";

export const BOOKS = ["DraftKings", "FanDuel", "BetMGM", "Caesars", "Fanatics", "BetRivers", "theScore Bet"];
export const BOOK_COLORS = {
  DraftKings: "#22C55E", FanDuel: "#3B82F6", BetMGM: "#EAB308", Caesars: "#EC4899",
  Fanatics: "#F97316", BetRivers: "#06B6D4", "theScore Bet": "#A3E635",
};

export const americanToProb = (a) => {
  const n = Number(a);
  if (!a || Number.isNaN(n) || (n > -100 && n < 100)) return null;
  return n > 0 ? 100 / (n + 100) : -n / (-n + 100);
};

const power = (p1, p2) => {
  let lo = 0.5, hi = 10;
  for (let i = 0; i < 80; i++) {
    const k = (lo + hi) / 2;
    if (p1 ** k + p2 ** k > 1) lo = k;
    else hi = k;
  }
  return p1 ** ((lo + hi) / 2);
};

// Fair prob of the YES side, given implied yes/no probs. Worst-case = lowest of the three.
export const devig = (pYes, pNo, method) => {
  const s = pYes + pNo;
  if (s <= 1) return pYes / s;
  const vals = { mult: pYes / s, add: Math.max(pYes - (s - 1) / 2, 0.0001), power: power(pYes, pNo) };
  return method === "worst" ? Math.min(vals.mult, vals.add, vals.power) : vals[method];
};

// One-sided price (e.g. an SGP): assume the market's total hold to infer the other side.
export const devigOneSided = (pYes, holdPct, method) => devig(pYes, Math.max(1 + holdPct / 100 - pYes, 0.0001), method);

export const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

export const evPct = (fair, price, fees) => {
  if (fair == null || price == null || price <= 0 || price >= 1) return null;
  return fair / (price + (fees ? kalshiFee(price) : 0)) - 1;
};

export const legLabel = (l) => (l.threshold ? `${l.threshold}+ ${l.market}` : l.market);
export const legOver = (l) => (l.threshold ? `Over ${l.threshold - 0.5}` : "Yes");
