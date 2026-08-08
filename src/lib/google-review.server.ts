/**
 * Envoi des demandes d'avis Google (serveur uniquement).
 *
 * Utilisé par :
 *  - le panneau admin de la mission (envoi manuel, via google-review.functions.ts)
 *  - le job automatique X heures après la fin de mission (route cron publique)
 */
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { sendTransactionalEmailServer } from '@/server/email-send'

export type ReviewRecipientType = 'client' | 'contact_livraison'

export interface GoogleReviewSettings {
  url: string
  auto_enabled: boolean
  delay_hours: number
  send_to_contact: boolean
}

export const DEFAULT_REVIEW_SETTINGS: GoogleReviewSettings = {
  url: '',
  auto_enabled: false,
  delay_hours: 2,
  send_to_contact: true,
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

export interface SendReviewResult {
  ok: boolean
  error?: string
  recipientEmail?: string
}

/** Envoie (ou ré-envoie) une demande d'avis Google pour une mission. */
export async function sendGoogleReviewRequestServer(params: {
  attributionId: string
  recipientType: ReviewRecipientType
  emailOverride?: string | null
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
      'id, depart, arrivee, client_nom, client_email, arrivee_contact_nom, arrivee_contact_prenom, arrivee_contact_email',
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

  const isContact = params.recipientType === 'contact_livraison'
  const rawEmail = params.emailOverride ?? (isContact ? trajet.arrivee_contact_email : trajet.client_email)
  if (!isValidEmail(rawEmail)) {
    return {
      ok: false,
      error: isContact
        ? "Le contact livraison n'a pas d'email valide renseigné."
        : "Le client n'a pas d'email valide renseigné.",
    }
  }
  const recipientEmail = rawEmail.trim()

  const recipientName = isContact
    ? [trajet.arrivee_contact_prenom, trajet.arrivee_contact_nom].filter(Boolean).join(' ') || null
    : trajet.client_nom

  const prenom = (recipientName ?? '').trim().split(' ')[0] || ''

  const sent = await sendTransactionalEmailServer({
    templateName: 'avis-google',
    recipientEmail,
    idempotencyKey: `avis-google-${attribution.id}-${params.recipientType}`,
    templateData: {
      prenom,
      numero: attribution.numero_mission ?? '',
      depart: trajet.depart,
      arrivee: trajet.arrivee,
      convoyeur: convoyeurLabel ?? '',
      reviewUrl: settings.url,
      isContactLivraison: isContact,
    },
  })

  await supabaseAdmin.from('mission_review_requests').upsert(
    {
      attribution_id: attribution.id,
      trajet_id: trajet.id,
      recipient_type: params.recipientType,
      recipient_email: recipientEmail,
      recipient_name: recipientName,
      channel: 'email',
      status: sent.success ? 'sent' : 'failed',
      sent_at: new Date().toISOString(),
      auto: !!params.auto,
      created_by: params.actorUserId ?? null,
    } as never,
    { onConflict: 'attribution_id,recipient_type' } as never,
  )

  if (sent.success) {
    await supabaseAdmin.rpc('log_activity', {
      _action: 'mission.avis_google_envoye',
      _entity_type: 'attribution',
      _entity_id: attribution.id,
      _metadata: {
        recipient_type: params.recipientType,
        recipient_email: recipientEmail,
        auto: !!params.auto,
        actor: params.actorLabel ?? (params.auto ? 'Automatique' : 'Admin'),
      },
    } as never)
  }

  return sent.success
    ? { ok: true, recipientEmail }
    : { ok: false, error: sent.reason ?? "Échec de l'envoi.", recipientEmail }
}

/**
 * Déclenchement automatique à la livraison (fin de mission convoyeur).
 *
 * - Respecte les paramètres admin (activation, lien Google, contact livraison).
 * - Anti-doublon : ne renvoie jamais si une demande existe déjà pour ce
 *   destinataire (manuelle, automatique ou déjà déclenchée par le cron).
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
    .select('recipient_type')
    .eq('attribution_id', attributionId)
  const already = new Set(((existing ?? []) as { recipient_type: string }[]).map((r) => r.recipient_type))

  const targets: ReviewRecipientType[] = ['client']
  if (settings.send_to_contact) targets.push('contact_livraison')

  const sent: ReviewRecipientType[] = []
  for (const recipientType of targets) {
    if (already.has(recipientType)) continue
    const res = await sendGoogleReviewRequestServer({
      attributionId,
      recipientType,
      auto: true,
      actorLabel: 'Automatique (livraison)',
    })
    if (res.ok) sent.push(recipientType)
  }
  return { sent, skipped: null }
}
