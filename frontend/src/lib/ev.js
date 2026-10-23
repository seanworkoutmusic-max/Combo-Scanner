export const METHODS = [
  { id: "mult", label: "Multiplicative" },
  { id: "add", label: "Additive" },
  { id: "power", label: "Power" },
  { id: "worst", label: "Worst-case" },
];

export const SOURCES = [
  { id: "sgp", label: "SGP" },
  { id: "direct", label: "Direct" },
  { id: "blend", label: "Blend" },
];

export const kalshiFee = (p) => 0.07 * p * (1 - p);

export const probToAmerican = (p) => {
  if (!p || p <= 0 || p >= 1) return null;
  return p >= 0.5 ? Math.round((-100 * p) / (1 - p)) : Math.round((100 * (1 - p)) / p);
};

export const fmtAmerican = (a) => (a == null ? "—" : a > 0 ? `+${a}` : `${a}`);
export const fmtPct = (p, d = 1) => (p == null || Number.isNaN(p) ? "—" : `${(p * 100).toFixed(d)}%`);
export const fmtCents = (p) => (p == null ? "—" : `${Math.round(p * 100)}¢`);

// Returns {yes, no} fair probs for one per-method object
const pick = (m, method, holdDiv = 1) => {
  if (!m) return null;
  if (method === "worst") {
    const vals = [m.mult, m.add, m.power];
    return { yes: Math.min(...vals) / holdDiv, no: 1 - Math.max(...vals) / holdDiv };
  }
  const y = m[method] / holdDiv;
  return { yes: y, no: 1 - y };
};

export const bookEstimates = (books, kind, method, source, sgpHold) => {
  const div = 1 + (sgpHold || 0) / 100;
  const out = [];
  (books || []).forEach((b) => {
    const k = b[kind] || {};
    if ((source === "sgp" || source === "blend") && k.sgp) out.push({ book: b.book, src: "SGP", ...pick(k.sgp, method, div) });
    if ((source === "direct" || source === "blend") && k.direct) out.push({ book: b.book, src: "Direct", ...pick(k.direct, method) });
  });
  return out;
};

const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

export const evaluate = (market, ests, includeFees) => {
  const fairYes = avg(ests.map((e) => e.yes));
  const fairNo = avg(ests.map((e) => e.no));
  const ev = (fair, price) => {
    if (fair == null || price == null || price <= 0 || price >= 1) return null;
    const cost = price + (includeFees ? kalshiFee(price) : 0);
    return fair / cost - 1;
  };
  return {
    fairYes,
    fairNo,
    evYes: ev(fairYes, market?.yes_ask),
    evNo: ev(fairNo, market?.no_ask),
    n: ests.length,
    srcs: [...new Set(ests.map((e) => e.src))],
  };
};
