/**
 * Rappel J-1 aux clients : enlèvement (client de départ) et livraison (contact d'arrivée).
 * Canal réglable dans l'admin (Paramètres → Rappels clients) : email, sms, les deux ou aucun.
 * Server-only, jamais bloquant, jamais deux fois le même rappel (verrou client_rappels_j1).
 */
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { sendRawEmailServer } from '@/server/email-send'
import { escapeHtml } from '@/lib/campaigns/render'

export type ClientReminderChannel = 'email' | 'sms' | 'email+sms' | 'off'

export async function getClientReminderChannel(): Promise<ClientReminderChannel> {
  const { data } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('key', 'client_rappel_j1')
    .maybeSingle()
  const c = (data as { value?: { channel?: string } } | null)?.value?.channel
  return c === 'sms' || c === 'email+sms' || c === 'off' ? c : 'email'
}

type Row = {
  id: string
  trajet_id: string
  trajet: {
    numero_mission: string | null
    depart: string | null
    arrivee: string | null
    date_trajet: string | null
    heure_trajet: string | null
    marque: string | null
    modele: string | null
    client_nom: string | null
    client_email: string | null
    client_telephone: string | null
    arrivee_contact_prenom: string | null
    arrivee_contact_nom: string | null
    arrivee_contact_email: string | null
    arrivee_contact_telephone: string | null
  } | null
}

async function deliver(opts: {
  channel: ClientReminderChannel
  email?: string | null
  tel?: string | null
  subject: string
  intro: string
  detail: string
  key: string
}): Promise<boolean> {
  let ok = false
  if ((opts.channel === 'email' || opts.channel === 'email+sms') && opts.email) {
    try {
      const r = await sendRawEmailServer({
        to: opts.email,
        subject: opts.subject,
        label: 'client_rappel_j1',
        idempotencyKey: opts.key,
        html: `<div style="font-family:Helvetica,Arial,sans-serif;color:#061238;line-height:1.6">
          <p>${escapeHtml(opts.intro)}</p><p>${escapeHtml(opts.detail)}</p>
          <p style="color:#5b6688;font-size:13px">Transports Ligneo</p></div>`,
        text: `${opts.intro} ${opts.detail}`,
      })
      ok = ok || r.success
    } catch (e) {
      console.error('[client-rappel] email échoué', e)
    }
  }
  if ((opts.channel === 'sms' || opts.channel === 'email+sms') && opts.tel) {
    try {
      const { sendSms } = await import('@/lib/sms.server')
      await sendSms({ to: opts.tel, from: 'LIGNEO', body: `Transports Ligneo — ${opts.intro} ${opts.detail}`.slice(0, 300) })
      ok = true
    } catch (e) {
      console.error('[client-rappel] SMS échoué', e)
    }
  }
  return ok
}

export async function runClientReminders(tomorrow: string): Promise<{ sent: number }> {
  const channel = await getClientReminderChannel()
  if (channel === 'off') return { sent: 0 }

  const { data } = await supabaseAdmin
    .from('attributions')
    .select(
      `id, trajet_id, trajet:trajets!inner(numero_mission, depart, arrivee, date_trajet, heure_trajet, marque, modele, client_nom, client_email, client_telephone, arrivee_contact_prenom, arrivee_contact_nom, arrivee_contact_email, arrivee_contact_telephone)`,
    )
    .in('statut', ['acceptee', 'attribuee', 'confirmee', 'en_cours', 'validee'])
    .eq('trajet.date_trajet', tomorrow)
    .limit(500)

  let sent = 0
  for (const r of (data ?? []) as unknown as Row[]) {
    const t = r.trajet
    if (!t) continue
    const num = t.numero_mission ?? ''
    const veh = [t.marque, t.modele].filter(Boolean).join(' ') || 'votre véhicule'
    const h = t.heure_trajet ? ` vers ${String(t.heure_trajet).slice(0, 5).replace(':', 'h')}` : ''

    for (const kind of ['enlevement', 'livraison'] as const) {
      const { error: lock } = await (supabaseAdmin as unknown as { from: (t: string) => any })
        .from('client_rappels_j1')
        .insert({ attribution_id: r.id, kind })
      if (lock) continue // déjà envoyé

      const ok =
        kind === 'enlevement'
          ? await deliver({
              channel,
              email: t.client_email,
              tel: t.client_telephone,
              subject: `Demain : le convoyeur récupère ${veh}${num ? ` (${num})` : ''}`,
              intro: `Bonjour${t.client_nom ? ` ${t.client_nom}` : ''}, le convoyeur sera présent demain${h} pour récupérer ${veh}.`,
              detail: `Lieu d'enlèvement : ${t.depart ?? 'à confirmer'}. Pensez au code de remise à lui communiquer sur place.`,
              key: `client-j1-enl-${r.id}`,
            })
          : await deliver({
              channel,
              email: t.arrivee_contact_email,
              tel: t.arrivee_contact_telephone,
              subject: `Demain : ${veh} vous est livré${num ? ` (${num})` : ''}`,
              intro: `Bonjour${t.arrivee_contact_prenom ? ` ${t.arrivee_contact_prenom}` : ''}, ${veh} sera livré demain.`,
              detail: `Lieu de livraison : ${t.arrivee ?? 'à confirmer'}. Merci d'être présent pour la remise et de communiquer le code au convoyeur.`,
              key: `client-j1-liv-${r.id}`,
            })
      if (ok) sent++
    }
  }
  return { sent }
}
