/**
 * Validation stricte des liens de paiement externes (Qonto, Revolut, SumUp…).
 *
 * Un lien collé par un admin est affiché dans un e-mail client et sur la page
 * publique tokenisée : il doit donc être vérifié avant tout usage.
 *
 * Règles appliquées :
 *  - schéma https uniquement (pas de http, javascript:, data:, blob:…) ;
 *  - pas d'identifiants dans l'URL (user:password@) ;
 *  - hôte réel : pas d'IP, pas de localhost, pas d'hôte interne (.local, .internal) ;
 *  - port par défaut uniquement (443) ;
 *  - domaine appartenant à la liste blanche des prestataires de paiement ;
 *  - longueur bornée et caractères de contrôle interdits ;
 *  - sérialisation normalisée (hash retiré, encodage canonique).
 */

/** Domaines (et sous-domaines) de prestataires de paiement autorisés. */
export const PAYMENT_LINK_ALLOWED_HOSTS = [
  'qonto.com',
  'qonto.eu',
  'revolut.com',
  'revolut.me',
  'stripe.com',
  'sumup.com',
  'sumup.me',
  'paypal.com',
  'paypal.me',
  'lydia-app.com',
  'lyf.eu',
  'mollie.com',
  'gocardless.com',
  'payplug.com',
  'monetico-paiement.fr',
  'systempay.fr',
  'paybox.com',
  'lcl.fr',
  'creditmutuel.fr',
  'ca-paiement.fr',
  'bnpparibas.net',
  'societegenerale.fr',
  'shine.fr',
  'memo.bank',
  'wise.com',
] as const

const MAX_LENGTH = 512

export type PaymentLinkCheck =
  | { ok: true; url: string }
  | { ok: false; reason: string }

function hostAllowed(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '')
  return PAYMENT_LINK_ALLOWED_HOSTS.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`),
  )
}

/** Valide un lien de paiement et renvoie une raison lisible en cas de refus. */
export function checkPaymentLink(input?: string | null): PaymentLinkCheck {
  const raw = String(input ?? '').trim()
  if (!raw) return { ok: false, reason: 'Lien vide.' }
  if (raw.length > MAX_LENGTH) return { ok: false, reason: 'Lien trop long (512 caractères max).' }
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\s]/.test(raw)) {
    return { ok: false, reason: 'Le lien contient des caractères interdits.' }
  }

  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return { ok: false, reason: 'URL illisible.' }
  }

  if (u.protocol !== 'https:') return { ok: false, reason: 'Seuls les liens https sont acceptés.' }
  if (u.username || u.password) {
    return { ok: false, reason: "Le lien ne doit pas contenir d'identifiants." }
  }
  if (u.port && u.port !== '443') return { ok: false, reason: 'Port non autorisé.' }

  const host = u.hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.localhost') ||
    /^\[?[0-9a-f:]*:[0-9a-f:]*\]?$/i.test(host) ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(host)
  ) {
    return { ok: false, reason: 'Hôte non autorisé.' }
  }
  if (!host.includes('.')) return { ok: false, reason: 'Nom de domaine invalide.' }

  if (!hostAllowed(host)) {
    return {
      ok: false,
      reason: `Domaine non autorisé (${host}). Utilisez un prestataire de paiement reconnu : Qonto, Revolut, SumUp, Stripe, PayPal…`,
    }
  }

  u.hash = ''
  u.username = ''
  u.password = ''
  return { ok: true, url: u.toString() }
}

/** Renvoie l'URL normalisée si elle est sûre, sinon null. */
export function sanitizePaymentUrl(input?: string | null): string | null {
  const res = checkPaymentLink(input)
  return res.ok ? res.url : null
}
