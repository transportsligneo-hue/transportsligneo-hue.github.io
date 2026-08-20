import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

/** Rend un template d'email en HTML pour prévisualisation admin (aucun envoi). */
export const renderEmailPreview = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { templateName: string; templateData?: Record<string, unknown> }) =>
    z
      .object({
        templateName: z.string().min(1).max(120),
        templateData: z.record(z.string(), z.any()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' })
    const { data: isSuper } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'super_admin' })
    if (!isAdmin && !isSuper) throw new Error('Forbidden')

    const [{ TEMPLATES }, { render }, React] = await Promise.all([
      import('@/lib/email-templates/registry'),
      import('@react-email/render'),
      import('react'),
    ])

    const entry = TEMPLATES[data.templateName]
    if (!entry) throw new Error('Template inconnu')

    const merged = { ...(entry.previewData ?? {}), ...(data.templateData ?? {}) }
    // Nettoie les champs vides pour retomber sur les valeurs de démonstration
    for (const key of Object.keys(merged)) {
      if (merged[key] === '' || merged[key] === undefined) delete merged[key]
    }

    const subject = typeof entry.subject === 'function' ? entry.subject(merged) : entry.subject
    const html = await render(React.createElement(entry.component, merged as never), { pretty: false })

    return { html, subject }
  })
