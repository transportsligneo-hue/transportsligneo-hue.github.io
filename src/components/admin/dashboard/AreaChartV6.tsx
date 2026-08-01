interface Props {
  /** 7 points (le plus ancien en premier) */
  data: { label: string; value: number }[];
}

/**
 * Courbe en aire SVG animée — "Demandes · 7 derniers jours".
 * Alimentée par les vraies données quotidiennes (aucun recalcul métier).
 */
export function AreaChartV6({ data }: Props) {
  const w = 640;
  const h = 190;
  const padL = 34;
  const padR = 14;
  const padT = 16;
  const padB = 28;
  const pts = data.length >= 2 ? data : [{ label: "", value: 0 }, { label: "", value: 0 }];
  const max = Math.max(1, ...pts.map((p) => p.value));
  const stepX = (w - padL - padR) / (pts.length - 1);
  const y = (v: number) => padT + (1 - v / max) * (h - padT - padB);
  const coords = pts.map((p, i) => ({ x: padL + i * stepX, y: y(p.value), ...p }));
  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
  const area = `${line} L ${coords[coords.length - 1].x.toFixed(1)} ${h - padB} L ${coords[0].x.toFixed(1)} ${h - padB} Z`;
  const gridVals = [0, max / 2, max];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 210 }} role="img" aria-label="Demandes des 7 derniers jours">
      <defs>
        <linearGradient id="a6AreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2f5fff" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#2f5fff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {gridVals.map((g, i) => (
        <g key={i}>
          <line x1={padL} x2={w - padR} y1={y(g)} y2={y(g)} stroke="#eff2f8" strokeWidth={1} />
          <text x={padL - 8} y={y(g) + 3.5} textAnchor="end" fontSize="9.5" fill="#9aa2ba" fontFamily="'Space Grotesk',sans-serif">
            {Math.round(g)}
          </text>
        </g>
      ))}

      <path d={area} fill="url(#a6AreaGrad)" className="a6-area-fill" />
      <path d={line} fill="none" stroke="#2f5fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className="a6-area-path" />

      {coords.map((c, i) => (
        <g key={i}>
          <circle cx={c.x} cy={c.y} r={4} fill="#fff" stroke="#2f5fff" strokeWidth={2.2} className="a6-area-dot" style={{ animationDelay: `${0.7 + i * 0.08}s` }}>
            <title>{`${c.label} · ${c.value} demande${c.value > 1 ? "s" : ""}`}</title>
          </circle>
          <text x={c.x} y={h - 8} textAnchor="middle" fontSize="9.5" fill="#9aa2ba" fontFamily="'Space Grotesk',sans-serif">
            {c.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
