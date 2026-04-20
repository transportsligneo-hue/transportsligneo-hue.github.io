import type { ComponentType } from 'react'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

import { template as demandeConfirmation } from './demande-confirmation'
import { template as inscriptionConvoyeur } from './inscription-convoyeur'
import { template as devisClient } from './devis-client'
import { template as missionConfirmation } from './mission-confirmation'
import { template as convoyeurValidation } from './convoyeur-validation'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'demande-confirmation': demandeConfirmation,
  'inscription-convoyeur': inscriptionConvoyeur,
  'devis-client': devisClient,
  'mission-confirmation': missionConfirmation,
  'convoyeur-validation': convoyeurValidation,
}
