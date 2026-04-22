/**
 * Silhouettes véhicule premium grisées — style "grand groupe" (cf. mockup).
 * Vues utilisées par le parcours d'état des lieux séquentiel (15 étapes).
 *
 * Design tokens :
 *  - traits : pro-text-soft (gris foncé)
 *  - remplissage : pro-bg-soft (gris très clair)
 *  - aspect plat, premium, neutre — sert de guide visuel sans texte.
 */
type Variant =
  | "devant"
  | "trois_quart_avant_gauche"
  | "trois_quart_arriere_gauche"
  | "arriere"
  | "coffre_ouvert"
  | "siege_arriere"
  | "siege_avant"
  | "trois_quart_arriere_droite"
  | "trois_quart_avant_droite"
  | "compteur"
  | "cable"
  | "roue_secours"
  | "kit_securite"
  | "pv_livraison"
  | "signature";

interface Props {
  variant: Variant;
  className?: string;
}

const STROKE = "hsl(215 16% 47%)";   // pro-text-soft equivalent (slate-500)
const FILL = "hsl(210 20% 96%)";     // pro-bg-soft (slate-50/100)
const ACCENT = "hsl(215 28% 32%)";   // darker slate (slate-700)
const GLASS = "hsl(210 20% 88%)";    // light glass (slate-200)

export function CarRealisticSilhouette({ variant, className = "" }: Props) {
  return (
    <div className={`w-full h-full flex items-center justify-center ${className}`}>
      <svg
        viewBox="0 0 400 260"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {renderShape(variant)}
      </svg>
    </div>
  );
}

function renderShape(v: Variant) {
  switch (v) {
    // ─────────── 1. DEVANT ───────────
    case "devant":
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Capot / haut */}
          <path d="M80 90 Q200 60 320 90 L335 130 L65 130 Z" fill={FILL} stroke={STROKE} strokeWidth="2" />
          {/* Pare-brise */}
          <path d="M115 95 Q200 75 285 95 L275 125 L125 125 Z" fill={GLASS} stroke={STROKE} strokeWidth="1.5" />
          {/* Bas / pare-chocs */}
          <path d="M65 130 L335 130 L350 200 L50 200 Z" fill={FILL} stroke={STROKE} strokeWidth="2" />
          {/* Calandre */}
          <rect x="160" y="155" width="80" height="22" rx="3" fill={ACCENT} stroke={STROKE} strokeWidth="1.5" />
          {/* Logo central */}
          <circle cx="200" cy="166" r="6" fill={FILL} stroke={STROKE} strokeWidth="1" />
          {/* Phares */}
          <path d="M75 138 Q95 132 145 142 L140 158 L80 158 Z" fill={GLASS} stroke={STROKE} strokeWidth="1.5" />
          <path d="M325 138 Q305 132 255 142 L260 158 L320 158 Z" fill={GLASS} stroke={STROKE} strokeWidth="1.5" />
          {/* Plaque */}
          <rect x="170" y="183" width="60" height="12" rx="2" fill="white" stroke={STROKE} strokeWidth="1" />
          {/* Roues visibles */}
          <ellipse cx="80" cy="210" rx="22" ry="8" fill={ACCENT} stroke={STROKE} strokeWidth="1.5" />
          <ellipse cx="320" cy="210" rx="22" ry="8" fill={ACCENT} stroke={STROKE} strokeWidth="1.5" />
        </g>
      );

    // ─────────── 2. 3/4 AVANT GAUCHE ───────────
    case "trois_quart_avant_gauche":
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Toit + capot */}
          <path d="M50 150 L110 90 Q200 75 290 95 L350 140 L350 195 L50 195 Z" fill={FILL} stroke={STROKE} strokeWidth="2" />
          {/* Pare-brise */}
          <path d="M120 100 Q190 85 265 105 L255 145 L130 145 Z" fill={GLASS} stroke={STROKE} strokeWidth="1.5" />
          {/* Vitre latérale */}
          <path d="M50 150 L110 100 L130 145 L60 145 Z" fill={GLASS} stroke={STROKE} strokeWidth="1.5" />
          {/* Calandre */}
          <rect x="290" y="160" width="50" height="20" rx="2" fill={ACCENT} stroke={STROKE} strokeWidth="1.2" />
          {/* Phares */}
          <ellipse cx="320" cy="148" rx="20" ry="8" fill={GLASS} stroke={STROKE} strokeWidth="1.2" />
          {/* Roues */}
          <circle cx="115" cy="200" r="22" fill={ACCENT} stroke={STROKE} strokeWidth="1.5" />
          <circle cx="115" cy="200" r="10" fill={FILL} />
          <circle cx="295" cy="200" r="22" fill={ACCENT} stroke={STROKE} strokeWidth="1.5" />
          <circle cx="295" cy="200" r="10" fill={FILL} />
          {/* Portière */}
          <line x1="180" y1="145" x2="180" y2="195" stroke={STROKE} strokeWidth="1" />
          {/* Rétro */}
          <ellipse cx="135" cy="135" rx="8" ry="5" fill={ACCENT} stroke={STROKE} strokeWidth="1" />
        </g>
      );

    // ─────────── 3. 3/4 ARRIÈRE GAUCHE ───────────
    case "trois_quart_arriere_gauche":
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          <path d="M50 140 L110 95 Q200 80 280 100 L340 150 L350 195 L45 195 Z" fill={FILL} stroke={STROKE} strokeWidth="2" />
          <path d="M120 105 Q200 90 265 110 L255 145 L130 145 Z" fill={GLASS} stroke={STROKE} strokeWidth="1.5" />
          {/* Vitre arrière-latérale */}
          <path d="M260 110 L290 145 L255 145 Z" fill={GLASS} stroke={STROKE} strokeWidth="1.2" />
          {/* Feux arrière */}
          <rect x="300" y="155" width="40" height="18" rx="2" fill="hsl(0 60% 55%)" stroke={STROKE} strokeWidth="1.2" opacity="0.7" />
          {/* Plaque arrière */}
          <rect x="265" y="178" width="40" height="10" rx="1" fill="white" stroke={STROKE} strokeWidth="1" />
          {/* Roues */}
          <circle cx="115" cy="200" r="22" fill={ACCENT} stroke={STROKE} strokeWidth="1.5" />
          <circle cx="115" cy="200" r="10" fill={FILL} />
          <circle cx="290" cy="200" r="22" fill={ACCENT} stroke={STROKE} strokeWidth="1.5" />
          <circle cx="290" cy="200" r="10" fill={FILL} />
          <line x1="200" y1="145" x2="200" y2="195" stroke={STROKE} strokeWidth="1" />
        </g>
      );

    // ─────────── 4. ARRIÈRE ───────────
    case "arriere":
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          <path d="M80 85 Q200 65 320 85 L335 130 L65 130 Z" fill={FILL} stroke={STROKE} strokeWidth="2" />
          {/* Lunette */}
          <path d="M115 90 Q200 75 285 90 L275 125 L125 125 Z" fill={GLASS} stroke={STROKE} strokeWidth="1.5" />
          {/* Hayon / pare-chocs */}
          <path d="M65 130 L335 130 L345 200 L55 200 Z" fill={FILL} stroke={STROKE} strokeWidth="2" />
          {/* Feux arrière */}
          <path d="M75 138 L150 138 L145 165 L80 165 Z" fill="hsl(0 65% 55%)" stroke={STROKE} strokeWidth="1.2" opacity="0.75" />
          <path d="M325 138 L250 138 L255 165 L320 165 Z" fill="hsl(0 65% 55%)" stroke={STROKE} strokeWidth="1.2" opacity="0.75" />
          {/* Plaque */}
          <rect x="165" y="170" width="70" height="18" rx="2" fill="white" stroke={STROKE} strokeWidth="1.2" />
          {/* Logo */}
          <circle cx="200" cy="148" r="7" fill={FILL} stroke={STROKE} strokeWidth="1" />
          {/* Roues visibles */}
          <ellipse cx="80" cy="210" rx="22" ry="8" fill={ACCENT} stroke={STROKE} strokeWidth="1.5" />
          <ellipse cx="320" cy="210" rx="22" ry="8" fill={ACCENT} stroke={STROKE} strokeWidth="1.5" />
        </g>
      );

    // ─────────── 5. COFFRE OUVERT ───────────
    case "coffre_ouvert":
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Hayon ouvert vers le haut */}
          <path d="M70 30 L330 30 L300 100 L100 100 Z" fill={GLASS} stroke={STROKE} strokeWidth="2" opacity="0.6" />
          {/* Bord supérieur du coffre */}
          <path d="M100 100 L300 100 L290 130 L110 130 Z" fill={ACCENT} stroke={STROKE} strokeWidth="1.5" opacity="0.4" />
          {/* Plancher coffre */}
          <path d="M50 130 L350 130 L330 220 L70 220 Z" fill={FILL} stroke={STROKE} strokeWidth="2" />
          {/* Lignes intérieures (tapis) */}
          <line x1="100" y1="155" x2="300" y2="155" stroke={STROKE} strokeWidth="0.8" opacity="0.5" />
          <line x1="90" y1="180" x2="310" y2="180" stroke={STROKE} strokeWidth="0.8" opacity="0.5" />
          <line x1="80" y1="205" x2="320" y2="205" stroke={STROKE} strokeWidth="0.8" opacity="0.5" />
          {/* Logo coffre */}
          <circle cx="200" cy="115" r="5" fill={FILL} stroke={STROKE} strokeWidth="1" />
        </g>
      );

    // ─────────── 6. SIÈGE ARRIÈRE ───────────
    case "siege_arriere":
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Banquette dossier */}
          <path d="M50 50 L350 50 Q360 50 360 70 L360 160 L40 160 L40 70 Q40 50 50 50 Z" fill={FILL} stroke={STROKE} strokeWidth="2" />
          {/* Séparation places */}
          <line x1="135" y1="55" x2="135" y2="155" stroke={STROKE} strokeWidth="1.5" />
          <line x1="265" y1="55" x2="265" y2="155" stroke={STROKE} strokeWidth="1.5" />
          {/* Appuie-têtes */}
          <rect x="55" y="35" width="60" height="22" rx="6" fill={ACCENT} stroke={STROKE} strokeWidth="1.5" />
          <rect x="170" y="35" width="60" height="22" rx="6" fill={ACCENT} stroke={STROKE} strokeWidth="1.5" />
          <rect x="285" y="35" width="60" height="22" rx="6" fill={ACCENT} stroke={STROKE} strokeWidth="1.5" />
          {/* Assise */}
          <path d="M30 160 L370 160 L380 220 L20 220 Z" fill={FILL} stroke={STROKE} strokeWidth="2" />
          {/* Coutures */}
          <line x1="80" y1="80" x2="120" y2="80" stroke={STROKE} strokeWidth="0.8" opacity="0.5" />
          <line x1="195" y1="80" x2="245" y2="80" stroke={STROKE} strokeWidth="0.8" opacity="0.5" />
          <line x1="290" y1="80" x2="335" y2="80" stroke={STROKE} strokeWidth="0.8" opacity="0.5" />
        </g>
      );

    // ─────────── 7. SIÈGE AVANT ───────────
    case "siege_avant":
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Siège conducteur */}
          <path d="M70 60 Q70 45 90 45 L155 45 Q175 45 175 60 L175 175 L65 175 Z" fill={FILL} stroke={STROKE} strokeWidth="2" />
          <rect x="85" y="30" width="75" height="22" rx="8" fill={ACCENT} stroke={STROKE} strokeWidth="1.5" />
          {/* Siège passager */}
          <path d="M225 60 Q225 45 245 45 L310 45 Q330 45 330 60 L330 175 L220 175 Z" fill={FILL} stroke={STROKE} strokeWidth="2" />
          <rect x="240" y="30" width="75" height="22" rx="8" fill={ACCENT} stroke={STROKE} strokeWidth="1.5" />
          {/* Assise commune */}
          <path d="M50 175 L350 175 L360 220 L40 220 Z" fill={FILL} stroke={STROKE} strokeWidth="2" />
          {/* Coutures verticales */}
          <line x1="120" y1="65" x2="120" y2="170" stroke={STROKE} strokeWidth="0.8" opacity="0.5" />
          <line x1="275" y1="65" x2="275" y2="170" stroke={STROKE} strokeWidth="0.8" opacity="0.5" />
        </g>
      );

    // ─────────── 8. 3/4 ARRIÈRE DROITE ───────────
    case "trois_quart_arriere_droite":
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          <path d="M350 140 L290 95 Q200 80 120 100 L60 150 L50 195 L355 195 Z" fill={FILL} stroke={STROKE} strokeWidth="2" />
          <path d="M280 105 Q200 90 135 110 L145 145 L270 145 Z" fill={GLASS} stroke={STROKE} strokeWidth="1.5" />
          <path d="M140 110 L110 145 L145 145 Z" fill={GLASS} stroke={STROKE} strokeWidth="1.2" />
          <rect x="60" y="155" width="40" height="18" rx="2" fill="hsl(0 60% 55%)" stroke={STROKE} strokeWidth="1.2" opacity="0.7" />
          <rect x="95" y="178" width="40" height="10" rx="1" fill="white" stroke={STROKE} strokeWidth="1" />
          <circle cx="285" cy="200" r="22" fill={ACCENT} stroke={STROKE} strokeWidth="1.5" />
          <circle cx="285" cy="200" r="10" fill={FILL} />
          <circle cx="110" cy="200" r="22" fill={ACCENT} stroke={STROKE} strokeWidth="1.5" />
          <circle cx="110" cy="200" r="10" fill={FILL} />
          <line x1="200" y1="145" x2="200" y2="195" stroke={STROKE} strokeWidth="1" />
        </g>
      );

    // ─────────── 9. 3/4 AVANT DROITE ───────────
    case "trois_quart_avant_droite":
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          <path d="M350 150 L290 90 Q200 75 110 95 L50 140 L50 195 L350 195 Z" fill={FILL} stroke={STROKE} strokeWidth="2" />
          <path d="M280 100 Q200 85 135 105 L145 145 L270 145 Z" fill={GLASS} stroke={STROKE} strokeWidth="1.5" />
          <path d="M350 150 L290 100 L270 145 L340 145 Z" fill={GLASS} stroke={STROKE} strokeWidth="1.5" />
          <rect x="60" y="160" width="50" height="20" rx="2" fill={ACCENT} stroke={STROKE} strokeWidth="1.2" />
          <ellipse cx="80" cy="148" rx="20" ry="8" fill={GLASS} stroke={STROKE} strokeWidth="1.2" />
          <circle cx="285" cy="200" r="22" fill={ACCENT} stroke={STROKE} strokeWidth="1.5" />
          <circle cx="285" cy="200" r="10" fill={FILL} />
          <circle cx="105" cy="200" r="22" fill={ACCENT} stroke={STROKE} strokeWidth="1.5" />
          <circle cx="105" cy="200" r="10" fill={FILL} />
          <line x1="220" y1="145" x2="220" y2="195" stroke={STROKE} strokeWidth="1" />
          <ellipse cx="265" cy="135" rx="8" ry="5" fill={ACCENT} stroke={STROKE} strokeWidth="1" />
        </g>
      );

    // ─────────── 10. COMPTEUR ───────────
    case "compteur":
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Cadre tableau de bord */}
          <rect x="40" y="50" width="320" height="170" rx="20" fill={FILL} stroke={STROKE} strokeWidth="2" />
          {/* Compteur principal */}
          <circle cx="135" cy="135" r="65" fill="white" stroke={STROKE} strokeWidth="2" />
          <circle cx="135" cy="135" r="55" fill="none" stroke={STROKE} strokeWidth="0.8" />
          {/* Aiguille */}
          <line x1="135" y1="135" x2="170" y2="100" stroke="hsl(0 70% 50%)" strokeWidth="3" strokeLinecap="round" />
          <circle cx="135" cy="135" r="6" fill={ACCENT} />
          {/* Graduations */}
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270].map((a, i) => {
            const rad = (a - 90) * Math.PI / 180;
            const x1 = 135 + Math.cos(rad) * 50;
            const y1 = 135 + Math.sin(rad) * 50;
            const x2 = 135 + Math.cos(rad) * 58;
            const y2 = 135 + Math.sin(rad) * 58;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={STROKE} strokeWidth="1.5" />;
          })}
          {/* Compteur secondaire (carburant) */}
          <circle cx="270" cy="135" r="55" fill="white" stroke={STROKE} strokeWidth="2" />
          <line x1="270" y1="135" x2="240" y2="115" stroke="hsl(40 80% 50%)" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="270" cy="135" r="5" fill={ACCENT} />
          {/* Écran central */}
          <rect x="180" y="178" width="50" height="20" rx="3" fill={ACCENT} />
        </g>
      );

    // ─────────── 11. CÂBLE DE RECHARGE ───────────
    case "cable":
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Trappe véhicule */}
          <rect x="40" y="80" width="120" height="100" rx="10" fill={FILL} stroke={STROKE} strokeWidth="2" />
          {/* Prise véhicule */}
          <circle cx="100" cy="130" r="28" fill={ACCENT} stroke={STROKE} strokeWidth="2" />
          <circle cx="100" cy="130" r="20" fill={FILL} stroke={STROKE} strokeWidth="1.5" />
          <circle cx="93" cy="124" r="3" fill={ACCENT} />
          <circle cx="107" cy="124" r="3" fill={ACCENT} />
          <circle cx="100" cy="138" r="3" fill={ACCENT} />
          {/* Câble */}
          <path d="M128 130 Q200 110 270 145 Q310 165 340 130" fill="none" stroke={ACCENT} strokeWidth="10" strokeLinecap="round" />
          <path d="M128 130 Q200 110 270 145 Q310 165 340 130" fill="none" stroke={STROKE} strokeWidth="11" strokeLinecap="round" opacity="0.3" />
          {/* Prise borne */}
          <rect x="335" y="100" width="40" height="60" rx="6" fill={ACCENT} stroke={STROKE} strokeWidth="2" />
          <rect x="343" y="110" width="24" height="14" rx="2" fill="hsl(140 60% 50%)" />
        </g>
      );

    // ─────────── 12. ROUE DE SECOURS ───────────
    case "roue_secours":
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Roue */}
          <circle cx="200" cy="130" r="90" fill={ACCENT} stroke={STROKE} strokeWidth="2" />
          <circle cx="200" cy="130" r="78" fill="hsl(0 0% 15%)" stroke={STROKE} strokeWidth="1.5" />
          {/* Jante */}
          <circle cx="200" cy="130" r="40" fill={FILL} stroke={STROKE} strokeWidth="2" />
          <circle cx="200" cy="130" r="8" fill={ACCENT} />
          {/* Branches jante */}
          {[0, 60, 120, 180, 240, 300].map((a, i) => {
            const rad = a * Math.PI / 180;
            const x = 200 + Math.cos(rad) * 35;
            const y = 130 + Math.sin(rad) * 35;
            return <line key={i} x1="200" y1="130" x2={x} y2={y} stroke={STROKE} strokeWidth="3" />;
          })}
          {/* Reflets pneu */}
          <ellipse cx="200" cy="60" rx="60" ry="8" fill="white" opacity="0.15" />
        </g>
      );

    // ─────────── 13. KIT SÉCURITÉ ───────────
    case "kit_securite":
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Gilet jaune */}
          <path d="M70 90 L130 90 L140 100 L160 100 L160 200 L70 200 Z" fill="hsl(55 95% 55%)" stroke={STROKE} strokeWidth="2" />
          <path d="M115 100 L115 200" stroke={STROKE} strokeWidth="1.2" />
          {/* Bandes réfléchissantes */}
          <rect x="78" y="135" width="74" height="8" fill="hsl(210 40% 70%)" opacity="0.7" />
          <rect x="78" y="170" width="74" height="8" fill="hsl(210 40% 70%)" opacity="0.7" />
          {/* Triangle de signalisation */}
          <path d="M280 80 L350 200 L210 200 Z" fill="white" stroke="hsl(0 75% 50%)" strokeWidth="6" strokeLinejoin="round" />
          <path d="M280 110 L335 195 L225 195 Z" fill="hsl(0 75% 55%)" stroke="hsl(0 75% 35%)" strokeWidth="2" />
          <path d="M280 130 L320 190 L240 190 Z" fill="white" />
        </g>
      );

    // ─────────── 14. PV LIVRAISON ───────────
    case "pv_livraison":
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Document */}
          <rect x="100" y="40" width="200" height="200" rx="6" fill="white" stroke={STROKE} strokeWidth="2" />
          {/* En-tête */}
          <rect x="115" y="55" width="170" height="25" rx="2" fill={ACCENT} />
          <rect x="125" y="62" width="80" height="4" rx="1" fill="white" opacity="0.8" />
          <rect x="125" y="70" width="50" height="3" rx="1" fill="white" opacity="0.6" />
          {/* Lignes texte */}
          {[100, 115, 130, 145, 165, 180, 195].map((y, i) => (
            <rect key={i} x="115" y={y} width={i % 2 ? 140 : 170} height="3" rx="1" fill={STROKE} opacity="0.4" />
          ))}
          {/* Tampon */}
          <circle cx="240" cy="200" r="22" fill="none" stroke="hsl(0 65% 50%)" strokeWidth="2" opacity="0.7" />
          <text x="240" y="205" textAnchor="middle" fontSize="9" fill="hsl(0 65% 50%)" opacity="0.7" fontWeight="bold">VALIDÉ</text>
          {/* Signature */}
          <path d="M120 215 Q140 205 160 215 T200 215" stroke={ACCENT} strokeWidth="2" fill="none" />
        </g>
      );

    // ─────────── 15. SIGNATURE ───────────
    case "signature":
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Tablette */}
          <rect x="40" y="50" width="320" height="170" rx="14" fill="hsl(220 15% 12%)" stroke={STROKE} strokeWidth="2" />
          {/* Écran */}
          <rect x="55" y="65" width="290" height="140" rx="6" fill="white" />
          {/* Ligne de signature */}
          <line x1="80" y1="170" x2="320" y2="170" stroke={STROKE} strokeWidth="1.2" strokeDasharray="3 3" />
          {/* Signature stylisée */}
          <path
            d="M90 145 Q110 110 130 140 Q145 165 165 130 Q180 105 200 140 Q215 160 240 125 Q260 100 285 145"
            stroke={ACCENT}
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
          <path d="M285 145 Q295 155 305 150" stroke={ACCENT} strokeWidth="3" fill="none" strokeLinecap="round" />
          {/* Bouton home */}
          <circle cx="200" cy="215" r="3" fill="white" opacity="0.5" />
        </g>
      );

    default:
      return null;
  }
}
