/**
 * Consentement cookies (RGPD / CNIL).
 * - Choix persisté 13 mois dans un cookie technique + miroir localStorage.
 * - Aucun script de mesure/personnalisation n'est chargé avant consentement.
 */

export interface CookieConsent {
  essentiels: true;
  audience: boolean;
  personnalisation: boolean;
  /** Date ISO du choix */
  date: string;
  version: number;
}

export const CONSENT_VERSION = 1;
const COOKIE_NAME = "tlg_cookie_consent";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 395; // ~13 mois
export const CONSENT_EVENT = "tlg:cookie-consent";
export const OPEN_PREFS_EVENT = "tlg:open-cookie-prefs";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function writeCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
}

export function getConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  const raw = readCookie(COOKIE_NAME) ?? window.localStorage.getItem(COOKIE_NAME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CookieConsent;
    if (!parsed || parsed.version !== CONSENT_VERSION) return null;
    return { ...parsed, essentiels: true };
  } catch {
    return null;
  }
}

export function saveConsent(choice: { audience: boolean; personnalisation: boolean }): CookieConsent {
  const consent: CookieConsent = {
    essentiels: true,
    audience: choice.audience,
    personnalisation: choice.personnalisation,
    date: new Date().toISOString(),
    version: CONSENT_VERSION,
  };
  const raw = JSON.stringify(consent);
  writeCookie(COOKIE_NAME, raw);
  try {
    window.localStorage.setItem(COOKIE_NAME, raw);
  } catch {
    /* storage indisponible (navigation privée) */
  }
  applyConsent(consent);
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: consent }));
  return consent;
}

export function openCookiePreferences() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_PREFS_EVENT));
}

/** Charge (ou non) les scripts tiers selon le consentement. */
export function applyConsent(consent: CookieConsent) {
  if (typeof window === "undefined") return;
  const w = window as unknown as Record<string, unknown>;
  w["tlgConsent"] = consent;

  if (consent.audience) {
    // Placeholder : point d'entrée unique pour un futur script de mesure d'audience.
    // Aucun script tiers n'est injecté tant que ce bloc n'est pas complété.
    w["tlgAudienceEnabled"] = true;
  } else {
    w["tlgAudienceEnabled"] = false;
  }
  w["tlgPersonnalisationEnabled"] = consent.personnalisation;
}
