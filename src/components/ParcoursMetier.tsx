import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { User, KeyRound, Truck, BarChart3, ArrowRight } from "lucide-react";
import { EUROPE_PATHS } from "@/lib/europe-paths";
import "@/styles-parcours.css";
import franceImg from "@/assets/france-ligneo.png";

/** Carte France + Europe animée et parcours par métier (accueil). */

// Position de l'image de France dans le repère de la carte Ligneo
const S = 40.2 / 1037;
const IX = 461.5 - 108 * S;
const IY = 296.4 - 117 * S;
const IW = 1254 * S;
const HX = 478.63; // pointe du pin = Tours
const HY = 314.2;

const CITIES: Record<string, [number, number]> = {
  Paris: [483.88, 306.43], Lille: [482, 297.6], Rennes: [471.61, 309.79], Nantes: [472.01, 313.77],
  Bordeaux: [474.96, 324.43], Toulouse: [481.11, 329.98], Lyon: [491.5, 320.31], Marseille: [492, 329],
  Strasbourg: [495, 307.5],
};
const EU: Record<string, [number, number]> = {
  Belgique: [487.37, 298.99], Allemagne: [504.19, 295.33], Suisse: [497.94, 314.67],
  Italie: [510.14, 333.16], Espagne: [465, 336],
};
const SEGS = [
  { key: "Particulier", d: "Faire transporter mon véhicule simplement et en toute sécurité.", Icon: User, to: "/services" as const,
    cities: [...Object.keys(CITIES), ...Object.keys(EU)] },
  { key: "Concessionnaire", d: "Déplacez vos véhicules entre concessions, ateliers et clients.", Icon: KeyRound, to: "/concessionnaires" as const,
    cities: ["Paris", "Lille", "Lyon", "Strasbourg", "Rennes", "Nantes"] },
  { key: "Loueur", d: "Automatisez les rotations de véhicules entre agences.", Icon: Truck, to: "/loueurs" as const,
    cities: ["Marseille", "Lyon", "Bordeaux", "Toulouse", "Paris"] },
  { key: "Gestionnaire de flotte", d: "Une vision centralisée de tous vos mouvements de véhicules.", Icon: BarChart3, to: "/gestionnaires-flotte" as const,
    cities: [...Object.keys(CITIES), ...Object.keys(EU)] },
];

function curve(x: number, y: number, k: number) {
  const mx = (HX + x) / 2, my = (HY + y) / 2, dx = x - HX, dy = y - HY;
  const L = Math.hypot(dx, dy), c = 0.16 * L * (k % 2 ? 1 : -1);
  return `M${HX},${HY} Q${(mx + (-dy / L) * c).toFixed(2)},${(my + (dx / L) * c).toFixed(2)} ${x},${y}`;
}


/** Carte France + Europe animée. `focus` = index du métier mis en avant (sinon toutes les routes). */
export function CarteEurope({ focus }: { focus?: number }) {
  const points = useMemo(
    () => [
      ...Object.entries(CITIES).map(([n, p]) => ({ n, p, eu: false })),
      ...Object.entries(EU).map(([n, p]) => ({ n, p, eu: true })),
    ].map((o, k) => ({ ...o, k, d: curve(o.p[0], o.p[1], k), segs: SEGS.map((sg, i) => (sg.cities.includes(o.n) ? i : -1)).filter((i) => i >= 0).join(" ") })),
    [],
  );
  return (
    <svg className="mx-svg" data-f={focus} viewBox="433 270 90 68.3" xmlns="http://www.w3.org/2000/svg" role="img"
      aria-label="Carte de France et d'Europe : Tours, base opérationnelle, relie les grandes villes françaises et les pays voisins">
      <defs>
        <pattern id="mxg" width="3" height="3" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="0.14" fill="rgba(140,175,255,.28)" /></pattern>
        <radialGradient id="mxfade" cx="50%" cy="52%" r="62%"><stop offset="55%" stopColor="#fff" /><stop offset="100%" stopColor="#000" /></radialGradient>
        <mask id="mxm"><rect x="433" y="270" width="90" height="68.3" fill="url(#mxfade)" /></mask>
        <linearGradient id="mxscan" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor="#4f8cff" stopOpacity="0" /><stop offset=".5" stopColor="#7aa3ff" stopOpacity=".16" /><stop offset="1" stopColor="#4f8cff" stopOpacity="0" /></linearGradient>
      </defs>
      <g mask="url(#mxm)">
        <rect x="433" y="270" width="90" height="68.3" fill="url(#mxg)" />
        <g>{EUROPE_PATHS.map((d, i) => <path key={i} d={d} className="mx-c" />)}</g>
        <rect className="mx-scan" x="433" y="270" width="18" height="68.3" fill="url(#mxscan)" />
      </g>
      <image href={franceImg} x={IX} y={IY} width={IW} height={IW} className="mx-fr" style={{ filter: "drop-shadow(0 0 1.2px rgba(79,140,255,.65))" }} />
      {points.map(({ n, d, eu, k, segs }) => (
        <g key={`r-${n}`} className="mx-route" data-segs={segs}>
          <path className={`mx-r ${eu ? "mx-eu-r" : "mx-fr-r"}`} d={d} />
          <path className={`mx-flow${eu ? " mx-flow-eu" : ""}`} d={d} style={{ animationDelay: `-${((k * 0.37) % 3).toFixed(2)}s` }} />
        </g>
      ))}
      {points.map(({ n, d, eu, k, segs }) => (
        <g key={`t-${n}`} className="mx-trv" data-segs={segs}>
          <circle r={eu ? 0.5 : 0.6} className={`mx-dot-trv${eu ? " eu" : ""}`}>
            <animateMotion dur={`${(5.2 + ((k * 0.63) % 4.5)).toFixed(1)}s`} begin={`-${((k * 0.9) % 5).toFixed(1)}s`} repeatCount="indefinite"
              calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1" path={d} />
          </circle>
        </g>
      ))}
      {points.map(({ n, p, eu, k, segs }) => (
        <g key={`c-${n}`} className={`mx-city${eu ? " eu" : ""}`} data-segs={segs}>
          <circle cx={p[0]} cy={p[1]} r="1.7" className="mx-halo" style={{ animationDelay: `${((k * 0.23) % 2).toFixed(2)}s` }} />
          <circle cx={p[0]} cy={p[1]} r="0.62" className="mx-pt" />
        </g>
      ))}
      <g>
        <circle cx={HX} cy={HY} r="1" className="mx-ring" />
        <circle cx={HX} cy={HY} r="1" className="mx-ring r2" />
        <circle cx={HX} cy={HY} r="0.75" className="mx-hubdot" />
      </g>
      {points.map(({ n, p, eu, segs }) => {
        const left = ["Rennes", "Nantes", "Espagne", "Bordeaux"].includes(n);
        return (
          <text key={`l-${n}`} x={p[0] + (left ? -0.95 : 0.95)} y={p[1] + 0.6} textAnchor={left ? "end" : "start"}
            className={`mx-lbl${eu ? " eu" : ""}`} data-segs={segs}>{n}</text>
        );
      })}
      <text x={HX} y={HY + 3.4} textAnchor="middle" className="mx-hubl">TOURS</text>
    </svg>
  );
}

/** Carte seule (pages Particuliers / Professionnels). */
export function CarteEuropeSolo() {
  return (
    <div className="mx-map mx-map--solo">
      <div className="mx-chip"><span className="live" /><b>Tours</b> · base opérationnelle</div>
      <CarteEurope />
      <div className="mx-legend"><span><i className="b" />France</span><span><i className="g" />Europe</span></div>
    </div>
  );
}

export default function ParcoursMetier() {
  const [cur, setCur] = useState(0);
  const [hover, setHover] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (hover) return;
    timer.current = window.setInterval(() => setCur((c) => (c + 1) % SEGS.length), 5000);
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, [hover]);

  return (
    <div className="mx-panel" data-hover={hover ? "1" : undefined}>
      <div className="mx-list" onMouseLeave={() => setHover(false)}>
        {SEGS.map(({ key, d, Icon, to }, i) => (
          <Link
            key={key}
            to={to}
            {...(key === "Particulier" ? { search: { audience: "particuliers" } as never } : {})}
            className={`mx-card${cur === i ? " on" : ""}`}
            onMouseEnter={() => { setHover(true); setCur(i); }}
            onFocus={() => setCur(i)}
          >
            <span className="mx-ic"><Icon size={22} /></span>
            <span className="mx-tx"><b>{key}</b><span>{d}</span></span>
            <span className="mx-go"><ArrowRight size={16} /></span>
            <i className="mx-bar" />
          </Link>
        ))}
      </div>

      <div className="mx-map">
        <div className="mx-chip"><span className="live" /><b>Tours</b> · base opérationnelle</div>
        <div className="mx-active">{SEGS[cur].key}</div>
        <CarteEurope focus={cur} />
        <div className="mx-legend"><span><i className="b" />France</span><span><i className="g" />Europe</span></div>
      </div>
    </div>
  );
}
