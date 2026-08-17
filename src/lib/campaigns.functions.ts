import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { buildCampaignHtml, buildCampaignText } from '@/lib/campaigns/render'
import { LIGNEO_SITE_ORIGIN } from '@/lib/brand-assets'

export interface AudienceContact {
  key: string
  email: string
  prenom: string
  nom: string
  entreprise: string
  segment: 'flotte' | 'b2b' | 'particulier' | 'organisation'
  source: 'profil' | 'organisation'
  clientId: string | null
  organizationId: string | null
  totalKm: number
  tier: string | null
  unsubscribed: boolean
}

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc('has_role', {
    _user_id: context.userId,
    _role: 'admin',
  })
  if (isAdmin) return
  const { data: isSuper } = await context.supabase.rpc('has_role', {
    _user_id: context.userId,
    _role: 'super_admin',
  })
  if (!isSuper) throw new Error('Forbidden')
}

export const listCampaignAudience = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AudienceContact[]> => {
    await assertAdmin(context as any)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

    const [{ data: profiles }, { data: orgs }, { data: km }, { data: unsubs }] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('user_id, email, prenom, nom, societe, type_client, organization_id')
        .not('email', 'is', null),
      supabaseAdmin
        .from('organizations')
        .select('id, legal_name, commercial_name, account_type, primary_contact_email, primary_contact_name, billing_email'),
      supabaseAdmin.from('client_km_accounts').select('email, total_km, tier_name'),
      supabaseAdmin.from('client_unsubscribes').select('email'),
    ])

    const kmByEmail = new Map<string, { total: number; tier: string | null }>()
    for (const row of km ?? []) {
      kmByEmail.set(String(row.email).toLowerCase(), {
        total: Number(row.total_km ?? 0),
        tier: row.tier_name ?? null,
      })
    }
    const unsubSet = new Set((unsubs ?? []).map((u) => String(u.email).toLowerCase()))

    const byEmail = new Map<string, AudienceContact>()

    for (const p of profiles ?? []) {
      const email = String(p.email ?? '').trim().toLowerCase()
      if (!email || !email.includes('@')) continue
      const type = p.type_client === 'flotte' ? 'flotte' : p.type_client === 'b2b' || p.societe ? 'b2b' : 'particulier'
      const stats = kmByEmail.get(email)
      byEmail.set(email, {
        key: email,
        email,
        prenom: p.prenom ?? '',
        nom: p.nom ?? '',
        entreprise: p.societe ?? '',
        segment: type as AudienceContact['segment'],
        source: 'profil',
        clientId: p.user_id ?? null,
        organizationId: p.organization_id ?? null,
        totalKm: stats?.total ?? 0,
        tier: stats?.tier ?? null,
        unsubscribed: unsubSet.has(email),
      })
    }

    for (const o of orgs ?? []) {
      const email = String(o.primary_contact_email || o.billing_email || '').trim().toLowerCase()
      if (!email || !email.includes('@') || byEmail.has(email)) continue
      const stats = kmByEmail.get(email)
      const contact = (o.primary_contact_name ?? '').split(' ')
      byEmail.set(email, {
        key: email,
        email,
        prenom: contact[0] ?? '',
        nom: contact.slice(1).join(' '),
        entreprise: o.commercial_name || o.legal_name || '',
        segment: o.account_type === 'flotte' ? 'flotte' : 'organisation',
        source: 'organisation',
        clientId: null,
        organizationId: o.id,
        totalKm: stats?.total ?? 0,
        tier: stats?.tier ?? null,
        unsubscribed: unsubSet.has(email),
      })
    }

    return Array.from(byEmail.values()).sort((a, b) =>
      (a.entreprise || a.nom || a.email).localeCompare(b.entreprise || b.nom || b.email, 'fr'),
    )
  })

export interface SendCampaignInput {
  campaignId: string
  contacts: {
    email: string
    prenom?: string
    nom?: string
    entreprise?: string
    clientId?: string | null
    organizationId?: string | null
    totalKm?: number
  }[]
}

export const sendCampaign = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SendCampaignInput) => {
    if (!input?.campaignId) throw new Error('campaignId requis')
    if (!Array.isArray(input.contacts) || input.contacts.length === 0)
      throw new Error('Aucun destinataire sélectionné')
    return input
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

    const gatewayKey = process.env['LOVABLE_API_KEY']
    const resendKey = process.env['RESEND_API_KEY']
    if (!gatewayKey || !resendKey) throw new Error("Le service d'envoi email n'est pas configuré")

    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('campaigns')
      .select('*')
      .eq('id', data.campaignId)
      .maybeSingle()
    if (campaignError || !campaign) throw new Error('Campagne introuvable')

    const { data: unsubs } = await supabaseAdmin.from('client_unsubscribes').select('email')
    const blocked = new Set((unsubs ?? []).map((u) => String(u.email).toLowerCase()))

    const targets = data.contacts
      .map((c) => ({ ...c, email: c.email.trim().toLowerCase() }))
      .filter((c) => c.email.includes('@') && !blocked.has(c.email))

    let sent = 0
    let failed = 0
    const skipped = data.contacts.length - targets.length

    for (const contact of targets) {
      // 1. Créer (ou réutiliser) la ligne destinataire → identifiant de tracking
      const { data: recipient, error: recipientError } = await supabaseAdmin
        .from('campaign_recipients')
        .upsert(
          {
            campaign_id: campaign.id,
            email: contact.email,
            client_id: contact.clientId ?? null,
            organization_id: contact.organizationId ?? null,
            display_name: [contact.prenom, contact.nom].filter(Boolean).join(' ') || contact.entreprise || null,
            status: 'pending',
          },
          { onConflict: 'campaign_id,email' },
        )
        .select('id')
        .single()

      if (recipientError || !recipient) {
        failed += 1
        continue
      }

      const vars = {
        prenom: contact.prenom ?? '',
        nom: contact.nom ?? '',
        entreprise: contact.entreprise ?? '',
        solde_km: Math.round(contact.totalKm ?? 0),
      }

      const html = buildCampaignHtml({
        campaign,
        vars,
        recipientId: recipient.id,
        baseUrl: LIGNEO_SITE_ORIGIN,
      })
      const text = buildCampaignText(campaign, vars)
      const subject = campaign.subject || campaign.name

      try {
        const response = await fetch('https://connector-gateway.lovable.dev/resend/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${gatewayKey}`,
            'X-Connection-Api-Key': resendKey,
          },
          body: JSON.stringify({
            from: `${campaign.sender_name || 'Transports Ligneo'} <contact@transportsligneo.fr>`,
            to: [contact.email],
            subject,
            html,
            text,
          }),
        })

        if (!response.ok) {
          const errorBody = await response.text()
          console.error(`[send-campaign] provider error [${response.status}]: ${errorBody}`)
          failed += 1
          await supabaseAdmin
            .from('campaign_recipients')
            .update({ status: 'failed', error_message: `${response.status}: ${errorBody.slice(0, 500)}` })
            .eq('id', recipient.id)
          continue
        }

        sent += 1
        await supabaseAdmin
          .from('campaign_recipients')
          .update({ status: 'sent', sent_at: new Date().toISOString(), error_message: null })
          .eq('id', recipient.id)
      } catch (error) {
        console.error('[send-campaign] request failed', error)
        failed += 1
        await supabaseAdmin
          .from('campaign_recipients')
          .update({ status: 'failed', error_message: String(error).slice(0, 500) })
          .eq('id', recipient.id)
      }
    }

    if (sent > 0) {
      await supabaseAdmin
        .from('campaigns')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', campaign.id)
    }

    return { sent, failed, skipped }
  })
