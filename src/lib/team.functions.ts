import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrateur',
  logistique: 'Logistique',
  comptabilite: 'Comptabilité',
}

export const inviteTeamMember = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      orgId: z.string().uuid(),
      email: z.string().trim().email().max(255),
      role: z.enum(['admin', 'logistique', 'comptabilite']),
      origin: z.string().url().max(200),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // RLS: only org admins can insert invitations
    const { data: inv, error } = await context.supabase
      .from('org_invitations')
      .insert({ organization_id: data.orgId, email: data.email.toLowerCase(), role: data.role, invited_by: context.userId })
      .select('token')
      .single()
    if (error || !inv) throw new Error("Vous n'avez pas les droits pour inviter dans cette société.")

    const { data: org } = await context.supabase.from('organizations').select('name').eq('id', data.orgId).maybeSingle()
    const { data: me } = await context.supabase.from('profiles').select('prenom, nom').eq('id', context.userId).maybeSingle()
    const origin = /^https:\/\/([a-z0-9-]+\.)*(lovable\.app|transportsligneo\.fr)$/.test(data.origin) || data.origin.startsWith('http://localhost')
      ? data.origin
      : 'https://transportsligneo.fr'

    const { sendTransactionalEmailServer } = await import('@/server/email-send')
    await sendTransactionalEmailServer({
      templateName: 'invitation-equipe',
      recipientEmail: data.email,
      idempotencyKey: `invite-${inv.token}`,
      templateData: {
        societe: (org as { name?: string } | null)?.name,
        role: ROLE_LABEL[data.role],
        invitant: [me?.prenom, me?.nom].filter(Boolean).join(' ') || undefined,
        lien: `${origin}/invitation-equipe/${inv.token}`,
      },
    })
    return { ok: true }
  })
