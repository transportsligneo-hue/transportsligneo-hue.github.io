/**
 * Envoi des demandes d'avis Google (serveur uniquement).
 *
 * Utilisé par :
 *  - le panneau admin de la mission (envoi manuel, via google-review.functions.ts)
 *  - le job automatique X heures après la fin de mission (route cron publique)
 */
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { sendTransactionalEmailServer } from '@/server/email-send'
import { sendSms } from '@/lib/sms.server'
import { createShortLink } from '@/lib/short-links.server'

export type ReviewRecipientType = 'client' | 'contact_livraison'
export type ReviewChannel = 'email' | 'sms' | 'email+sms'

export interface GoogleReviewSettings {
  url: string
  auto_enabled: boolean
  delay_hours: number
  send_to_contact: boolean
  /** Canal par défaut : email, sms, email+sms */
  channel?: ReviewChannel
  /** Numéro Twilio expéditeur (E.164) ou sender ID alphabétique. */
  sms_from?: string
}

export const DEFAULT_REVIEW_SETTINGS: GoogleReviewSettings = {
  url: '',
  auto_enabled: false,
  delay_hours: 2,
  send_to_contact: true,
  channel: 'email',
  sms_from: 'Ligneo',
}

export async function getGoogleReviewSettings(): Promise<GoogleReviewSettings> {
  const { data } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('key', 'google_review')
    .maybeSingle()
  const v = (data as { value?: Partial<GoogleReviewSettings> } | null)?.value ?? {}
  return { ...DEFAULT_REVIEW_SETTINGS, ...v }
}

function isValidEmail(email?: string | null): email is string {
  return !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

function isValidPhone(phone?: string | null): boolean {
  if (!phone) return false
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 15
}

export interface SendReviewResult {
  ok: boolean
  error?: string
  recipientEmail?: string
  recipientPhone?: string
  channel?: ReviewChannel
}

interface RecipientInfo {
  email: string | null
  phone: string | null
  name: string | null
  prenom: string
}

function getRecipientInfo(trajet: any, recipientType: ReviewRecipientType): RecipientInfo {
  const isContact = recipientType === 'contact_livraison'
  const email = isContact ? trajet.arrivee_contact_email : trajet.client_email
  const phone = isContact
    ? trajet.arrivee_contact_telephone || trajet.arrivee_contact_telephone2 || trajet.contact_arrivee_tel
    : trajet.client_telephone || trajet.contact_depart_tel
  const name = isContact
    ? [trajet.arrivee_contact_prenom, trajet.arrivee_contact_nom].filter(Boolean).join(' ') || null
    : trajet.client_nom
  const prenom = (name ?? '').trim().split(' ')[0] || ''
  return { email, phone, name, prenom }
}

function buildSmsBody(prenomConvoyeur: string | null, shortUrl: string): string {
  const convoyeurPart = prenomConvoyeur
    ? ` par ${prenomConvoyeur}`
    : ' par notre convoyeur'
  return `Transports Ligneo - Bonjour, votre véhicule a bien été livré${convoyeurPart}. Si vous êtes satisfait, un avis nous aiderait beaucoup : ${shortUrl}`
}

async function ensureShortReviewUrl(reviewUrl: string): Promise<string> {
  if (reviewUrl.length <= 60) return reviewUrl
  return createShortLink(reviewUrl, 'avis-google')
}

async function sendReviewEmail(params: {
  attribution: any
  trajet: any
  recipient: RecipientInfo
  convoyeurLabel: string | null
  settings: GoogleReviewSettings
  auto?: boolean
}): Promise<{ success: boolean; reason?: string }> {
  const { attribution, trajet, recipient, convoyeurLabel, settings, auto } = params
  if (!isValidEmail(recipient.email)) {
    return { success: false, reason: 'Adresse email invalide ou manquante.' }
  }
  // Envoi automatique : idempotent (une seule fois par mission).
  // Renvoi manuel : clé unique pour contourner la déduplication et forcer un vrai nouvel envoi.
  const idempotencyKey = auto
    ? `avis-google-${attribution.id}-email`
    : `avis-google-${attribution.id}-email-${Date.now()}`
  try {
    const res = await sendTransactionalEmailServer({
      templateName: 'avis-google',
      recipientEmail: recipient.email.trim(),
      idempotencyKey,
      templateData: {
        prenom: recipient.prenom,
        numero: attribution.numero_mission ?? '',
        depart: trajet.depart,
        arrivee: trajet.arrivee,
        convoyeur: convoyeurLabel ?? '',
        reviewUrl: settings.url,
        isContactLivraison: false,
      },
    })
    if (res?.success) return { success: true }
    return { success: false, reason: res?.reason || "L'email n'a pas pu être mis en file d'envoi." }
  } catch (err) {
    return { success: false, reason: err instanceof Error ? err.message : 'Erreur email inconnue.' }
  }
}


async function sendReviewSms(params: {
  attribution: any
  recipient: RecipientInfo
  convoyeurLabel: string | null
  settings: GoogleReviewSettings
}): Promise<{ success: boolean; reason?: string }> {
  if (!isValidPhone(params.recipient.phone)) {
    return { success: false, reason: 'Téléphone invalide.' }
  }
  const shortUrl = await ensureShortReviewUrl(params.settings.url)
  const body = buildSmsBody(params.convoyeurLabel, shortUrl)
  const res = await sendSms({
    to: params.recipient.phone!,
    body,
    from: params.settings.sms_from || 'Ligneo',
  })
  return res.ok ? { success: true } : { success: false, reason: res.error }
}


async function recordReviewRequest(params: {
  attribution: any
  trajet: any
  recipientType: ReviewRecipientType
  recipient: RecipientInfo
  channel: ReviewChannel
  status: 'sent' | 'failed'
  auto?: boolean
  actorUserId?: string | null
  actorLabel?: string | null
}) {
  const { attribution, trajet, recipientType, recipient, channel, status, auto, actorUserId, actorLabel } = params
  await supabaseAdmin.from('mission_review_requests').upsert(
    {
      attribution_id: attribution.id,
      trajet_id: trajet.id,
      recipient_type: recipientType,
      recipient_email: recipient.email,
      recipient_phone: recipient.phone,
      recipient_name: recipient.name,
      channel,
      status,
      sent_at: new Date().toISOString(),
      auto: !!auto,
      created_by: actorUserId ?? null,
    } as never,
    { onConflict: 'attribution_id,recipient_type,channel' } as never,
  )

  if (status === 'sent') {
    await supabaseAdmin.rpc('log_activity', {
      _action: 'mission.avis_google_envoye',
      _entity_type: 'attribution',
      _entity_id: attribution.id,
      _metadata: {
        recipient_type: recipientType,
        channel,
        recipient_email: recipient.email,
        recipient_phone: recipient.phone,
        auto: !!auto,
        actor: actorLabel ?? (auto ? 'Automatique' : 'Admin'),
      },
    } as never)
  }
}

/** Envoie (ou ré-envoie) une demande d'avis Google pour une mission. */
export async function sendGoogleReviewRequestServer(params: {
  attributionId: string
  recipientType: ReviewRecipientType
  emailOverride?: string | null
  channel?: ReviewChannel
  auto?: boolean
  actorUserId?: string | null
  actorLabel?: string | null
}): Promise<SendReviewResult> {
  const settings = await getGoogleReviewSettings()
  if (!settings.url) {
    return { ok: false, error: "Aucun lien d'avis Google configuré dans Paramètres." }
  }

  const { data: attribution } = await supabaseAdmin
    .from('attributions')
    .select('id, trajet_id, convoyeur_id, numero_mission, statut')
    .eq('id', params.attributionId)
    .maybeSingle()
  if (!attribution) return { ok: false, error: 'Mission introuvable.' }

  const { data: trajet } = await supabaseAdmin
    .from('trajets')
    .select(
      'id, depart, arrivee, client_nom, client_email, client_telephone, arrivee_contact_nom, arrivee_contact_prenom, arrivee_contact_email, arrivee_contact_telephone, arrivee_contact_telephone2, contact_depart_tel, contact_arrivee_tel',
    )
    .eq('id', attribution.trajet_id)
    .maybeSingle()
  if (!trajet) return { ok: false, error: 'Trajet introuvable.' }

  let convoyeurLabel: string | null = null
  if (attribution.convoyeur_id) {
    const { data: c } = await supabaseAdmin
      .from('convoyeurs')
      .select('nom, prenom')
      .eq('id', attribution.convoyeur_id)
      .maybeSingle()
    if (c) convoyeurLabel = [c.prenom, c.nom ? `${String(c.nom).charAt(0)}.` : null].filter(Boolean).join(' ') || null
  }

  const recipient = getRecipientInfo(trajet, params.recipientType)
  if (params.emailOverride) recipient.email = params.emailOverride

  const channel = params.channel ?? settings.channel ?? 'email'

  const result: SendReviewResult = { ok: false, channel }

  if (channel === 'email' || channel === 'email+sms') {
    const emailRes = await sendReviewEmail({
      attribution,
      trajet,
      recipient,
      convoyeurLabel,
      settings,
      auto: params.auto,
    })
    if (emailRes.success) {
      await recordReviewRequest({
        attribution,
        trajet,
        recipientType: params.recipientType,
        recipient,
        channel: 'email',
        status: 'sent',
        auto: params.auto,
        actorUserId: params.actorUserId,
        actorLabel: params.actorLabel,
      })
      result.ok = true
      result.recipientEmail = recipient.email ?? undefined
    } else if (channel === 'email') {
      await recordReviewRequest({
        attribution,
        trajet,
        recipientType: params.recipientType,
        recipient,
        channel: 'email',
        status: 'failed',
        auto: params.auto,
        actorUserId: params.actorUserId,
        actorLabel: params.actorLabel,
      })
      result.error = emailRes.reason ?? "Échec de l'envoi email."
      return result
    }
  }

  if (channel === 'sms' || channel === 'email+sms') {
    const smsRes = await sendReviewSms({
      attribution,
      recipient,
      convoyeurLabel,
      settings,
    })
    if (smsRes.success) {
      await recordReviewRequest({
        attribution,
        trajet,
        recipientType: params.recipientType,
        recipient,
        channel: 'sms',
        status: 'sent',
        auto: params.auto,
        actorUserId: params.actorUserId,
        actorLabel: params.actorLabel,
      })
      result.ok = true
      result.recipientPhone = recipient.phone ?? undefined
      await bumpSmsCounter()
    } else if (channel === 'sms') {
      await recordReviewRequest({
        attribution,
        trajet,
        recipientType: params.recipientType,
        recipient,
        channel: 'sms',
        status: 'failed',
        auto: params.auto,
        actorUserId: params.actorUserId,
        actorLabel: params.actorLabel,
      })
      result.error = smsRes.reason ?? "Échec de l'envoi SMS."
      return result
    }
  }

  return result
}

async function bumpSmsCounter() {
  const month = new Date().toISOString().slice(0, 7)
  const key = `sms_sent_${month}`
  const { data } = await supabaseAdmin.from('app_settings').select('value').eq('key', key).maybeSingle()
  const current = typeof data?.value === 'number' ? data.value : 0
  await supabaseAdmin.from('app_settings').upsert({ key, value: current + 1 } as never, { onConflict: 'key' })
}

export async function getCurrentMonthSmsCount(): Promise<number> {
  const month = new Date().toISOString().slice(0, 7)
  const { data } = await supabaseAdmin.from('app_settings').select('value').eq('key', `sms_sent_${month}`).maybeSingle()
  return typeof data?.value === 'number' ? data.value : 0
}

/**
 * Déclenchement automatique à la livraison (fin de mission convoyeur).
 *
 * - Respecte les paramètres admin (activation, lien Google, contact livraison, canal).
 * - Anti-doublon : ne renvoie jamais si une demande existe déjà pour ce
 *   destinataire ET ce canal (manuelle, automatique ou déjà déclenchée par le cron).
 * - Si un délai > 0 est configuré, on laisse le job planifié faire l'envoi.
 */
export async function triggerGoogleReviewOnDelivery(
  attributionId: string,
): Promise<{ sent: ReviewRecipientType[]; skipped: string | null }> {
  const settings = await getGoogleReviewSettings()
  if (!settings.auto_enabled || !settings.url) return { sent: [], skipped: 'disabled' }
  if ((settings.delay_hours ?? 0) > 0) return { sent: [], skipped: 'deferred' }

  const { data: existing } = await supabaseAdmin
    .from('mission_review_requests')
    .select('recipient_type, channel')
    .eq('attribution_id', attributionId)
  const already = new Set(((existing ?? []) as { recipient_type: string; channel: string }[]).map((r) => `${r.recipient_type}:${r.channel}`))

  const targets: ReviewRecipientType[] = ['client']
  if (settings.send_to_contact) targets.push('contact_livraison')

  const sent: ReviewRecipientType[] = []
  for (const recipientType of targets) {
    const channels: ReviewChannel[] = settings.channel === 'email+sms' ? ['email', 'sms'] : [settings.channel || 'email']
    for (const ch of channels) {
      if (already.has(`${recipientType}:${ch}`)) continue
      const res = await sendGoogleReviewRequestServer({
        attributionId,
        recipientType,
        channel: ch,
        auto: true,
        actorLabel: 'Automatique (livraison)',
      })
      if (res.ok && !sent.includes(recipientType)) sent.push(recipientType)
    }
  }
  return { sent, skipped: null }
}
