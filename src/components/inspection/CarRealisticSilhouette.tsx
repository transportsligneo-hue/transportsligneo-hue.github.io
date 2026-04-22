/**
 * CarRealisticSilhouette — Silhouettes véhicule premium, style "grand groupe".
 *
 * Approche : profil 2D épuré inspiré des études design automobile (proportions
 * berline moderne, lignes nettes, dégradés discrets, aucun élément cartoon).
 * Sert de guide visuel sur l'écran de prise de photo.
 */
type Variant =
  | "devant"
  | "trois_quart_avant_gauche"
  | "trois_quart_arriere_gauche"
  | "coffre_ferme"
  | "coffre_ouvert"
  | "trois_quart_arriere_droite"
  | "siege_arriere"
  | "siege_avant"
  | "trois_quart_avant_droite"
  | "jantes"
  | "compteur"
  | "kit_securite"
  | "cable"
  | "documents"
  | "signature";

interface Props {
  variant: Variant;
  className?: string;
}

// Palette neutre premium (slate)
const C = {
  body: "#cbd5e1",          // body fill (slate-300)
  bodyDark: "#94a3b8",      // body shading (slate-400)
  outline: "#334155",       // outline (slate-700)
  outlineSoft: "#64748b",   // soft outline (slate-500)
  glass: "#dbeafe",         // glass tint (sky-100)
  glassDark: "#bfdbfe",     // glass shading
  tire: "#1f2937",          // tire (gray-800)
  rim: "#e2e8f0",           // rim (slate-200)
  rimDark: "#94a3b8",
  light: "#fef3c7",         // headlight tint (amber-100)
  taillight: "#f87171",     // taillight (red-400)
  paper: "#ffffff",
  ink: "#0f172a",
  accent: "#0b1026",
  yellowVest: "#facc15",    // safety vest (yellow-400)
  triangleRed: "#dc2626",
};

export function CarRealisticSilhouette({ variant, className = "" }: Props) {
  return (
    <div className={`w-full h-full flex items-center justify-center ${className}`}>
      <svg
        viewBox="0 0 480 280"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          {/* Dégradé carrosserie */}
          <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e2e8f0" />
            <stop offset="55%" stopColor={C.body} />
            <stop offset="100%" stopColor={C.bodyDark} />
          </linearGradient>
          {/* Dégradé verre */}
          <linearGradient id="glassGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f1f5f9" />
            <stop offset="100%" stopColor={C.glassDark} />
          </linearGradient>
          {/* Reflet pneu */}
          <radialGradient id="rimGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={C.rim} />
            <stop offset="100%" stopColor={C.rimDark} />
          </radialGradient>
        </defs>
        {renderShape(variant)}
      </svg>
    </div>
  );
}

/* ─────────────────── Helpers de rendu ─────────────────── */

function Wheel({ cx, cy, r = 26 }: { cx: number; cy: number; r?: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={C.tire} stroke={C.outline} strokeWidth="1.5" />
      <circle cx={cx} cy={cy} r={r * 0.6} fill="url(#rimGrad)" stroke={C.outlineSoft} strokeWidth="1" />
      {[0, 72, 144, 216, 288].map((a) => {
        const rad = (a * Math.PI) / 180;
        return (
          <line
            key={a}
            x1={cx}
            y1={cy}
            x2={cx + Math.cos(rad) * r * 0.55}
            y2={cy + Math.sin(rad) * r * 0.55}
            stroke={C.rimDark}
            strokeWidth="2"
            strokeLinecap="round"
          />
        );
      })}
      <circle cx={cx} cy={cy} r="3" fill={C.outline} />
    </g>
  );
}

function renderShape(v: Variant) {
  switch (v) {
    /* ============= 1. AVANT ============= */
    case "devant":
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Capot */}
          <path d="M70 130 Q240 100 410 130 L420 175 L60 175 Z" fill="url(#bodyGrad)" stroke={C.outline} strokeWidth="2" />
          {/* Pare-brise */}
          <path d="M115 100 Q240 70 365 100 L350 135 L130 135 Z" fill="url(#glassGrad)" stroke={C.outline} strokeWidth="1.5" />
          {/* Toit */}
          <path d="M150 70 Q240 55 330 70 L350 95 L130 95 Z" fill="url(#bodyGrad)" stroke={C.outline} strokeWidth="1.5" />
          {/* Pare-chocs avant */}
          <path d="M60 175 L420 175 L430 230 L50 230 Z" fill="url(#bodyGrad)" stroke={C.outline} strokeWidth="2" />
          {/* Calandre */}
          <rect x="190" y="190" width="100" height="22" rx="4" fill={C.accent} stroke={C.outline} strokeWidth="1.2" />
          <line x1="200" y1="195" x2="280" y2="195" stroke={C.outlineSoft} strokeWidth="0.6" />
          <line x1="200" y1="201" x2="280" y2="201" stroke={C.outlineSoft} strokeWidth="0.6" />
          <line x1="200" y1="207" x2="280" y2="207" stroke={C.outlineSoft} strokeWidth="0.6" />
          {/* Logo */}
          <circle cx="240" cy="201" r="7" fill={C.body} stroke={C.outline} strokeWidth="1" />
          {/* Phares effilés */}
          <path d="M70 145 Q120 138 165 152 L160 175 L75 175 Z" fill={C.light} stroke={C.outline} strokeWidth="1.3" />
          <path d="M410 145 Q360 138 315 152 L320 175 L405 175 Z" fill={C.light} stroke={C.outline} strokeWidth="1.3" />
          {/* Plaque */}
          <rect x="195" y="215" width="90" height="16" rx="2" fill={C.paper} stroke={C.outline} strokeWidth="1" />
          {/* Roues partielles */}
          <ellipse cx="80" cy="240" rx="28" ry="9" fill={C.tire} stroke={C.outline} strokeWidth="1.5" />
          <ellipse cx="400" cy="240" rx="28" ry="9" fill={C.tire} stroke={C.outline} strokeWidth="1.5" />
        </g>
      );

    /* ============= 2. 3/4 AVANT GAUCHE ============= */
    case "trois_quart_avant_gauche":
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Carrosserie principale (profil + amorce face) */}
          <path
            d="M40 195 L40 165 Q40 145 70 130 L130 95 Q220 75 320 95 L380 115 L425 145 L430 200 Z"
            fill="url(#bodyGrad)"
            stroke={C.outline}
            strokeWidth="2"
          />
          {/* Pare-brise + vitre */}
          <path d="M135 105 Q220 88 305 108 L295 145 L150 145 Z" fill="url(#glassGrad)" stroke={C.outline} strokeWidth="1.4" />
          {/* Vitre conducteur */}
          <path d="M40 165 Q60 145 130 145 L150 145 L150 175 L40 175 Z" fill="url(#glassGrad)" stroke={C.outline} strokeWidth="1.2" />
          {/* Calandre amorce face */}
          <rect x="380" y="160" width="45" height="28" rx="3" fill={C.accent} stroke={C.outline} strokeWidth="1.2" />
          {/* Phare */}
          <ellipse cx="405" cy="148" rx="22" ry="9" fill={C.light} stroke={C.outline} strokeWidth="1.2" />
          {/* Ligne de portière */}
          <line x1="220" y1="150" x2="220" y2="225" stroke={C.outlineSoft} strokeWidth="1" />
          <line x1="305" y1="150" x2="305" y2="225" stroke={C.outlineSoft} strokeWidth="1" />
          {/* Poignée */}
          <rect x="180" y="180" width="30" height="5" rx="2" fill={C.bodyDark} />
          <rect x="265" y="180" width="30" height="5" rx="2" fill={C.bodyDark} />
          {/* Rétro */}
          <ellipse cx="155" cy="135" rx="9" ry="6" fill={C.bodyDark} stroke={C.outline} strokeWidth="1" />
          {/* Bas de caisse */}
          <path d="M50 225 L420 225 L420 245 L60 245 Z" fill={C.bodyDark} opacity="0.7" />
          {/* Roues */}
          <Wheel cx={120} cy={235} r={28} />
          <Wheel cx={355} cy={235} r={28} />
        </g>
      );

    /* ============= 3. 3/4 ARRIÈRE GAUCHE ============= */
    case "trois_quart_arriere_gauche":
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          <path
            d="M50 200 L55 145 Q70 120 130 100 Q220 82 310 100 L380 130 L420 165 L420 200 Z"
            fill="url(#bodyGrad)"
            stroke={C.outline}
            strokeWidth="2"
          />
          {/* Pare-brise arrière + lunette */}
          <path d="M145 110 Q220 95 295 112 L290 148 L155 148 Z" fill="url(#glassGrad)" stroke={C.outline} strokeWidth="1.4" />
          {/* Vitre arrière custode */}
          <path d="M295 112 L380 138 L370 148 L290 148 Z" fill="url(#glassGrad)" stroke={C.outline} strokeWidth="1.2" />
          {/* Feux arrière */}
          <path d="M50 165 L130 165 L125 195 L52 195 Z" fill={C.taillight} stroke={C.outline} strokeWidth="1.2" opacity="0.9" />
          {/* Plaque arrière */}
          <rect x="65" y="200" width="60" height="14" rx="2" fill={C.paper} stroke={C.outline} strokeWidth="1" />
          {/* Portières */}
          <line x1="200" y1="148" x2="200" y2="225" stroke={C.outlineSoft} strokeWidth="1" />
          <line x1="295" y1="148" x2="295" y2="225" stroke={C.outlineSoft} strokeWidth="1" />
          {/* Bas de caisse */}
          <path d="M50 225 L420 225 L420 245 L60 245 Z" fill={C.bodyDark} opacity="0.7" />
          {/* Roues */}
          <Wheel cx={125} cy={235} r={28} />
          <Wheel cx={355} cy={235} r={28} />
        </g>
      );

    /* ============= 4. COFFRE FERMÉ (vue arrière) ============= */
    case "coffre_ferme":
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Hayon arrière */}
          <path d="M90 80 Q240 60 390 80 L405 145 L75 145 Z" fill="url(#bodyGrad)" stroke={C.outline} strokeWidth="2" />
          {/* Lunette arrière */}
          <path d="M130 90 Q240 75 350 90 L335 135 L145 135 Z" fill="url(#glassGrad)" stroke={C.outline} strokeWidth="1.5" />
          {/* Pare-chocs */}
          <path d="M75 145 L405 145 L420 215 L60 215 Z" fill="url(#bodyGrad)" stroke={C.outline} strokeWidth="2" />
          {/* Feux arrière */}
          <path d="M75 152 Q120 150 180 158 L175 185 L80 185 Z" fill={C.taillight} stroke={C.outline} strokeWidth="1.2" opacity="0.9" />
          <path d="M405 152 Q360 150 300 158 L305 185 L400 185 Z" fill={C.taillight} stroke={C.outline} strokeWidth="1.2" opacity="0.9" />
          {/* Logo */}
          <circle cx="240" cy="170" r="9" fill={C.body} stroke={C.outline} strokeWidth="1" />
          {/* Plaque */}
          <rect x="195" y="195" width="90" height="16" rx="2" fill={C.paper} stroke={C.outline} strokeWidth="1" />
          {/* Ligne d'ouverture coffre */}
          <path d="M120 130 Q240 122 360 130" stroke={C.outlineSoft} strokeWidth="1" strokeDasharray="3 3" fill="none" />
          {/* Roues */}
          <ellipse cx="95" cy="225" rx="28" ry="9" fill={C.tire} stroke={C.outline} strokeWidth="1.5" />
          <ellipse cx="385" cy="225" rx="28" ry="9" fill={C.tire} stroke={C.outline} strokeWidth="1.5" />
        </g>
      );

    /* ============= 5. OUVERTURE COFFRE ============= */
    case "coffre_ouvert":
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Hayon ouvert vers le haut */}
          <path d="M85 25 L395 25 L370 105 L110 105 Z" fill="url(#glassGrad)" stroke={C.outline} strokeWidth="2" opacity="0.85" />
          <path d="M115 35 L365 35 L345 95 L135 95 Z" fill="url(#glassGrad)" stroke={C.outlineSoft} strokeWidth="1" opacity="0.6" />
          {/* Logo sur hayon */}
          <circle cx="240" cy="65" r="6" fill={C.body} stroke={C.outline} strokeWidth="1" />
          {/* Bord du coffre + intérieur */}
          <path d="M110 105 L370 105 L355 145 L125 145 Z" fill={C.bodyDark} stroke={C.outline} strokeWidth="1.5" />
          {/* Plancher coffre (ouvert) */}
          <path d="M70 145 L410 145 L390 245 L90 245 Z" fill="url(#bodyGrad)" stroke={C.outline} strokeWidth="2" />
          {/* Tapis coffre */}
          <rect x="120" y="170" width="240" height="60" rx="6" fill={C.bodyDark} opacity="0.4" />
          {/* Coutures du tapis */}
          {[185, 205, 225].map((y) => (
            <line key={y} x1="125" y1={y} x2="355" y2={y} stroke={C.outlineSoft} strokeWidth="0.6" opacity="0.6" />
          ))}
          {/* Vérins coffre */}
          <line x1="100" y1="110" x2="115" y2="40" stroke={C.outline} strokeWidth="2" />
          <line x1="380" y1="110" x2="365" y2="40" stroke={C.outline} strokeWidth="2" />
        </g>
      );

    /* ============= 6. 3/4 ARRIÈRE DROITE ============= */
    case "trois_quart_arriere_droite":
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          <path
            d="M430 200 L425 145 Q410 120 350 100 Q260 82 170 100 L100 130 L60 165 L60 200 Z"
            fill="url(#bodyGrad)"
            stroke={C.outline}
            strokeWidth="2"
          />
          <path d="M335 110 Q260 95 185 112 L190 148 L325 148 Z" fill="url(#glassGrad)" stroke={C.outline} strokeWidth="1.4" />
          <path d="M185 112 L100 138 L110 148 L190 148 Z" fill="url(#glassGrad)" stroke={C.outline} strokeWidth="1.2" />
          {/* Feux arrière */}
          <path d="M430 165 L350 165 L355 195 L428 195 Z" fill={C.taillight} stroke={C.outline} strokeWidth="1.2" opacity="0.9" />
          <rect x="355" y="200" width="60" height="14" rx="2" fill={C.paper} stroke={C.outline} strokeWidth="1" />
          <line x1="280" y1="148" x2="280" y2="225" stroke={C.outlineSoft} strokeWidth="1" />
          <line x1="185" y1="148" x2="185" y2="225" stroke={C.outlineSoft} strokeWidth="1" />
          <path d="M50 225 L430 225 L430 245 L60 245 Z" fill={C.bodyDark} opacity="0.7" />
          <Wheel cx={355} cy={235} r={28} />
          <Wheel cx={125} cy={235} r={28} />
        </g>
      );

    /* ============= 7. SIÈGE ARRIÈRE ============= */
    case "siege_arriere":
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Plafond / cadre */}
          <rect x="40" y="20" width="400" height="30" rx="6" fill={C.bodyDark} opacity="0.3" />
          {/* Banquette arrière dossier */}
          <path d="M50 50 L430 50 Q445 50 445 70 L445 165 L35 165 L35 70 Q35 50 50 50 Z" fill="url(#bodyGrad)" stroke={C.outline} strokeWidth="2" />
          {/* Séparations */}
          <line x1="170" y1="55" x2="170" y2="160" stroke={C.outline} strokeWidth="1.5" />
          <line x1="310" y1="55" x2="310" y2="160" stroke={C.outline} strokeWidth="1.5" />
          {/* Appuie-têtes */}
          <rect x="60" y="32" width="80" height="26" rx="8" fill={C.accent} stroke={C.outline} strokeWidth="1.5" />
          <rect x="200" y="32" width="80" height="26" rx="8" fill={C.accent} stroke={C.outline} strokeWidth="1.5" />
          <rect x="340" y="32" width="80" height="26" rx="8" fill={C.accent} stroke={C.outline} strokeWidth="1.5" />
          {/* Assise */}
          <path d="M25 165 L455 165 L465 235 L15 235 Z" fill="url(#bodyGrad)" stroke={C.outline} strokeWidth="2" />
          {/* Coutures verticales (capitonnage) */}
          {[80, 110, 220, 250, 360, 390].map((x) => (
            <line key={x} x1={x} y1="75" x2={x} y2="155" stroke={C.outlineSoft} strokeWidth="0.6" opacity="0.5" />
          ))}
          {/* Ceintures */}
          <line x1="80" y1="55" x2="80" y2="165" stroke={C.outlineSoft} strokeWidth="1.5" />
          <line x1="400" y1="55" x2="400" y2="165" stroke={C.outlineSoft} strokeWidth="1.5" />
        </g>
      );

    /* ============= 8. SIÈGE AVANT ============= */
    case "siege_avant":
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Volant en haut (perspective conducteur) */}
          <ellipse cx="120" cy="40" rx="55" ry="14" fill="none" stroke={C.outline} strokeWidth="2.5" />
          <line x1="65" y1="40" x2="175" y2="40" stroke={C.outline} strokeWidth="2" />
          {/* Tableau de bord central */}
          <rect x="180" y="25" width="120" height="40" rx="6" fill={C.accent} opacity="0.85" stroke={C.outline} strokeWidth="1.2" />
          <rect x="195" y="35" width="90" height="20" rx="3" fill="#1e293b" />
          {/* Siège conducteur */}
          <path d="M60 80 Q60 65 80 65 L165 65 Q185 65 185 80 L185 200 L55 200 Z" fill="url(#bodyGrad)" stroke={C.outline} strokeWidth="2" />
          <rect x="80" y="48" width="85" height="24" rx="8" fill={C.accent} stroke={C.outline} strokeWidth="1.5" />
          {/* Siège passager */}
          <path d="M295 80 Q295 65 315 65 L400 65 Q420 65 420 80 L420 200 L290 200 Z" fill="url(#bodyGrad)" stroke={C.outline} strokeWidth="2" />
          <rect x="315" y="48" width="85" height="24" rx="8" fill={C.accent} stroke={C.outline} strokeWidth="1.5" />
          {/* Console centrale */}
          <rect x="195" y="80" width="90" height="120" rx="10" fill={C.bodyDark} stroke={C.outline} strokeWidth="1.2" opacity="0.6" />
          {/* Capitonnage */}
          {[100, 140, 180].map((y) => (
            <g key={y}>
              <line x1="80" y1={y} x2="170" y2={y} stroke={C.outlineSoft} strokeWidth="0.5" opacity="0.4" />
              <line x1="310" y1={y} x2="400" y2={y} stroke={C.outlineSoft} strokeWidth="0.5" opacity="0.4" />
            </g>
          ))}
          {/* Assise globale */}
          <path d="M40 200 L440 200 L450 245 L30 245 Z" fill={C.bodyDark} opacity="0.5" />
        </g>
      );

    /* ============= 9. 3/4 AVANT DROITE ============= */
    case "trois_quart_avant_droite":
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          <path
            d="M440 195 L440 165 Q440 145 410 130 L350 95 Q260 75 160 95 L100 115 L55 145 L50 200 Z"
            fill="url(#bodyGrad)"
            stroke={C.outline}
            strokeWidth="2"
          />
          <path d="M345 105 Q260 88 175 108 L185 145 L335 145 Z" fill="url(#glassGrad)" stroke={C.outline} strokeWidth="1.4" />
          <path d="M440 165 Q420 145 350 145 L335 145 L335 175 L440 175 Z" fill="url(#glassGrad)" stroke={C.outline} strokeWidth="1.2" />
          <rect x="55" y="160" width="45" height="28" rx="3" fill={C.accent} stroke={C.outline} strokeWidth="1.2" />
          <ellipse cx="78" cy="148" rx="22" ry="9" fill={C.light} stroke={C.outline} strokeWidth="1.2" />
          <line x1="260" y1="150" x2="260" y2="225" stroke={C.outlineSoft} strokeWidth="1" />
          <line x1="175" y1="150" x2="175" y2="225" stroke={C.outlineSoft} strokeWidth="1" />
          <rect x="195" y="180" width="30" height="5" rx="2" fill={C.bodyDark} />
          <rect x="280" y="180" width="30" height="5" rx="2" fill={C.bodyDark} />
          <ellipse cx="325" cy="135" rx="9" ry="6" fill={C.bodyDark} stroke={C.outline} strokeWidth="1" />
          <path d="M50 225 L440 225 L430 245 L60 245 Z" fill={C.bodyDark} opacity="0.7" />
          <Wheel cx={360} cy={235} r={28} />
          <Wheel cx={125} cy={235} r={28} />
        </g>
      );

    /* ============= 10. 4 JANTES (gros plan) ============= */
    case "jantes":
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Quatre jantes disposées en grille */}
          {[
            { cx: 130, cy: 90 },
            { cx: 350, cy: 90 },
            { cx: 130, cy: 200 },
            { cx: 350, cy: 200 },
          ].map((p, i) => (
            <g key={i}>
              {/* Pneu */}
              <circle cx={p.cx} cy={p.cy} r="55" fill={C.tire} stroke={C.outline} strokeWidth="2" />
              {/* Jante */}
              <circle cx={p.cx} cy={p.cy} r="38" fill="url(#rimGrad)" stroke={C.outlineSoft} strokeWidth="1.2" />
              {/* Branches */}
              {[0, 60, 120, 180, 240, 300].map((a) => {
                const rad = (a * Math.PI) / 180;
                return (
                  <line
                    key={a}
                    x1={p.cx}
                    y1={p.cy}
                    x2={p.cx + Math.cos(rad) * 35}
                    y2={p.cy + Math.sin(rad) * 35}
                    stroke={C.rimDark}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                );
              })}
              <circle cx={p.cx} cy={p.cy} r="6" fill={C.outline} />
              {/* Étiquette position */}
              <text x={p.cx} y={p.cy - 65} textAnchor="middle" fontSize="11" fontWeight="700" fill={C.ink}>
                {i === 0 ? "AV-G" : i === 1 ? "AV-D" : i === 2 ? "AR-G" : "AR-D"}
              </text>
            </g>
          ))}
        </g>
      );

    /* ============= 11. COMPTEUR ============= */
    case "compteur":
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Bord tableau de bord */}
          <rect x="35" y="40" width="410" height="200" rx="22" fill={C.accent} stroke={C.outline} strokeWidth="2" />
          <rect x="50" y="55" width="380" height="170" rx="14" fill="#1e293b" />
          {/* Cadran principal (km/h) */}
          <circle cx="160" cy="140" r="78" fill="#020617" stroke={C.outlineSoft} strokeWidth="2" />
          <circle cx="160" cy="140" r="68" fill="none" stroke={C.outlineSoft} strokeWidth="0.6" opacity="0.5" />
          {/* Graduations km/h */}
          {Array.from({ length: 13 }).map((_, i) => {
            const a = -135 + i * (270 / 12);
            const rad = (a * Math.PI) / 180;
            return (
              <line
                key={i}
                x1={160 + Math.cos(rad) * 60}
                y1={140 + Math.sin(rad) * 60}
                x2={160 + Math.cos(rad) * 70}
                y2={140 + Math.sin(rad) * 70}
                stroke={C.rim}
                strokeWidth="2"
              />
            );
          })}
          {/* Aiguille */}
          <line x1="160" y1="140" x2="200" y2="100" stroke="#ef4444" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="160" cy="140" r="7" fill={C.rim} stroke={C.outline} strokeWidth="1.5" />
          <text x="160" y="195" textAnchor="middle" fontSize="11" fill={C.rim} fontWeight="600">km/h</text>
          {/* Cadran secondaire (carburant) */}
          <circle cx="320" cy="140" r="65" fill="#020617" stroke={C.outlineSoft} strokeWidth="2" />
          {/* Marquages E / F */}
          <text x="265" y="160" fontSize="13" fill="#facc15" fontWeight="700">E</text>
          <text x="370" y="160" fontSize="13" fill="#22c55e" fontWeight="700">F</text>
          <line x1="320" y1="140" x2="290" y2="115" stroke="#facc15" strokeWidth="3" strokeLinecap="round" />
          <circle cx="320" cy="140" r="6" fill={C.rim} />
          <text x="320" y="195" textAnchor="middle" fontSize="10" fill={C.rim} fontWeight="600">CARBURANT</text>
          {/* Écran central kilométrage */}
          <rect x="180" y="220" width="120" height="14" rx="3" fill="#0f172a" stroke={C.outlineSoft} strokeWidth="0.8" />
          <text x="240" y="231" textAnchor="middle" fontSize="10" fill="#22c55e" fontFamily="monospace">123 456 km</text>
        </g>
      );

    /* ============= 12. KIT SÉCURITÉ ============= */
    case "kit_securite":
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Gilet jaune */}
          <path d="M70 80 L150 80 L165 95 L185 95 L185 230 L70 230 Z" fill={C.yellowVest} stroke={C.outline} strokeWidth="2" />
          {/* Encolure */}
          <path d="M150 80 L130 110 L70 110" fill={C.yellowVest} stroke={C.outline} strokeWidth="1.5" />
          {/* Fermeture */}
          <line x1="127" y1="110" x2="127" y2="230" stroke={C.outline} strokeWidth="1.2" />
          {/* Bandes réfléchissantes */}
          <rect x="78" y="155" width="100" height="10" fill="#cbd5e1" stroke={C.outlineSoft} strokeWidth="0.6" />
          <rect x="78" y="195" width="100" height="10" fill="#cbd5e1" stroke={C.outlineSoft} strokeWidth="0.6" />
          {/* Triangle de signalisation */}
          <path d="M340 75 L420 230 L260 230 Z" fill={C.paper} stroke={C.triangleRed} strokeWidth="6" strokeLinejoin="round" />
          <path d="M340 110 L405 222 L275 222 Z" fill={C.triangleRed} stroke="#7f1d1d" strokeWidth="2" />
          <path d="M340 138 L388 215 L292 215 Z" fill={C.paper} />
          {/* Pied du triangle */}
          <line x1="280" y1="232" x2="400" y2="232" stroke={C.outline} strokeWidth="2" />
        </g>
      );

    /* ============= 13. CÂBLE DE RECHARGE ============= */
    case "cable":
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Trappe véhicule */}
          <rect x="40" y="80" width="140" height="120" rx="10" fill="url(#bodyGrad)" stroke={C.outline} strokeWidth="2" />
          {/* Indicateur électrique */}
          <path d="M75 100 L85 130 L75 130 L85 160" stroke="#22c55e" strokeWidth="3" fill="none" strokeLinecap="round" />
          {/* Prise véhicule (Type 2) */}
          <circle cx="115" cy="140" r="32" fill={C.accent} stroke={C.outline} strokeWidth="2" />
          <circle cx="115" cy="140" r="24" fill="#1e293b" stroke={C.outlineSoft} strokeWidth="1.2" />
          {/* Plots prise */}
          {[
            { dx: -8, dy: -10 }, { dx: 8, dy: -10 },
            { dx: -10, dy: 4 }, { dx: 0, dy: 4 }, { dx: 10, dy: 4 },
            { dx: -6, dy: 14 }, { dx: 6, dy: 14 },
          ].map((p, i) => (
            <circle key={i} cx={115 + p.dx} cy={140 + p.dy} r="3" fill={C.rim} />
          ))}
          {/* Câble */}
          <path d="M147 140 Q230 100 310 155 Q360 185 400 145" fill="none" stroke="#1e293b" strokeWidth="14" strokeLinecap="round" />
          <path d="M147 140 Q230 100 310 155 Q360 185 400 145" fill="none" stroke="#475569" strokeWidth="9" strokeLinecap="round" />
          {/* Borne de recharge */}
          <rect x="395" y="80" width="55" height="160" rx="10" fill={C.body} stroke={C.outline} strokeWidth="2" />
          <rect x="403" y="95" width="40" height="50" rx="4" fill="#1e293b" stroke={C.outlineSoft} strokeWidth="1" />
          {/* LED */}
          <circle cx="423" cy="170" r="6" fill="#22c55e" />
          <circle cx="423" cy="170" r="3" fill="#bbf7d0" />
          {/* Logo éclair */}
          <path d="M420 195 L415 215 L425 215 L420 230" stroke={C.paper} strokeWidth="2" fill="none" />
        </g>
      );

    /* ============= 14. DOCUMENTS / PV ============= */
    case "documents":
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Pochette en arrière-plan */}
          <rect x="100" y="55" width="220" height="200" rx="6" fill={C.body} stroke={C.outline} strokeWidth="1.5" opacity="0.6" />
          {/* Document principal */}
          <rect x="120" y="40" width="220" height="200" rx="6" fill={C.paper} stroke={C.outline} strokeWidth="2" />
          {/* En-tête */}
          <rect x="135" y="55" width="190" height="30" rx="3" fill={C.accent} />
          <rect x="145" y="63" width="110" height="5" rx="1" fill={C.paper} opacity="0.9" />
          <rect x="145" y="73" width="70" height="4" rx="1" fill={C.paper} opacity="0.6" />
          {/* Lignes de texte */}
          {[105, 120, 135, 150, 170, 185, 200].map((y, i) => (
            <rect key={i} x="135" y={y} width={i % 2 ? 160 : 190} height="4" rx="1" fill={C.outlineSoft} opacity="0.4" />
          ))}
          {/* Cases à cocher */}
          <rect x="135" y="218" width="10" height="10" rx="1" fill="none" stroke={C.outline} strokeWidth="1.2" />
          <path d="M137 223 L141 227 L147 219" stroke="#16a34a" strokeWidth="2" fill="none" />
          <rect x="155" y="220" width="80" height="6" rx="1" fill={C.outlineSoft} opacity="0.5" />
          {/* Trombone */}
          <path d="M325 50 Q345 50 345 70 L345 130 Q345 145 330 145 Q318 145 318 132 L318 75" fill="none" stroke={C.outlineSoft} strokeWidth="2" />
          {/* Stylo en diagonale */}
          <g transform="translate(330,180) rotate(35)">
            <rect x="0" y="-3" width="80" height="6" rx="2" fill={C.accent} stroke={C.outline} strokeWidth="1" />
            <path d="M80 -3 L92 0 L80 3 Z" fill={C.accent} stroke={C.outline} strokeWidth="1" />
            <rect x="0" y="-3" width="14" height="6" fill="#fbbf24" />
          </g>
        </g>
      );

    /* ============= 15. SIGNATURE ============= */
    case "signature":
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Tablette */}
          <rect x="50" y="40" width="380" height="200" rx="18" fill="#0f172a" stroke={C.outline} strokeWidth="2" />
          {/* Bord intérieur */}
          <rect x="60" y="50" width="360" height="180" rx="10" fill="#020617" />
          {/* Écran blanc */}
          <rect x="70" y="60" width="340" height="160" rx="6" fill={C.paper} />
          {/* Header zone signature */}
          <rect x="70" y="60" width="340" height="22" fill={C.accent} />
          <text x="240" y="76" textAnchor="middle" fontSize="11" fill={C.paper} fontWeight="700" letterSpacing="2">
            SIGNATURE CLIENT
          </text>
          {/* Ligne en bas */}
          <line x1="100" y1="195" x2="380" y2="195" stroke={C.outlineSoft} strokeWidth="1" strokeDasharray="3 3" />
          <text x="240" y="212" textAnchor="middle" fontSize="9" fill={C.outlineSoft}>
            Signez ci-dessus
          </text>
          {/* Trace de signature stylisée */}
          <path
            d="M110 165 Q135 130 160 160 Q180 185 205 145 Q225 120 250 158 Q270 180 295 140 Q320 110 350 162 Q365 180 380 165"
            stroke={C.accent}
            strokeWidth="3.5"
            fill="none"
            strokeLinecap="round"
          />
          {/* Stylet */}
          <g transform="translate(360,90) rotate(40)">
            <rect x="0" y="-3" width="60" height="6" rx="2" fill={C.bodyDark} stroke={C.outline} strokeWidth="1" />
            <path d="M60 -3 L72 0 L60 3 Z" fill={C.outline} />
          </g>
        </g>
      );

    default:
      return null;
  }
}
