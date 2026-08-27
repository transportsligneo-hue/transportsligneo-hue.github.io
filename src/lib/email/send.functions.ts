import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

export interface SendTemplateEmailInput {
  templateName: string
  recipientEmail?: string
  idempotencyKey?: string
  templateData?: Record<string, any>
}

/**
 * Envoi d'un email de template depuis l'app (appelé côté client).
 * Les admins peuvent cibler n'importe quel destinataire ; les autres
 * utilisateurs ne peuvent déclencher que des templates à destinataire fixe
 * (notifications internes), afin de ne pas exposer l'expéditeur vérifié.
 */
export const sendTemplateEmailFn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SendTemplateEmailInput) => input)
  .handler(async ({ data, context }) => {
    const { TEMPLATES } = await import('@/lib/email-templates/registry')
    const template = TEMPLATES[data.templateName]
    if (!template) {
      throw new Error(`Template '${data.templateName}' not found`)
    }

    if (!template.to) {
      const { data: roleRows } = await context.supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', context.userId)
        .eq('actif', true)
      const isAdmin = (roleRows ?? []).some(
        (r: { role: string }) => r.role === 'admin' || r.role === 'super_admin'
      )
      if (!isAdmin) {
        throw new Error('Forbidden')
      }
    }

    const { sendTransactionalEmailServer } = await import('@/server/email-send')
    return sendTransactionalEmailServer({
      templateName: data.templateName,
      recipientEmail: data.recipientEmail,
      idempotencyKey: data.idempotencyKey,
      templateData: data.templateData,
    })
  })
