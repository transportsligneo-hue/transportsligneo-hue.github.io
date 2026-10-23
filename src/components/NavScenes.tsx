import logoDriver from "@/assets/logo-driver.png.asset.json";

/**
 * Mini-scènes animées (≈3 s) de l'annonce de la navbar : elles reprennent les vrais éléments du site
 * (devis, facture, appli convoyeur, carte de suivi, code de livraison, LinkedIn, API).
 * Chaque scène est relancée à chaque changement d'annonce (clé React côté parent).
 */
export const SCENE_KINDS = ["quote", "invoice", "driver", "wheel", "gps", "code", "linkedin", "api"] as const;
export type SceneKind = (typeof SCENE_KINDS)[number];
export const isScene = (k: string): k is SceneKind => (SCENE_KINDS as readonly string[]).includes(k);

const MONO = "'IBM Plex Mono',monospace";
const SANS = "Poppins,sans-serif";

const MINI_CAR = (
  <svg viewBox="0 0 22 12" width="15" height="8" aria-hidden="true">
    <path d="M2 8.5V6.2c0-.7.4-1.3 1-1.5l3-1.2C7 3 7.8 2 9 2h4c1.2 0 2 .6 2.7 1.5L18 5l2 .6c.6.2 1 .7 1 1.4v1.5c0 .5-.4 1-1 1H2.8c-.4 0-.8-.4-.8-.8z" fill="#2f5fff" stroke="#fff" strokeWidth="1" />
    <path d="m7.5 3.6 1-1h3.6l1.6 1.4z" fill="#dbe8ff" />
    <circle cx="6" cy="9.4" r="1.9" fill="#0b1a4d" stroke="#fff" strokeWidth="1" />
    <circle cx="16" cy="9.4" r="1.9" fill="#0b1a4d" stroke="#fff" strokeWidth="1" />
  </svg>
);

export function Scene({ kind }: { kind: SceneKind }) {
  switch (kind) {
    case "quote":
      return (
        <svg className="tns" viewBox="0 0 86 56" width="86" height="56" aria-hidden="true">
          <g className="tns-pop">
            <rect x="6" y="3" width="50" height="50" rx="5" fill="#fff" />
            <rect x="6" y="3" width="50" height="11" rx="5" fill="#2f5fff" />
            <rect x="6" y="9" width="50" height="5" fill="#2f5fff" />
            <text x="12" y="11.4" fontSize="6" fontWeight="800" fill="#fff" fontFamily={SANS} letterSpacing=".6">DEVIS</text>
            <text x="50" y="11.2" textAnchor="end" fontSize="4" fontWeight="700" fill="#cfe0ff" fontFamily={MONO}>N° 2041</text>
          </g>
          <g className="tns-rise tns-d1">
            <circle cx="13" cy="21" r="2" fill="#22c55e" />
            <rect x="19" y="19.8" width="26" height="2.4" rx="1.2" fill="#cbd5e1" />
            <path d="M13 23v5" stroke="#94a3b8" strokeWidth="1" strokeDasharray="1.2 1.2" />
            <circle cx="13" cy="30" r="2" fill="#2f5fff" />
            <rect x="19" y="28.8" width="20" height="2.4" rx="1.2" fill="#cbd5e1" />
          </g>
          <rect className="tns-rise tns-d2" x="11" y="35" width="40" height="13" rx="3.5" fill="#eff6ff" />
          <text className="tns-fade tns-d2" x="14" y="43" fontSize="3.4" fontWeight="700" fill="#64748b" fontFamily={SANS}>TOTAL</text>
          <text className="tns-price" x="49" y="44" textAnchor="end" fontSize="7" fontWeight="800" fill="#0b1a4d" fontFamily={MONO}>384 €</text>
          <g className="tns-stamp tns-d4">
            <circle cx="64" cy="36" r="9.5" fill="#22c55e" stroke="#fff" strokeWidth="2" />
            <path d="m59.4 36.2 3.2 3.2 6-6.6" stroke="#fff" strokeWidth="2.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </g>
          <g className="tns-fade tns-d3">
            <rect x="60" y="8" width="24" height="10" rx="5" fill="rgba(255,255,255,.16)" stroke="rgba(255,255,255,.4)" strokeWidth=".8" />
            <text x="72" y="15.2" textAnchor="middle" fontSize="5" fontWeight="800" fill="#fff" fontFamily={SANS}>2 min</text>
          </g>
        </svg>
      );
    case "invoice":
      return (
        <svg className="tns" viewBox="0 0 86 56" width="86" height="56" aria-hidden="true">
          <g className="tns-pop">
            <path d="M12 2h40l7 7v42l-4.7-3-4.8 3-4.8-3-4.8 3-4.8-3-4.8 3-4.8-3L12 51z" fill="#fff" />
            <path d="M52 2v7h7z" fill="#e2e8f0" />
            <rect x="17" y="7" width="19" height="7" rx="1.8" fill="#0b1a4d" />
            <text x="26.5" y="12.2" textAnchor="middle" fontSize="4" fontWeight="800" fill="#fff" fontFamily={SANS} letterSpacing=".2">LIGNEO</text>
            <text x="54" y="12" textAnchor="end" fontSize="3.5" fontWeight="700" fill="#64748b" fontFamily={SANS}>FACTURE</text>
          </g>
          <g className="tns-rise tns-d1"><rect x="17" y="19" width="36" height="2.2" rx="1.1" fill="#cbd5e1" /></g>
          <g className="tns-rise tns-d2"><rect x="17" y="24" width="36" height="2.2" rx="1.1" fill="#e2e8f0" /></g>
          <g className="tns-rise tns-d3"><rect x="17" y="29" width="25" height="2.2" rx="1.1" fill="#e2e8f0" /></g>
          <rect className="tns-rise tns-d3" x="17" y="35" width="36" height="11" rx="3" fill="#eff6ff" />
          <text className="tns-fade tns-d3" x="19.5" y="42" fontSize="3.4" fontWeight="700" fill="#475569" fontFamily={SANS}>TOTAL</text>
          <text className="tns-fade tns-d3" x="51" y="42.4" textAnchor="end" fontSize="4.4" fontWeight="800" fill="#0b1a4d" fontFamily={MONO}>144,00 €</text>
          <g className="tns-slam tns-d4">
            <rect x="46" y="21" width="31" height="13" rx="3" fill="rgba(34,197,94,.14)" stroke="#16a34a" strokeWidth="1.6" />
            <text x="61.5" y="30.4" textAnchor="middle" fontSize="8" fontWeight="800" fill="#16a34a" fontFamily={SANS} letterSpacing=".6">PAYÉ</text>
          </g>
        </svg>
      );
    case "driver":
    case "wheel":
      return (
        <div className="tns tns-html">
          <i className="tns-ring" /><i className="tns-ring tns-d2" />
          <img className="tns-logo tns-pop" src={logoDriver.url} alt="" draggable={false} />
          {kind === "driver" ? (
            <span className="tns-chip tns-chip--ok tns-d3">✓ Mission acceptée</span>
          ) : (
            <span className="tns-chip tns-chip--plus tns-d3">+ Postuler</span>
          )}
          <span className="tns-roadcar">{MINI_CAR}</span>
        </div>
      );
    case "gps":
      return (
        <div className="tns tns-html tns-map">
          <svg viewBox="0 0 86 56" width="86" height="56" aria-hidden="true">
            <rect width="86" height="56" rx="8" fill="#eaeff6" />
            <path d="M0 40c14-4 20 6 36 2s24-12 50-6v20H0z" fill="#bcd8f1" />
            <path d="M52 2h26l6 12H56z" fill="#cde8c8" />
            <path d="M-2 22 90 10M30 -2 46 58M6 50 70 -2M62 20 90 44" stroke="#fff" strokeWidth="2.6" fill="none" />
            <path d="M-2 22 90 10M30 -2 46 58" stroke="#d5dce8" strokeWidth=".5" fill="none" />
            <path className="tns-route" d="M10 46 C22 46 20 30 36 30 S52 16 74 12" stroke="#2f5fff" strokeWidth="3.4" strokeLinecap="round" fill="none" pathLength="100" />
            <circle cx="10" cy="46" r="3.6" fill="#fff" stroke="#2f5fff" strokeWidth="2" />
            <text x="4" y="55" fontSize="4.2" fontWeight="800" fill="#334155" fontFamily={SANS}>TOURS</text>
            <g className="tns-pin tns-d4"><path d="M74 3c-3.6 0-6.4 2.8-6.4 6.4 0 4.6 6.4 10 6.4 10s6.4-5.4 6.4-10C80.4 5.8 77.6 3 74 3z" fill="#ef4444" /><circle cx="74" cy="9.4" r="2.3" fill="#fff" /></g>
          </svg>
          <span className="tns-drive">{MINI_CAR}</span>
        </div>
      );
    case "code":
      return (
        <svg className="tns" viewBox="0 0 86 56" width="86" height="56" aria-hidden="true">
          <g className="tns-pop">
            <rect x="3" y="2" width="80" height="52" rx="8" fill="#0f1b4d" stroke="rgba(255,255,255,.25)" strokeWidth="1" />
            <text x="43" y="12" textAnchor="middle" fontSize="4.6" fontWeight="700" fill="#cfe0ff" fontFamily={SANS}>Code de livraison</text>
          </g>
          {["4", "7", "2", "9"].map((d, i) => (
            <g key={i}>
              <rect x={9 + i * 18} y="17" width="15" height="19" rx="4" fill="#fff" />
              <text className={`tns-digit tns-digit--${i}`} x={16.5 + i * 18} y="31" textAnchor="middle" fontSize="14" fontWeight="800" fill="#7c3aed" fontFamily={MONO}>{d}</text>
            </g>
          ))}
          <g className="tns-stamp tns-d4">
            <rect x="9" y="40" width="68" height="10" rx="5" fill="#22c55e" />
            <path d="m26 45 2.8 2.7 5.4-5.6" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <text x="52" y="47.4" textAnchor="middle" fontSize="5.2" fontWeight="800" fill="#fff" fontFamily={SANS}>Véhicule remis</text>
          </g>
        </svg>
      );
    case "linkedin":
      return (
        <div className="tns tns-html tns-in">
          <svg className="tns-pop tns-inlogo" viewBox="0 0 46 46" width="42" height="42" aria-hidden="true">
            <rect x="5" y="5" width="36" height="36" rx="8" fill="#0a66c2" stroke="#fff" strokeWidth="2.2" />
            <circle cx="15.5" cy="15.5" r="3.2" fill="#fff" />
            <rect x="12.4" y="21" width="6.2" height="14" rx="1" fill="#fff" />
            <path d="M22 21h5.8v2c1-1.6 2.8-2.4 5-2.4 4.3 0 5.2 2.8 5.2 6.5V35h-6.2v-7.2c0-1.6-.3-2.8-1.9-2.8s-2.4 1.1-2.4 2.8V35H22z" fill="#fff" />
          </svg>
          <span className="tns-bubble tns-bubble--a">+1</span>
          <span className="tns-bubble tns-bubble--b">♥</span>
          <span className="tns-bubble tns-bubble--c">+1</span>
        </div>
      );
    case "api":
      return (
        <svg className="tns" viewBox="0 0 86 56" width="86" height="56" aria-hidden="true">
          <g className="tns-pop">
            <rect x="2" y="3" width="82" height="50" rx="8" fill="#0a1440" stroke="rgba(255,255,255,.28)" strokeWidth="1" />
            <circle cx="9" cy="9.5" r="1.5" fill="#ff6b6b" /><circle cx="14" cy="9.5" r="1.5" fill="#fbbf24" /><circle cx="19" cy="9.5" r="1.5" fill="#34d399" />
          </g>
          <g className="tns-type"><text x="8" y="22" fontSize="5.6" fontWeight="700" fill="#9db8ff" fontFamily={MONO}>POST <tspan fill="#fff">/v1/missions</tspan></text></g>
          <g className="tns-fade tns-d2"><text x="8" y="31" fontSize="5" fill="#7c8db8" fontFamily={MONO}>{`{ "from": "Tours",`}</text><text x="8" y="38" fontSize="5" fill="#7c8db8" fontFamily={MONO}>{`  "to": "Bordeaux" }`}</text></g>
          <g className="tns-slam tns-d3">
            <rect x="8" y="42" width="44" height="8" rx="4" fill="rgba(34,197,94,.2)" stroke="#34d399" strokeWidth=".9" />
            <text x="30" y="48" textAnchor="middle" fontSize="5.2" fontWeight="800" fill="#34d399" fontFamily={MONO}>201 Created</text>
          </g>
        </svg>
      );
  }
}
