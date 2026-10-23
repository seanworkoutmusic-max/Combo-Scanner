import { useState } from "react";

const initials = (n = "") => n.split(" ").map((w) => w[0]).slice(0, 2).join("");

export const PlayerPhoto = ({ src, name, size = 32, testid }) => {
  const [broken, setBroken] = useState(false);
  return (
    <div
      data-testid={testid}
      className="shrink-0 overflow-hidden rounded-full border border-slate-700 bg-gradient-to-b from-slate-800 to-slate-950 grid place-items-center"
      style={{ width: size, height: size }}
    >
      {src && !broken ? (
        <img src={src} alt={name} onError={() => setBroken(true)} className="h-full w-full object-cover object-top scale-[1.35] translate-y-[12%]" />
      ) : (
        <span className="font-mono text-slate-400" style={{ fontSize: size * 0.34 }}>{initials(name)}</span>
      )}
    </div>
  );
};
