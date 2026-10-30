import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

const REPLY_TO = 'contact@transportsligneo.fr'

async function assertAdmin(context: any) {
  const { data: isAdmin } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' })
  const { data: isSuper } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'super_admin' })
  if (!isAdmin && !isSuper) throw new Error('Forbidden')
}

export type ContactReply = {
  id: string
  contact_message_id: string
  direction: 'in' | 'out'
  subject: string | null
  body: string
  email_status: string | null
  created_at: string
}

async function db() {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  return supabaseAdmin as any
}

/** Fil de discussion d'une demande de contact (messages envoyés et réponses notées), du plus ancien au plus récent. */
export const getContactThread = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ contactId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<ContactReply[]> => {
    await assertAdmin(context)
    const sb = await db()
    const { data: rows, error } = await sb
      .from('contact_message_replies')
      .select('id, contact_message_id, direction, subject, body, email_status, created_at')
      .eq('contact_message_id', data.contactId)
      .order('created_at', { ascending: true })
    if (error) throw new Error(error.message)
    return (rows ?? []) as ContactReply[]
  })

/** Envoie une réponse au contact avec le gabarit Ligneo (réponse possible directement par mail) et la garde dans l'historique. */
export const replyToContact = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      contactId: z.string().uuid(),
      subject: z.string().trim().min(2).max(200),
      body: z.string().trim().min(1).max(6000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context)
    const sb = await db()
    const { data: contact, error: cErr } = await sb
      .from('contact_messages').select('id, prenom, nom, email, message, created_at, statut').eq('id', data.contactId).maybeSingle()
    if (cErr) throw new Error(cErr.message)
    if (!contact) throw new Error('Demande introuvable')

    const { sendTransactionalEmailServer } = await import('@/server/email-send')
    const res = await sendTransactionalEmailServer({
      templateName: 'reponse-contact',
      recipientEmail: contact.email,
      replyTo: REPLY_TO,
      idempotencyKey: `reponse-contact-${crypto.randomUUID()}`,
      templateData: {
        prenom: contact.prenom || undefined,
        subject: data.subject,
        message: data.body,
        originalMessage: contact.message,
        originalDate: new Date(contact.created_at).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' }),
      },
    })
    if (!res.success) {
      throw new Error(
        res.reason === 'email_suppressed' ? "Ce contact s'est désinscrit des emails" : "Envoi impossible pour le moment",
      )
    }

    const { data: row, error } = await sb.from('contact_message_replies').insert({
      contact_message_id: data.contactId,
      direction: 'out',
      subject: data.subject,
      body: data.body,
      author_user_id: context.userId,
      email_status: 'sent',
    }).select('id, contact_message_id, direction, subject, body, email_status, created_at').single()
    if (error) throw new Error(`Email envoyé mais historique non enregistré : ${error.message}`)

    if (contact.statut === 'nouveau') {
      await sb.from('contact_messages').update({ statut: 'en_cours' }).eq('id', data.contactId)
    }
    return row as ContactReply
  })

/** Note dans le fil une réponse reçue par mail (copier-coller du message du client). */
export const addInboundContactReply = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ contactId: z.string().uuid(), body: z.string().trim().min(1).max(8000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context)
    const sb = await db()
    const { data: row, error } = await sb.from('contact_message_replies').insert({
      contact_message_id: data.contactId,
      direction: 'in',
      subject: null,
      body: data.body,
      author_user_id: context.userId,
      email_status: null,
    }).select('id, contact_message_id, direction, subject, body, email_status, created_at').single()
    if (error) throw new Error(error.message)
    return row as ContactReply
  })
