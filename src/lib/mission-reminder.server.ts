/**
 * Rappel automatique J-1 au convoyeur (email + push).
 *
 * Server-only. Un seul point d'entrée métier : `sendMissionReminder(attributionId)`
 * et le balayage `runMissionReminders()` appelé par la tâche planifiée.
 *
 * - jamais deux fois le même rappel : verrou en base sur `mission_rappels_j1`
 * - jamais bloquant : un champ manquant part vide, une erreur est journalisée
 * - n'altère aucune notification existante : ce flux s'ajoute.
 */
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { sendTransactionalEmailServer } from '@/server/email-send'
import { sendConvoyeurPush } from '@/lib/push/driver-push.server'

const SITE_URL = 'https://transportsligneo.fr'

/** Règles de sécurité — reprises telles quelles de la checklist convoyeur existante. */
export const REGLES_SECURITE_CONVOYEUR = [
  'Gilet jaune haute visibilité à bord et porté avant d’approcher le véhicule ou en cas d’arrêt sur la voie publique.',
  'Kit de sécurité complet dans le véhicule : triangle de signalisation + gilet.',
  'Permis de conduire original en cours de validité, en votre possession.',
  'Documents de conduite à jour : assurance du véhicule utilisé pour vous rendre sur place.',
  'Tenue correcte et professionnelle, conforme à la charte de présentation (survêtement proscrit).',
]

type TrajetLite = {
  id: string
  numero_mission: string | null
  depart: string | null
  arrivee: string | null
  date_trajet: string | null
  heure_trajet: string | null
  marque: string | null
  modele: string | null
  immatriculation: string | null
  vehicule_immatriculation: string | null
  non_roulant: boolean | null
  decharge_recuperation: boolean | null
  recuperation_lieu: string | null
  contact_depart_nom: string | null
  contact_depart_tel: string | null
  contact_arrivee_nom: string | null
  contact_arrivee_tel: string | null
  arrivee_contact_nom: string | null
  arrivee_contact_prenom: string | null
  arrivee_contact_telephone: string | null
  client_nom: string | null
  client_telephone: string | null
}

const TRAJET_COLS =
  'id, numero_mission, depart, arrivee, date_trajet, heure_trajet, marque, modele, immatriculation, vehicule_immatriculation, non_roulant, decharge_recuperation, recuperation_lieu, contact_depart_nom, contact_depart_tel, contact_arrivee_nom, contact_arrivee_tel, arrivee_contact_nom, arrivee_contact_prenom, arrivee_contact_telephone, client_nom, client_telephone'

/** Décalage horaire de Paris (en minutes) pour une date donnée. */
function parisOffsetMinutes(utc: Date): number {
  const s = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris',
    timeZoneName: 'shortOffset',
  }).format(utc)
  const m = s.match(/GMT([+-]\d+)(?::(\d+))?/)
  if (!m) return 60
  return Number(m[1]) * 60 + (m[1]!.startsWith('-') ? -1 : 1) * Number(m[2] ?? 0)
}

/** Convertit une date/heure locale Paris en instant UTC. */
function parisToUtc(date: string, heure?: string | null): Date | null {
  if (!date) return null
  const hh = (heure ?? '08:00').slice(0, 5)
  const guess = new Date(`${date}T${hh}:00Z`)
  if (Number.isNaN(guess.getTime())) return null
  const off = parisOffsetMinutes(guess)
  return new Date(guess.getTime() - off * 60_000)
}

function parisDateStr(d: Date): string {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(d)
}

function contact(nom?: string | null, tel?: string | null): string {
  return [nom?.trim(), tel?.trim()].filter(Boolean).join(' — ')
}

function docsForMission(t: TrajetLite) {
  const docs: Array<{ label: string; note?: string }> = []
  docs.push({
    label: 'État des lieux papier',
    note: t.non_roulant ? 'Version plateau / véhicule non roulant' : 'Version véhicule roulant',
  })
  if (t.decharge_recuperation) {
    docs.push({
      label: 'Mandat de récupération',
      note: t.recuperation_lieu ? `Lieu : ${t.recuperation_lieu}` : 'À faire signer sur place',
    })
  }
  return docs
}

export type ReminderResult = {
  attributionId: string
  sent: boolean
  reason?: string
}

/**
 * Envoie le rappel pour une attribution donnée. Idempotent.
 * `force` ignore le verrou (usage admin / test).
 */
export async function sendMissionReminder(
  attributionId: string,
  opts: { force?: boolean } = {},
): Promise<ReminderResult> {
  try {
    const { data: attr } = await supabaseAdmin
      .from('attributions')
      .select(`id, statut, statut_convoyeur, numero_mission, convoyeur_id, trajet_id, trajet:trajets(${TRAJET_COLS})`)
      .eq('id', attributionId)
      .maybeSingle()

    if (!attr) return { attributionId, sent: false, reason: 'attribution introuvable' }
    const a = attr as unknown as {
      id: string
      statut: string
      numero_mission: string | null
      convoyeur_id: string
      trajet_id: string
      trajet: TrajetLite | null
    }
    if (['annulee', 'refusee', 'terminee'].includes(String(a.statut))) {
      return { attributionId, sent: false, reason: `statut ${a.statut}` }
    }
    const t = a.trajet
    if (!t) return { attributionId, sent: false, reason: 'trajet introuvable' }

    // Verrou anti-doublon : l'insertion échoue si un rappel existe déjà.
    if (!opts.force) {
      const { error: lockErr } = await supabaseAdmin
        .from('mission_rappels_j1')
        .insert({ attribution_id: a.id, trajet_id: a.trajet_id, convoyeur_id: a.convoyeur_id } as never)
      if (lockErr) return { attributionId, sent: false, reason: 'déjà envoyé' }
    }

    const { data: conv } = await supabaseAdmin
      .from('convoyeurs')
      .select('id, prenom, nom, email, user_id')
      .eq('id', a.convoyeur_id)
      .maybeSingle()
    const c = conv as { prenom?: string; email?: string } | null

    const numero = a.numero_mission ?? t.numero_mission ?? ''
    const docsUrl = `${SITE_URL}/convoyeur/documents-mission/${a.id}`
    const appUrl = `${SITE_URL}/convoyeur/missions?open=${a.id}`
    const dateFr = t.date_trajet
      ? new Date(`${t.date_trajet}T12:00:00Z`).toLocaleDateString('fr-FR')
      : ''
    const heure = t.heure_trajet ? String(t.heure_trajet).slice(0, 5) : ''

    const templateData = {
      prenom: c?.prenom ?? '',
      numero,
      quand: [dateFr, heure ? `à ${heure}` : ''].filter(Boolean).join(' '),
      vehicule: [t.marque, t.modele].filter(Boolean).join(' '),
      immatriculation: t.immatriculation ?? t.vehicule_immatriculation ?? '',
      depart: t.depart ?? '',
      heureDepart: heure,
      contactDepart:
        contact(t.contact_depart_nom, t.contact_depart_tel) ||
        contact(t.client_nom, t.client_telephone),
      arrivee: t.arrivee ?? '',
      heureArrivee: '',
      contactArrivee:
        contact(t.contact_arrivee_nom, t.contact_arrivee_tel) ||
        contact(
          [t.arrivee_contact_prenom, t.arrivee_contact_nom].filter(Boolean).join(' '),
          t.arrivee_contact_telephone,
        ),
      roulant: t.non_roulant
        ? 'Véhicule NON roulant — plateau à prévoir'
        : 'Véhicule roulant',
      securite: REGLES_SECURITE_CONVOYEUR,
      documents: docsForMission(t),
      docsUrl,
      appUrl,
    }

    let emailOk = false
    if (c?.email) {
      try {
        const res = await sendTransactionalEmailServer({
          templateName: 'rappel-mission-j1',
          recipientEmail: c.email,
          idempotencyKey: `rappel-mission-j1-${a.id}`,
          templateData,
        })
        emailOk = res.success
      } catch (e) {
        console.error('[rappel-j1] email échoué', a.id, e)
      }
    }

    let pushOk = false
    try {
      const r: any = await sendConvoyeurPush({
        convoyeurId: a.convoyeur_id,
        event: 'mission_modifiee',
        attributionId: a.id,
        title: 'Mission demain — préparez vos documents',
        body: [
          numero ? `Mission ${numero}` : 'Mission',
          heure ? `départ ${heure}` : null,
          t.non_roulant ? 'véhicule non roulant (plateau)' : null,
        ]
          .filter(Boolean)
          .join(' · '),
        url: `/convoyeur/documents-mission/${a.id}`,
      })
      pushOk = Boolean(r?.ok)
    } catch (e) {
      console.error('[rappel-j1] push échoué', a.id, e)
    }

    await supabaseAdmin
      .from('mission_rappels_j1')
      .update({ email_ok: emailOk, push_ok: pushOk } as never)
      .eq('attribution_id', a.id)

    return { attributionId, sent: emailOk || pushOk, reason: emailOk || pushOk ? undefined : 'aucun canal' }
  } catch (e) {
    console.error('[rappel-j1] erreur', attributionId, e)
    return { attributionId, sent: false, reason: 'erreur' }
  }
}

/**
 * Balayage : toutes les missions qui démarrent dans les 24 prochaines heures
 * et dont le convoyeur n'a pas encore reçu son rappel.
 */
export async function runMissionReminders(): Promise<{ found: number; sent: number; results: ReminderResult[] }> {
  const now = new Date()
  const today = parisDateStr(now)
  const tomorrow = parisDateStr(new Date(now.getTime() + 24 * 3600_000))
  const dayAfter = parisDateStr(new Date(now.getTime() + 48 * 3600_000))

  const { data, error } = await supabaseAdmin
    .from('attributions')
    .select(`id, statut, trajet:trajets!inner(id, date_trajet, heure_trajet)`)
    .in('statut', ['acceptee', 'attribuee', 'confirmee', 'en_cours', 'validee'])
    .in('trajet.date_trajet', [today, tomorrow, dayAfter])
    .limit(500)

  if (error) {
    console.error('[rappel-j1] requête échouée', error.message)
    return { found: 0, sent: 0, results: [] }
  }

  const rows = (data ?? []) as unknown as Array<{
    id: string
    trajet: { date_trajet: string | null; heure_trajet: string | null } | null
  }>

  const results: ReminderResult[] = []
  for (const row of rows) {
    const start = row.trajet?.date_trajet
      ? parisToUtc(row.trajet.date_trajet, row.trajet.heure_trajet)
      : null
    if (!start) continue
    const diffH = (start.getTime() - now.getTime()) / 3600_000
    if (diffH > 24 || diffH < -1) continue
    results.push(await sendMissionReminder(row.id))
  }

  return { found: results.length, sent: results.filter((r) => r.sent).length, results }
}

/**
 * Envoie le rappel immédiatement si la mission démarre dans moins de 24h
 * (attribution tardive). Sans effet sinon : le balayage quotidien s'en charge.
 */
export async function maybeSendImminentReminder(attributionId: string): Promise<ReminderResult> {
  try {
    const { data } = await supabaseAdmin
      .from('attributions')
      .select('id, trajet:trajets(date_trajet, heure_trajet)')
      .eq('id', attributionId)
      .maybeSingle()
    const t = (data as any)?.trajet as { date_trajet: string | null; heure_trajet: string | null } | null
    if (!t?.date_trajet) return { attributionId, sent: false, reason: 'date inconnue' }
    const start = parisToUtc(t.date_trajet, t.heure_trajet)
    if (!start) return { attributionId, sent: false, reason: 'date invalide' }
    const diffH = (start.getTime() - Date.now()) / 3600_000
    if (diffH > 24 || diffH < -1) return { attributionId, sent: false, reason: 'hors fenêtre 24h' }
    return await sendMissionReminder(attributionId)
  } catch (e) {
    console.error('[rappel-j1] envoi immédiat impossible', attributionId, e)
    return { attributionId, sent: false, reason: 'erreur' }
  }
}
