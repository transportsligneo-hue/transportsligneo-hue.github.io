/**
 * Compte Kilomètres Ligneo — notifications serveur (email + SMS Brevo).
 * Réutilise l'infrastructure existante (sendTransactionalEmailServer / sendSms),
 * aucune configuration dupliquée.
 */
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { sendTransactionalEmailServer } from '@/server/email-send'
import { sendSms } from '@/lib/sms.server'
import { currentTier, formatEur, formatKm, formatDateFr, type LoyaltyTier } from '@/lib/loyalty'

const SITE_URL = 'https://transportsligneo.fr'

interface ClientInfo {
  prenom: string | null
  email: string | null
  telephone: string | null
  typeClient: string | null
}

async function getClientInfo(clientId: string, fallbackEmail: string | null): Promise<ClientInfo> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('prenom, email, telephone, type_client')
    .eq('user_id', clientId)
    .maybeSingle()
  return {
    prenom: data?.prenom ?? null,
    email: data?.email ?? fallbackEmail,
    telephone: data?.telephone ?? null,
    typeClient: data?.type_client ?? null,
  }
}

function spaceUrl(typeClient: string | null): string {
  return typeClient === 'b2b' || typeClient === 'flotte'
    ? `${SITE_URL}/dashboard-pro/fidelite`
    : `${SITE_URL}/dashboard-client/fidelite`
}

/** Retire les accents : encodage GSM-7, 160 caractères par segment. */
function toGsm7(input: string): string {
  return input.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

async function trySms(phone: string | null, body: string) {
  if (!phone) return
  try {
    await sendSms({ to: phone, body: toGsm7(body), from: 'LIGNEO' })
  } catch (e) {
    console.warn('[loyalty] sms failed', e instanceof Error ? e.message : e)
  }
}

/** Palier kilométrique supérieur atteint. */
export async function notifyTierReached(params: {
  clientId: string
  email: string | null
  km: number
  tiers: LoyaltyTier[]
}) {
  const info = await getClientInfo(params.clientId, params.email)
  const tier = currentTier(params.km, params.tiers)
  if (!info.email) return
  await sendTransactionalEmailServer({
    templateName: 'fidelite-palier',
    recipientEmail: info.email,
    idempotencyKey: `loyalty-tier-${params.clientId}-${tier.taux}`,
    templateData: {
      prenom: info.prenom ?? '',
      km: formatKm(params.km),
      palier: tier.label,
      taux: String(tier.taux),
    },
  })
  await trySms(
    info.telephone,
    `Transports Ligneo - Nouveau palier atteint sur votre Compte Kilometres : ${formatKm(params.km)}, prime a ${tier.taux}%. Details : ${spaceUrl(info.typeClient)}`,
  )
}

/** Avoir crédité à la clôture d'une période de 12 mois. */
export async function notifyRewardCredited(rewardId: string) {
  const { data: reward } = await supabaseAdmin
    .from('loyalty_rewards_history')
    .select('id, loyalty_account_id, km_au_calcul, taux_applique, montant_avoir_genere, date_expiration_avoir')
    .eq('id', rewardId)
    .maybeSingle()
  if (!reward) return
  const { data: account } = await supabaseAdmin
    .from('loyalty_accounts')
    .select('client_id, email')
    .eq('id', reward.loyalty_account_id)
    .maybeSingle()
  if (!account) return

  const info = await getClientInfo(account.client_id, account.email)
  const montant = formatEur(Number(reward.montant_avoir_genere))
  if (info.email) {
    await sendTransactionalEmailServer({
      templateName: 'fidelite-avoir',
      recipientEmail: info.email,
      idempotencyKey: `loyalty-reward-${reward.id}`,
      templateData: {
        prenom: info.prenom ?? '',
        montant,
        km: formatKm(Number(reward.km_au_calcul)),
        taux: String(reward.taux_applique),
        expiration: formatDateFr(reward.date_expiration_avoir),
        ctaUrl: spaceUrl(info.typeClient),
      },
    })
  }
  await trySms(
    info.telephone,
    `Transports Ligneo - Votre prime fidelite de ${montant} vient d'etre creditee en avoir. Details : ${spaceUrl(info.typeClient)}`,
  )
  await supabaseAdmin
    .from('loyalty_rewards_history')
    .update({ notified_at: new Date().toISOString() })
    .eq('id', reward.id)
}

/** Rappel 30 jours avant l'expiration d'un avoir non utilisé. */
export async function notifyExpiryReminder(rewardId: string) {
  const { data: reward } = await supabaseAdmin
    .from('loyalty_rewards_history')
    .select('id, loyalty_account_id, montant_avoir_genere, montant_utilise, date_expiration_avoir')
    .eq('id', rewardId)
    .maybeSingle()
  if (!reward) return
  const restant = Number(reward.montant_avoir_genere) - Number(reward.montant_utilise ?? 0)
  if (restant <= 0) return

  const { data: account } = await supabaseAdmin
    .from('loyalty_accounts')
    .select('client_id, email')
    .eq('id', reward.loyalty_account_id)
    .maybeSingle()
  if (!account) return

  const info = await getClientInfo(account.client_id, account.email)
  const montant = formatEur(restant)
  if (info.email) {
    await sendTransactionalEmailServer({
      templateName: 'fidelite-expiration',
      recipientEmail: info.email,
      idempotencyKey: `loyalty-expiry-${reward.id}`,
      templateData: {
        prenom: info.prenom ?? '',
        montant,
        expiration: formatDateFr(reward.date_expiration_avoir),
        ctaUrl: spaceUrl(info.typeClient),
      },
    })
  }
  await trySms(
    info.telephone,
    `Transports Ligneo - Votre avoir de ${montant} expire le ${formatDateFr(reward.date_expiration_avoir)}. Utilisez-le sur votre prochain convoyage : ${spaceUrl(info.typeClient)}`,
  )
  await supabaseAdmin
    .from('loyalty_rewards_history')
    .update({ expiry_reminder_sent_at: new Date().toISOString() })
    .eq('id', reward.id)
}
