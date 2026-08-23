import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

export interface MissionDossierEmailInput {
  to: string
  subject: string
  message: string
  filename: string
  /** PDF encodé en base64 (sans préfixe data:). */
  pdfBase64: string
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

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Envoi du dossier complet d'une mission en pièce jointe PDF. */
export const sendMissionDossierEmail = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: MissionDossierEmailInput) => {
    const to = String(input?.to ?? '').trim().toLowerCase()
    if (!to.includes('@')) throw new Error('Adresse email invalide')
    const pdfBase64 = String(input?.pdfBase64 ?? '')
    if (!pdfBase64) throw new Error('PDF manquant')
    if (pdfBase64.length > 20_000_000) throw new Error('Le dossier PDF est trop volumineux pour un envoi email')
    return {
      to,
      subject: String(input?.subject ?? '').trim() || 'Dossier de mission — Transports Ligneo',
      message: String(input?.message ?? '').trim(),
      filename: String(input?.filename ?? 'dossier-mission.pdf').replace(/[^\w.\-]/g, '_'),
      pdfBase64,
    }
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any)

    const gatewayKey = process.env['LOVABLE_API_KEY']
    const resendKey = process.env['RESEND_API_KEY']
    if (!gatewayKey || !resendKey) throw new Error("Le service d'envoi email n'est pas configuré")

    const bodyHtml = `
      <div style="font-family:Poppins,Arial,sans-serif;font-size:14px;color:#0B1338;line-height:1.6">
        ${escapeHtml(data.message || 'Veuillez trouver ci-joint le dossier complet de la mission.')
          .split('\n')
          .map((l) => `<p style="margin:0 0 10px">${l}</p>`)
          .join('')}
        <p style="margin:18px 0 0;font-size:12px;color:#7A8199">Transports Ligneo — Convoyage automobile</p>
      </div>`

    const response = await fetch('https://connector-gateway.lovable.dev/resend/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gatewayKey}`,
        'X-Connection-Api-Key': resendKey,
      },
      body: JSON.stringify({
        from: 'Transports Ligneo <contact@transportsligneo.fr>',
        to: [data.to],
        subject: data.subject,
        html: bodyHtml,
        text: data.message || 'Veuillez trouver ci-joint le dossier complet de la mission.',
        attachments: [{ filename: data.filename, content: data.pdfBase64 }],
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error(`[mission-dossier-email] provider error [${response.status}]: ${errorBody}`)
      throw new Error(`Envoi refusé [${response.status}]: ${errorBody.slice(0, 300)}`)
    }

    return { ok: true as const, to: data.to }
  })
