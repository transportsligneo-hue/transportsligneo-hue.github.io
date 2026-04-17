/**
 * SVG silhouette overlays for vehicle inspection photos.
 * Each variant guides the user to frame the photo correctly.
 */
type Variant =
  | "avant" | "avant_gauche" | "avant_droit"
  | "arriere" | "arriere_gauche" | "arriere_droit"
  | "compteur" | "siege_avant" | "siege_arriere" | "coffre";

interface Props { variant: Variant; }

const stroke = "rgba(212,175,55,0.55)";
const fill = "rgba(212,175,55,0.06)";

export function CarSilhouetteOverlay({ variant }: Props) {
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      <svg viewBox="0 0 300 400" className="w-[85%] h-[85%]" fill="none">
        {renderShape(variant)}
        {/* Corner brackets to suggest framing */}
        <g stroke={stroke} strokeWidth="2">
          <path d="M10 30 L10 10 L30 10" />
          <path d="M270 10 L290 10 L290 30" />
          <path d="M290 370 L290 390 L270 390" />
          <path d="M30 390 L10 390 L10 370" />
        </g>
      </svg>
    </div>
  );
}

function renderShape(v: Variant) {
  switch (v) {
    case "avant":
      return (
        <g stroke={stroke} strokeWidth="2.5" fill={fill} strokeLinejoin="round">
          {/* Front face */}
          <path d="M70 120 L230 120 L240 200 L60 200 Z" />
          <path d="M85 135 L215 135 L222 175 L78 175 Z" /> {/* windshield */}
          <circle cx="90" cy="215" r="10" /> <circle cx="210" cy="215" r="10" /> {/* headlights */}
          <rect x="120" y="220" width="60" height="18" rx="3" /> {/* grille */}
          <rect x="115" y="245" width="70" height="10" rx="2" /> {/* plate */}
        </g>
      );
    case "arriere":
      return (
        <g stroke={stroke} strokeWidth="2.5" fill={fill} strokeLinejoin="round">
          <path d="M70 120 L230 120 L240 220 L60 220 Z" />
          <path d="M85 135 L215 135 L222 180 L78 180 Z" />
          <rect x="75" y="195" width="40" height="18" rx="3" />
          <rect x="185" y="195" width="40" height="18" rx="3" />
          <rect x="115" y="235" width="70" height="14" rx="2" />
        </g>
      );
    case "avant_gauche":
    case "arriere_droit":
      return (
        <g stroke={stroke} strokeWidth="2.5" fill={fill} strokeLinejoin="round">
          <path d="M30 220 L80 150 L200 145 L260 180 L270 240 L240 270 L40 270 Z" />
          <circle cx="80" cy="270" r="22" /> <circle cx="220" cy="270" r="22" />
          <path d="M90 170 L150 165 L195 165 L210 195 L100 195 Z" />
        </g>
      );
    case "avant_droit":
    case "arriere_gauche":
      return (
        <g stroke={stroke} strokeWidth="2.5" fill={fill} strokeLinejoin="round">
          <path d="M270 220 L220 150 L100 145 L40 180 L30 240 L60 270 L260 270 Z" />
          <circle cx="80" cy="270" r="22" /> <circle cx="220" cy="270" r="22" />
          <path d="M210 170 L150 165 L105 165 L90 195 L200 195 Z" />
        </g>
      );
    case "compteur":
      return (
        <g stroke={stroke} strokeWidth="2.5" fill={fill}>
          <rect x="40" y="120" width="220" height="160" rx="20" />
          <circle cx="110" cy="200" r="55" />
          <circle cx="190" cy="200" r="55" />
          <path d="M110 200 L140 165" strokeWidth="3" />
          <path d="M190 200 L165 170" strokeWidth="3" />
        </g>
      );
    case "siege_avant":
      return (
        <g stroke={stroke} strokeWidth="2.5" fill={fill} strokeLinejoin="round">
          <path d="M70 90 Q70 70 90 70 L130 70 Q150 70 150 90 L150 220 L70 220 Z" />
          <path d="M150 90 Q150 70 170 70 L210 70 Q230 70 230 90 L230 220 L150 220 Z" />
          <rect x="60" y="220" width="180" height="50" rx="8" />
        </g>
      );
    case "siege_arriere":
      return (
        <g stroke={stroke} strokeWidth="2.5" fill={fill} strokeLinejoin="round">
          <path d="M40 100 Q40 80 60 80 L240 80 Q260 80 260 100 L260 230 L40 230 Z" />
          <rect x="30" y="230" width="240" height="60" rx="10" />
          <path d="M110 100 L110 230" /><path d="M190 100 L190 230" />
        </g>
      );
    case "coffre":
      return (
        <g stroke={stroke} strokeWidth="2.5" fill={fill} strokeLinejoin="round">
          <path d="M40 100 L260 100 L280 320 L20 320 Z" />
          <path d="M60 130 L240 130 L255 290 L45 290 Z" />
        </g>
      );
    default:
      return null;
  }
}
