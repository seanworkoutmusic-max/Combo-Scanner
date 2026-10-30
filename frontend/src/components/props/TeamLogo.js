const ESPN = { GSW: "gs", NOP: "no", NYK: "ny", SAS: "sa", UTA: "utah", WAS: "wsh" };

export const TeamLogo = ({ team, size = 16 }) => (
  <img
    src={`https://a.espncdn.com/i/teamlogos/nba/500-dark/${ESPN[team] || team.toLowerCase()}.png`}
    alt=""
    width={size}
    height={size}
    loading="lazy"
    className="inline-block object-contain shrink-0"
    onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
  />
);

// "26OCT29CLEATL" -> CLE vs ATL with logos
export const GameLabel = ({ code, size }) => {
  const away = code.slice(-6, -3);
  const home = code.slice(-3);
  return (
    <span className="inline-flex items-center gap-1.5">
      <TeamLogo team={away} size={size} />{away}
      <span className="text-slate-500 font-normal">vs</span>
      <TeamLogo team={home} size={size} />{home}
    </span>
  );
};
