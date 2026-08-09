import { createServerFn } from '@tanstack/react-start'

export const sendTestSms = createServerFn({ method: 'POST' })
  .inputValidator((data: { phone: string }) => {
    if (!data || typeof data.phone !== 'string' || data.phone.trim().length < 6) {
      throw new Error('Numéro de téléphone requis')
    }
    return { phone: data.phone.trim() }
  })
  .handler(async ({ data }) => {
    const { sendSms } = await import('./sms.server')
    return await sendSms({ to: data.phone, body: 'Test Transports Ligneo' })
  })
