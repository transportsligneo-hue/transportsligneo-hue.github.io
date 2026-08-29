/**
 * Signature publique d'un devis (sans compte) via lien tokenisé + code OTP.
 *
 * Sécurité :
 *  - le devis n'est accessible que par son `public_token` (24 octets aléatoires) ;
 *  - le code à 6 chiffres n'est jamais journalisé ni renvoyé au client :
 *    seul son SHA-256 est stocké ;
 *  - 10 minutes de validité, usage unique, 5 tentatives, 3 renvois / 10 min.
 */
import { supabaseAdmin } from '@/integrations/supabase/client.server'

export const CGV_VERSION = 'v1-2026-01'
export const CODE_TTL_MINUTES = 10
export const MAX_ATTEMPTS = 5
export const RESEND_LIMIT_PER_WINDOW = 3
export const RESEND_WINDOW_MINUTES = 10

export function generateCode(): string {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return String(buf[0]! % 1_000_000).padStart(6, '0')
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split('@')
  if (!domain || !user) return email
  const shown = user.slice(0, Math.min(2, user.length))
  return `${shown}${'*'.repeat(Math.max(1, user.length - shown.length))}@${domain}`
}

/** 07 82 XX XX 81 */
export function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, '')
  if (d.length < 6) return '••'
  return `${d.slice(0, 4)} XX XX ${d.slice(-2)}`
}

export function isValidPhone(phone?: string | null): boolean {
  if (!phone) return false
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 15
}

export const PUBLIC_SITE_URL =
  (process.env['PUBLIC_SITE_URL'] || 'https://transportsligneo.fr').replace(/\/$/, '')

export function devisPublicUrl(token: string): string {
  return `${PUBLIC_SITE_URL}/devis/${token}`
}

const DEVIS_FIELDS =
  'id, numero, statut, prenom, nom, email, depart, arrivee, distance_km, prix_estime, avoir_applique, option_trajet, date_souhaitee, locked_at, accepted_at, paid_at, expires_at, refused_at, contact_depart_tel, contact_arrivee_tel, version, public_token, lien_paiement_externe'

export type PublicDevis = {
  id: string
  numero: string
  statut: string
  prenom: string | null
  nom: string | null
  email: string | null
  depart: string
  arrivee: string
  distance_km: number | null
  prix_estime: number
  avoir_applique: number | null
  option_trajet: string | null
  date_souhaitee: string | null
  locked_at: string | null
  accepted_at: string | null
  paid_at: string | null
  expires_at: string | null
  refused_at: string | null
  contact_depart_tel: string | null
  contact_arrivee_tel: string | null
  version: number | null
  public_token: string
  lien_paiement_externe?: string | null
}

export async function loadDevisByToken(token: string): Promise<PublicDevis | null> {
  if (!/^[0-9a-f]{16,128}$/i.test(token)) return null
  const { data } = await supabaseAdmin
    .from('devis')
    .select(DEVIS_FIELDS)
    .eq('public_token', token)
    .maybeSingle()
  return (data as PublicDevis | null) ?? null
}

/** Vue publique : uniquement les champs nécessaires à l'affichage. */
export function toPublicView(d: PublicDevis) {
  const avoir = Number(d.avoir_applique ?? 0)
  return {
    numero: d.numero,
    statut: d.statut,
    prenom: d.prenom,
    nom: d.nom,
    depart: d.depart,
    arrivee: d.arrivee,
    distanceKm: d.distance_km,
    optionTrajet: d.option_trajet,
    dateSouhaitee: d.date_souhaitee,
    prix: Number(d.prix_estime),
    avoir,
    aRegler: Math.max(Number(d.prix_estime) - avoir, 0),
    signed: !!d.locked_at,
    signedAt: d.locked_at,
    paid: !!d.paid_at,
    refused: !!d.refused_at,
    expiresAt: d.expires_at,
    maskedEmail: d.email ? maskEmail(d.email) : null,
    maskedPhone: isValidPhone(d.contact_depart_tel) ? maskPhone(d.contact_depart_tel!) : null,
    lienPaiementExterne: sanitizePaymentLink(d.lien_paiement_externe),
  }
}

/** N'accepte qu'une URL https (Qonto, Revolut, banque…) pour éviter toute injection de lien. */
export function sanitizePaymentLink(input?: string | null): string | null {
  if (!input) return null
  try {
    const u = new URL(String(input).trim())
    return u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

export function pickPhone(d: PublicDevis): string | null {
  if (isValidPhone(d.contact_depart_tel)) return d.contact_depart_tel
  if (isValidPhone(d.contact_arrivee_tel)) return d.contact_arrivee_tel
  return null
}

export function isSignable(d: PublicDevis): { ok: boolean; reason?: string } {
  if (d.locked_at) return { ok: false, reason: 'Ce devis est déjà signé.' }
  if (d.refused_at || d.statut === 'refuse') return { ok: false, reason: 'Ce devis a été refusé.' }
  if (d.statut === 'expire') return { ok: false, reason: 'Ce devis est expiré.' }
  if (d.expires_at && new Date(d.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: 'Ce devis est expiré.' }
  }
  return { ok: true }
}

/* -------------------------------------------------------------------------- */
/*  Envoi du code                                                             */
/* -------------------------------------------------------------------------- */
export async function sendPublicDevisOtp(
  d: PublicDevis,
  meta: { ip: string | null; userAgent: string | null },
): Promise<{ ok: true; method: 'sms' | 'email'; destination: string; ttlSeconds: number }> {
  const gate = isSignable(d)
  if (!gate.ok) throw new Error(gate.reason!)

  const since = new Date(Date.now() - RESEND_WINDOW_MINUTES * 60_000).toISOString()
  const { count } = await supabaseAdmin
    .from('devis_otp_challenges')
    .select('id', { count: 'exact', head: true })
    .eq('devis_id', d.id)
    .gte('created_at', since)
  if ((count ?? 0) >= RESEND_LIMIT_PER_WINDOW) {
    throw new Error(`Trop de codes envoyés. Réessayez dans ${RESEND_WINDOW_MINUTES} minutes.`)
  }

  const phone = pickPhone(d)
  const email = (d.email ?? '').toLowerCase() || null
  if (!phone && !email) throw new Error('Aucun contact disponible pour envoyer le code.')

  const code = generateCode()
  const codeHash = await sha256Hex(code)
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000)

  let method: 'sms' | 'email' = 'email'
  let destination = email ? maskEmail(email) : ''

  if (phone) {
    const { sendSms } = await import('@/lib/sms.server')
    const res = await sendSms({
      to: phone,
      from: 'LIGNEO',
      body: `Transports Ligneo — code de signature du devis ${d.numero} : ${code}. Valable ${CODE_TTL_MINUTES} min. Ne le partagez avec personne.`,
    })
    if (res.ok) {
      method = 'sms'
      destination = maskPhone(phone)
    }
  }

  if (method === 'email') {
    if (!email) throw new Error("Envoi du code impossible : SMS refusé et aucun e-mail disponible.")
    const { sendTransactionalEmailServer } = await import('@/server/email-send')
    const sent = await sendTransactionalEmailServer({
      templateName: 'devis-otp-code',
      recipientEmail: email,
      idempotencyKey: `devis-otp-pub-${d.id}-${Date.now()}`,
      templateData: {
        prenom: d.prenom ?? '',
        numero: d.numero,
        code,
        depart: d.depart,
        arrivee: d.arrivee,
        prix: Number(d.prix_estime).toFixed(2),
        validite: CODE_TTL_MINUTES,
      },
    })
    if (!sent.success) throw new Error('Envoi du code impossible, réessayez.')
    destination = maskEmail(email)
  }

  const { error } = await supabaseAdmin.from('devis_otp_challenges').insert({
    devis_id: d.id,
    client_user_id: null,
    email,
    phone,
    code_hash: codeHash,
    method: method === 'sms' ? 'sms' : 'email',
    max_attempts: MAX_ATTEMPTS,
    expires_at: expiresAt.toISOString(),
    ip_address: meta.ip,
    user_agent: meta.userAgent,
  })
  if (error) throw new Error('Création du code impossible.')

  return { ok: true, method, destination, ttlSeconds: CODE_TTL_MINUTES * 60 }
}

/* -------------------------------------------------------------------------- */
/*  Vérification + signature                                                  */
/* -------------------------------------------------------------------------- */
export async function verifyPublicDevisOtp(
  d: PublicDevis,
  code: string,
  meta: { ip: string | null; userAgent: string | null },
): Promise<{ ok: true; alreadySigned?: boolean; signedAt: string; requiresPayment: boolean }> {
  if (d.locked_at) {
    return { ok: true, alreadySigned: true, signedAt: d.locked_at, requiresPayment: !d.paid_at }
  }
  const gate = isSignable(d)
  if (!gate.ok) throw new Error(gate.reason!)

  const { data: challenge } = await supabaseAdmin
    .from('devis_otp_challenges')
    .select('id, code_hash, attempts, max_attempts, expires_at, created_at, method, phone, email')
    .eq('devis_id', d.id)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!challenge) throw new Error('Aucun code en cours, demandez un nouvel envoi.')
  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    throw new Error('Code expiré, demandez un nouvel envoi.')
  }
  if (challenge.attempts >= challenge.max_attempts) {
    throw new Error('Trop de tentatives. Demandez un nouveau code.')
  }

  const submitted = await sha256Hex(code)
  if (submitted !== challenge.code_hash) {
    await supabaseAdmin
      .from('devis_otp_challenges')
      .update({ attempts: challenge.attempts + 1 })
      .eq('id', challenge.id)
    const remaining = Math.max(0, challenge.max_attempts - (challenge.attempts + 1))
    throw new Error(
      remaining > 0
        ? `Code incorrect. ${remaining} tentative(s) restante(s).`
        : 'Trop de tentatives. Demandez un nouveau code.',
    )
  }

  const now = new Date()
  const nowIso = now.toISOString()
  const method = challenge.method === 'sms' ? 'sms_otp' : 'email_otp'
  const clientEmail = (d.email ?? challenge.email ?? '').toLowerCase() || 'non-renseigne@ligneo.fr'

  await supabaseAdmin
    .from('devis_otp_challenges')
    .update({ consumed_at: nowIso })
    .eq('id', challenge.id)

  await supabaseAdmin.from('devis_acceptations').insert({
    devis_id: d.id,
    devis_version: d.version ?? 1,
    client_user_id: null,
    client_email: clientEmail,
    ip_address: meta.ip,
    user_agent: meta.userAgent,
    montant_accepte: d.prix_estime,
    cgv_version: CGV_VERSION,
    statut: 'accepte',
    validation_method: method,
    otp_sent_at: challenge.created_at,
    otp_verified_at: nowIso,
  })

  await supabaseAdmin
    .from('devis')
    .update({ locked_at: nowIso, accepted_at: nowIso, statut: 'accepte' })
    .eq('id', d.id)

  const contactName = `${d.prenom ?? ''} ${d.nom ?? ''}`.trim() || clientEmail
  const canal = method === 'sms_otp' ? 'SMS' : 'Email'
  const masked =
    method === 'sms_otp' && challenge.phone
      ? ` (${maskPhone(challenge.phone)})`
      : challenge.email
        ? ` (${maskEmail(challenge.email)})`
        : ''
  const note = `Devis signé par ${contactName} le ${now.toLocaleString('fr-FR', {
    timeZone: 'Europe/Paris',
  })} via ${canal}${masked}`

  await supabaseAdmin.from('devis_status_history').insert({
    devis_id: d.id,
    old_statut: d.statut,
    new_statut: 'accepte',
    note,
  })

  try {
    await supabaseAdmin.rpc('create_admin_notification', {
      _type: 'devis',
      _titre: `Signature reçue — devis ${d.numero}`,
      _message: `${note} — ${Number(d.prix_estime).toFixed(2)} € TTC`,
      _link: `/admin/devis/${d.id}`,
      _entity_type: 'devis',
      _entity_id: d.id,

    } as never)
  } catch (e) {
    console.error('[devis-public] admin notification failed')
  }

  return {
    ok: true,
    signedAt: nowIso,
    requiresPayment: !d.paid_at && Math.max(Number(d.prix_estime) - Number(d.avoir_applique ?? 0), 0) >= 1,
  }
}
