import logoDriver from "@/assets/logo-driver.png.asset.json";

/**
 * Mini-scènes animées (≈3 s) de l'annonce de la navbar : elles reprennent les vrais éléments du site
 * (devis, facture, appli convoyeur, carte de suivi, code de livraison, LinkedIn, API).
 * Chaque scène est relancée à chaque changement d'annonce (clé React côté parent).
 */
export const SCENE_KINDS = ["quote", "invoice", "driver", "wheel", "gps", "code", "linkedin", "api", "shield", "photo", "verified", "google", "plate"] as const;
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
    case "shield":
      return (
        <svg className="tns" viewBox="0 0 86 56" width="86" height="56" aria-hidden="true">
          <circle className="tns-halo" cx="43" cy="26" r="17" fill="none" stroke="#5eead4" strokeWidth="1.4" />
          <path className="tns-pop" d="M43 4 63 11.5v14c0 11-8 19.4-20 24.5C31 45 23 36.5 23 25.5v-14z" fill="url(#tnsShieldG)" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
          <defs><linearGradient id="tnsShieldG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#22d3ee" /><stop offset="1" stopColor="#2563eb" /></linearGradient></defs>
          <path className="tns-check" d="m33.5 27 7 7 13-14.5" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" pathLength="100" />
          <g className="tns-fade tns-d3"><rect x="48" y="38" width="34" height="13" rx="6.5" fill="#0b1a4d" stroke="#5eead4" strokeWidth="1" /><text x="65" y="47.2" textAnchor="middle" fontSize="5.4" fontWeight="800" fill="#5eead4" fontFamily={SANS}>Assuré</text></g>
          <g className="tns-rise tns-d4"><g transform="translate(2 40)">{<path d="M2 8.5V6.2c0-.7.4-1.3 1-1.5l3-1.2C7 3 7.8 2 9 2h4c1.2 0 2 .6 2.7 1.5L18 5l2 .6c.6.2 1 .7 1 1.4v1.5c0 .5-.4 1-1 1H2.8c-.4 0-.8-.4-.8-.8z" fill="#fff" />}<circle cx="6" cy="9.4" r="1.9" fill="#0b1a4d" stroke="#fff" strokeWidth="1" /><circle cx="16" cy="9.4" r="1.9" fill="#0b1a4d" stroke="#fff" strokeWidth="1" /></g></g>
          <circle className="tns-spark" cx="68" cy="9" r="2" fill="#fff" /><circle className="tns-spark tns-d2" cx="16" cy="14" r="1.6" fill="#fff" />
        </svg>
      );
    case "photo":
      return (
        <svg className="tns" viewBox="0 0 86 56" width="86" height="56" aria-hidden="true">
          <rect className="tns-pop" x="3" y="3" width="80" height="50" rx="8" fill="#1b0f3a" stroke="rgba(255,255,255,.3)" strokeWidth="1" />
          <path className="tns-fade" d="M18 33c0-3 1.5-5 4-6l6-3c2-1.8 4-2.8 7-2.8h10c3 0 5 1 7 3l4 2.8 6 1.2c2.5.5 4 2.2 4 4.8V37H18z" fill="#cbd5e1" />
          <path className="tns-fade" d="m31 24 3-3.5h12l5 3.5z" fill="#7dd3fc" />
          <circle className="tns-fade" cx="29" cy="37" r="5" fill="#0f172a" stroke="#cbd5e1" strokeWidth="2" /><circle className="tns-fade" cx="62" cy="37" r="5" fill="#0f172a" stroke="#cbd5e1" strokeWidth="2" />
          <path className="tns-focus" d="M10 15V10h5M71 10h5v5M76 41v5h-5M15 46h-5v-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" />
          <rect className="tns-flash" x="3" y="3" width="80" height="50" rx="8" fill="#fff" />
          <g className="tns-stamp tns-d3"><rect x="52" y="6" width="26" height="10" rx="5" fill="#ec4899" /><text x="65" y="13.2" textAnchor="middle" fontSize="5.6" fontWeight="800" fill="#fff" fontFamily={SANS}>360°</text></g>
          <g className="tns-rise tns-d4"><rect x="14" y="43" width="22" height="7" rx="3.5" fill="rgba(255,255,255,.18)" /><text x="25" y="48.3" textAnchor="middle" fontSize="4.2" fontWeight="700" fill="#fff" fontFamily={MONO}>14:32:07</text></g>
          <g className="tns-stamp tns-d4"><circle cx="70" cy="44" r="6.5" fill="#22c55e" stroke="#fff" strokeWidth="1.5" /><path d="m66.8 44.2 2.2 2.2 4-4.4" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></g>
        </svg>
      );
    case "verified":
      return (
        <svg className="tns" viewBox="0 0 86 56" width="86" height="56" aria-hidden="true">
          <g className="tns-pop"><rect x="3" y="4" width="80" height="48" rx="7" fill="#fff" /><rect x="3" y="4" width="80" height="10" rx="7" fill="#16a34a" /><rect x="3" y="9" width="80" height="5" fill="#16a34a" /><text x="9" y="11.6" fontSize="5" fontWeight="800" fill="#fff" fontFamily={SANS} letterSpacing=".5">CONVOYEUR LIGNEO</text></g>
          <g className="tns-rise tns-d1"><circle cx="17" cy="27" r="7.5" fill="#dbeafe" /><circle cx="17" cy="24.5" r="3" fill="#2563eb" /><path d="M10.5 34c1-4 3.5-5.5 6.5-5.5s5.5 1.5 6.5 5.5" fill="#2563eb" /></g>
          {[["Identité", 21], ["Formé", 28.5], ["Assuré", 36]].map(([t, y], i) => (
            <g key={t as string}>
              <text className={`tns-fade tns-r${i}`} x="31" y={(y as number) + 1.8} fontSize="5.2" fontWeight="700" fill="#334155" fontFamily={SANS}>{t}</text>
              <g className={`tns-stamp tns-r${i}`}><circle cx="74" cy={y as number} r="4" fill="#22c55e" /><path d={`m72 ${y} 1.4 1.4 2.8-3`} stroke="#fff" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></g>
            </g>
          ))}
          <g className="tns-stamp tns-d4"><rect x="8" y="42.500" width="72" height="8" rx="4" fill="#16a34a" /><text x="44" y="48.300" textAnchor="middle" fontSize="5" fontWeight="800" fill="#fff" fontFamily={SANS}>✓ VÉRIFIÉ</text></g>
        </svg>
      );
    case "google":
      return (
        <svg className="tns" viewBox="0 0 86 56" width="86" height="56" aria-hidden="true">
          <rect className="tns-pop" x="2" y="3" width="82" height="50" rx="10" fill="#fff" />
          <g transform="translate(8 8) scale(.62)">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
            <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
          </g>
          <text className="tns-score" x="62" y="25" textAnchor="middle" fontSize="16" fontWeight="800" fill="#0f172a" fontFamily={SANS}>4,8</text>
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i} transform={`translate(${41 + i * 8.6} 40) scale(1.35)`}><path className={`tns-gstar tns-gstar--${i}`} d="m0-4.2 1.2 2.6 2.8.3-2.1 1.9.6 2.8L0 1.9-2.5 3.4l.6-2.8L-4-1.3l2.8-.3z" fill="#fbbc04" /></g>
          ))}
          <g className="tns-slam tns-d4"><rect x="8" y="45" width="30" height="6" rx="3" fill="#e8f0fe" /><text x="23" y="49.6" textAnchor="middle" fontSize="3.8" fontWeight="800" fill="#1a73e8" fontFamily={SANS}>Avis vérifiés</text></g>
        </svg>
      );
    case "plate":
      return (
        <svg className="tns" viewBox="0 0 86 56" width="86" height="56" aria-hidden="true">
          <g className="tns-pop">
            <rect x="4" y="5" width="56" height="20" rx="4.5" fill="#fff" stroke="#cbd5e1" strokeWidth="1" />
            <path d="M4 9.5a4.5 4.5 0 0 1 4.5-4.5H13v20H8.5A4.5 4.5 0 0 1 4 20.5z" fill="#1d4ed8" />
            <text x="8.5" y="17.5" textAnchor="middle" fontSize="5" fontWeight="800" fill="#fde047" fontFamily={SANS}>F</text>
          </g>
          <g className="tns-type"><text x="36" y="19.5" textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#0f172a" fontFamily={MONO} textLength="40" lengthAdjust="spacingAndGlyphs">AB-123-CD</text></g>
          <g className="tns-lens"><circle cx="66" cy="14" r="6.5" fill="rgba(255,255,255,.2)" stroke="#fff" strokeWidth="2.5" /><path d="m71 19 6 6" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" /></g>
          {[["Marque", "Renault", 33], ["Modèle", "Clio V", 40], ["Énergie", "Essence", 47]].map(([k, v, y], i) => (
            <g key={k as string} className={`tns-rise tns-r${i}`} style={{ animationDelay: `${1.3 + i * 0.35}s` }}>
              <rect x="4" y={(y as number) - 5} width="78" height="6.5" rx="3.25" fill="rgba(255,255,255,.14)" />
              <text x="9" y={(y as number) - 0.6} fontSize="3.8" fontWeight="700" fill="#cfe0ff" fontFamily={SANS}>{k}</text>
              <text x="78" y={(y as number) - 0.6} textAnchor="end" fontSize="4.2" fontWeight="800" fill="#fff" fontFamily={SANS}>{v}</text>
              <circle cx="75" cy={(y as number) - 1.8} r="0" fill="#22c55e" />
            </g>
          ))}
        </svg>
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
