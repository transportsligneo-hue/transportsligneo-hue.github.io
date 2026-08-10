import { sendTransactionalEmailServer, getAdminNotificationEmail } from '@/server/email-send'

interface Params {
  email: string
  telephone?: string
  raison?: string
}

export async function submitAccountDeletionRequest({ email, telephone, raison }: Params): Promise<{ success: boolean; reason?: string }> {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    return { success: false, reason: 'invalid_email' }
  }

  const adminEmail = await getAdminNotificationEmail()
  const result = await sendTransactionalEmailServer({
    templateName: 'suppression-compte-admin',
    recipientEmail: adminEmail,
    templateData: {
      email: normalizedEmail,
      telephone: telephone?.trim() || undefined,
      raison: raison?.trim() || undefined,
      date: new Date().toLocaleDateString('fr-FR'),
    },
  })

  return result
}
