/**
 * Source unique de l'identité visuelle Transports Ligneo.
 *
 * Tout support (email, PDF, SMS, page web) doit référencer ces constantes :
 * une mise à jour du logo ou de la bannière se propage alors partout,
 * sans jamais recréer l'en-tête en CSS ou en texte.
 */
import ligneoLogoSquare from "@/assets/logo-transports-ligneo-officiel.png";
import brandBanner from "@/assets/mobile-header-ligneo.jpg.asset.json";

/** Origine publique du site (utilisée pour les URLs absolues des emails). */
export const LIGNEO_SITE_ORIGIN = "https://www.transportsligneo.fr";

/** Logo carré officiel (import bundler — usage PDF / app). */
export const LIGNEO_BRAND_LOGO = ligneoLogoSquare;

/** Bannière officielle (navy + logo + wordmark) — chemin relatif CDN. */
export const LIGNEO_BRAND_BANNER_PATH = brandBanner.url;

/** Bannière officielle en URL absolue (emails, services externes). */
export const LIGNEO_BRAND_BANNER_URL = `${LIGNEO_SITE_ORIGIN}${brandBanner.url}`;

/** Sender ID SMS (si le fournisseur autorise un expéditeur personnalisé). */
export const LIGNEO_SMS_SENDER_ID = "Ligneo";

/** QR code "Avis Google" (bloc pied de page des emails clients). */
import qrAvisGoogle from "@/assets/qr-avis-google.png.asset.json";
export const LIGNEO_QR_AVIS_GOOGLE_URL = `${LIGNEO_SITE_ORIGIN}${qrAvisGoogle.url}`;

/** Logo carré officiel en URL absolue (emails). */
export const LIGNEO_LOGO_SQUARE_URL = `${LIGNEO_SITE_ORIGIN}/logo-ligneo.png`;

/** Lien public de dépôt d'avis Google (surchargeable via templateData.avisUrl). */
export const LIGNEO_GOOGLE_REVIEW_URL =
  "https://www.google.com/maps/search/?api=1&query=Transports%20Ligneo%20Tours";
