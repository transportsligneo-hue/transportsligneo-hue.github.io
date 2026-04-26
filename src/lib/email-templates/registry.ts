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
import { template as offreAcceptee } from './offre-acceptee'
import { template as offreRefusee } from './offre-refusee'
import { template as nouvelleOffreAdmin } from './nouvelle-offre-admin'
import { template as documentMissionAdmin } from './document-mission-admin'
import { template as b2bPaiementAdmin } from './b2b-paiement-admin'
import { template as b2bLeadFlotteAdmin } from './b2b-lead-flotte-admin'
import { template as b2bConversionSuggestionAdmin } from './b2b-conversion-suggestion-admin'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'demande-confirmation': demandeConfirmation,
  'inscription-convoyeur': inscriptionConvoyeur,
  'devis-client': devisClient,
  'mission-confirmation': missionConfirmation,
  'convoyeur-validation': convoyeurValidation,
  'offre-acceptee': offreAcceptee,
  'offre-refusee': offreRefusee,
  'nouvelle-offre-admin': nouvelleOffreAdmin,
  'document-mission-admin': documentMissionAdmin,
  'b2b-paiement-admin': b2bPaiementAdmin,
  'b2b-lead-flotte-admin': b2bLeadFlotteAdmin,
  'b2b-conversion-suggestion-admin': b2bConversionSuggestionAdmin,
}
