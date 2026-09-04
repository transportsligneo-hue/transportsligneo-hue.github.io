import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'
import { sendTransactionalEmailServer } from '@/server/email-send'

/**
 * Alerte quotidienne "parc véhicules" (contrôles, révisions, contrats, TCO/km).
 *
 * Appelée par un planificateur externe avec l'en-tête `x-alert-secret`.
 * Pour chaque organisation ayant activé les alertes email, appelle
 * `get_fleet_alerts` et envoie une synthèse aux gestionnaires.
 */

type FleetAlert = {
  type: string
  vehicle_id: string
  immatriculation: string | null
  severite: string
  date?: string | null
  km_restants?: number | null
  tco_km?: number | null
  moyenne?: number | null
}

const TYPE_LABELS: Record<string, string> = {
  controle_technique: 'Contrôle technique',
  revision: 'Révision',
  contrat: 'Contrat de financement',
  tco_eleve: 'Coût au km élevé',
}

const fmtDate = (d?: string | null) => {
  if (!d) return null
  const x = new Date(d)
  return Number.isNaN(x.getTime()) ? d : x.toLocaleDateString('fr-FR')
}

const fmtEur = (n?: number | null) =>
  n == null ? null : `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/km`

function detail(a: FleetAlert) {
  if (a.type === 'tco_eleve') {
    return [fmtEur(a.tco_km), a.moyenne != null ? `moyenne du parc ${fmtEur(a.moyenne)}` : null]
      .filter(Boolean)
      .join(' — contre ')
  }
  if (a.type === 'revision' && a.km_restants != null) {
    return `${a.km_restants.toLocaleString('fr-FR')} km restants`
  }
  const d = fmtDate(a.date)
  return d ? `Échéance le ${d}` : ''
}

export const Route = createFileRoute('/api/public/alertes-flotte-tco')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env['VEHICLE_DOC_ALERT_SECRET']
        const provided = request.headers.get('x-alert-secret')
        if (!secret || !provided || provided !== secret) {
          return new Response('Unauthorized', { status: 401 })
        }

        const supabaseUrl = process.env['SUPABASE_URL'] ?? import.meta.env.VITE_SUPABASE_URL
        const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']
        if (!supabaseUrl || !serviceKey) {
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }
        const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

        const { data: settings, error: sErr } = await supabase
          .from('fleet_settings')
          .select('organization_id, alertes_email_actives, alert_emails')
          .eq('alertes_email_actives', true)

        if (sErr) {
          console.error('fleet tco alert: settings query failed', sErr.message)
          return Response.json({ error: 'Query failed' }, { status: 500 })
        }

        const today = new Date().toISOString().slice(0, 10)
        let sent = 0
        let orgsWithAlerts = 0

        for (const s of settings ?? []) {
          const orgId = s.organization_id as string
          const { data: alertsRaw, error: aErr } = await supabase.rpc('get_fleet_alerts', { _org_id: orgId })
          if (aErr) {
            console.error('fleet tco alert: rpc failed', aErr.message)
            continue
          }
          const alerts = (alertsRaw ?? []) as unknown as FleetAlert[]
          if (alerts.length === 0) continue
          orgsWithAlerts += 1

          const vehicleIds = [...new Set(alerts.map((a) => a.vehicle_id))]
          const [{ data: org }, { data: members }, { data: vehicles }] = await Promise.all([
            supabase.from('organizations').select('legal_name, commercial_name').eq('id', orgId).maybeSingle(),
            supabase
              .from('organization_members')
              .select('user_id, member_role, status')
              .eq('organization_id', orgId)
              .eq('status', 'active'),
            supabase.from('vehicles').select('id, marque, modele').in('id', vehicleIds),
          ])

          const label = (id: string) => {
            const v = (vehicles ?? []).find((x) => x.id === id)
            return [v?.marque, v?.modele].filter(Boolean).join(' ') || 'Véhicule'
          }

          const lines = alerts.map((a) => ({
            vehicule: label(a.vehicle_id),
            immatriculation: a.immatriculation ?? '—',
            type: TYPE_LABELS[a.type] ?? a.type,
            detail: detail(a),
            severite: a.severite,
          }))

          const managerRoles = ['owner', 'admin', 'manager', 'fleet_admin', 'fleet_finance']
          const managerIds = (members ?? [])
            .filter((m) => managerRoles.includes(m.member_role as string))
            .map((m) => m.user_id)
          const targetIds = managerIds.length > 0 ? managerIds : (members ?? []).map((m) => m.user_id)

          const { data: profiles } = targetIds.length
            ? await supabase.from('profiles').select('id, email, prenom').in('id', targetIds)
            : { data: [] as Array<{ id: string; email: string | null; prenom: string | null }> }

          const extra = ((s.alert_emails as string[] | null) ?? []).filter(Boolean)
          const recipients = [
            ...(profiles ?? []).filter((p) => p.email).map((p) => ({ key: p.id, email: p.email as string, prenom: p.prenom })),
            ...extra.map((e) => ({ key: e, email: e, prenom: null as string | null })),
          ]
          const societe = org?.commercial_name || org?.legal_name || null

          for (const r of recipients) {
            try {
              const res = await sendTransactionalEmailServer({
                templateName: 'alerte-flotte-tco',
                recipientEmail: r.email,
                idempotencyKey: `fleet-tco-${orgId}-${r.key}-${today}`,
                templateData: { prenom: r.prenom, societe, alertes: lines },
              })
              if (res.success) sent += 1
              else console.error('fleet tco alert: send failed', res.reason)
            } catch (e) {
              console.error('fleet tco alert: send error', (e as Error).message)
            }
          }
        }

        return Response.json({ ok: true, organizations: orgsWithAlerts, sent })
      },
    },
  },
})
