import { createServerFn } from '@tanstack/react-start'
import { sendSms } from '@/lib/sms.server'

export interface TestSmsResponse {
  ok: boolean
  status?: number
  sid?: string
  error?: string
  raw?: string
  to?: string
}

export const sendTestSms = createServerFn({ method: 'POST' })
  .inputValidator((data: { phone: string }) => {
    if (!data || typeof data.phone !== 'string' || data.phone.trim().length < 6) {
      throw new Error('Numéro de téléphone requis')
    }
    return { phone: data.phone.trim() }
  })
  .handler(async ({ data }): Promise<TestSmsResponse> => {
    const res = await sendSms({
      to: data.phone,
      body: 'Test Transports Ligneo',
      from: 'Ligneo',
    })
    return {
      ok: res.ok,
      sid: res.sid,
      error: res.error,
      to: data.phone,
    }
  })
