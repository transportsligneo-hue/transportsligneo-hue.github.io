import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'

/**
 * Alerte quotidienne "documents véhicules à renouveler" (espace Flotte).
 *
 * Appelée par un planificateur externe (pg_cron / cron manager) avec l'en-tête
 * `x-alert-secret`. Parcourt les véhicules dont l'assurance, le contrôle
 * technique ou la carte grise expire dans les 30 jours (ou est déjà expirée),
 * regroupe par organisation et envoie un seul email au(x) gestionnaire(s).
 */

const WINDOW_DAYS = 30

type DocLine = {
  vehicule: string
  immatriculation: string
  document: string
  echeance: string
  jours: number
}

function fmt(date: string) {
  const d = new Date(date)
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString('fr-FR')
}

function daysUntil(date: string) {
  const d = new Date(date).getTime()
  const now = new Date()
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.round((d - today) / 86_400_000)
}

export const Route = createFileRoute('/api/public/alertes-documents-vehicules')({
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

        const limit = new Date()
        limit.setDate(limit.getDate() + WINDOW_DAYS)
        const limitIso = limit.toISOString().slice(0, 10)

        const { data: vehicles, error } = await supabase
          .from('vehicles')
          .select(
            'id, marque, modele, immatriculation, organization_id, assurance_expire_le, controle_technique_expire_le, carte_grise_expire_le, archived_at',
          )
          .is('archived_at', null)
          .or(
            `assurance_expire_le.lte.${limitIso},controle_technique_expire_le.lte.${limitIso},carte_grise_expire_le.lte.${limitIso}`,
          )

        if (error) {
          console.error('vehicle doc alert: query failed', error.message)
          return Response.json({ error: 'Query failed' }, { status: 500 })
        }

        const byOrg = new Map<string, DocLine[]>()
        for (const v of vehicles ?? []) {
          const label = [v.marque, v.modele].filter(Boolean).join(' ') || 'Véhicule'
          const docs: Array<[string | null, string]> = [
            [v.assurance_expire_le, 'Assurance'],
            [v.controle_technique_expire_le, 'Contrôle technique'],
            [v.carte_grise_expire_le, 'Carte grise'],
          ]
          for (const [date, docLabel] of docs) {
            if (!date) continue
            const jours = daysUntil(date)
            if (jours > WINDOW_DAYS) continue
            const list = byOrg.get(v.organization_id) ?? []
            list.push({
              vehicule: label,
              immatriculation: v.immatriculation ?? '—',
              document: docLabel,
              echeance: fmt(date),
              jours,
            })
            byOrg.set(v.organization_id, list)
          }
        }

        const today = new Date().toISOString().slice(0, 10)
        const origin = new URL(request.url).origin
        let sent = 0

        for (const [orgId, documents] of byOrg) {
          const [{ data: org }, { data: members }] = await Promise.all([
            supabase.from('organizations').select('legal_name, commercial_name').eq('id', orgId).maybeSingle(),
            supabase
              .from('organization_members')
              .select('user_id, member_role, status')
              .eq('organization_id', orgId)
              .eq('status', 'active'),
          ])

          const managerIds = (members ?? [])
            .filter((m) => m.member_role === 'owner' || m.member_role === 'admin' || m.member_role === 'manager')
            .map((m) => m.user_id)
          const targetIds = managerIds.length > 0 ? managerIds : (members ?? []).map((m) => m.user_id)
          if (targetIds.length === 0) continue

          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, email, prenom')
            .in('id', targetIds)

          const societe = org?.commercial_name || org?.legal_name || null

          for (const p of profiles ?? []) {
            if (!p.email) continue
            try {
              const res = await sendTransactionalEmailServer({
                templateName: 'vehicule-document-expiration',
                recipientEmail: p.email,
                idempotencyKey: `veh-docs-${orgId}-${p.id}-${today}`,
                templateData: { prenom: p.prenom ?? null, societe, documents },
              })
              if (res.success) sent += 1
              else console.error('vehicle doc alert: send failed', res.reason)
            } catch (e) {
              console.error('vehicle doc alert: send error', (e as Error).message)
            }
          }
        }

        return Response.json({ ok: true, organizations: byOrg.size, sent })
      },
    },
  },
})
