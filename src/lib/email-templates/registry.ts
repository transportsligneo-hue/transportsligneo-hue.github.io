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
import { template as missionTermineeAdmin } from './mission-terminee-admin'
import { template as b2bPaiementAdmin } from './b2b-paiement-admin'
import { template as b2bLeadFlotteAdmin } from './b2b-lead-flotte-admin'
import { template as b2bConversionSuggestionAdmin } from './b2b-conversion-suggestion-admin'
import { template as paiementConfirme } from './paiement-confirme'
import { template as attributionConvoyeur } from './attribution-convoyeur'
import { template as missionTermineeClient } from './mission-terminee-client'
import { template as factureDisponible } from './facture-disponible'
import { template as devisAccepte } from './devis-accepte'
import { template as welcomeClient } from './welcome-client'
import { template as nouvelleDemandeAdmin } from './nouvelle-demande-admin'
import { template as devisCreeAdmin } from './devis-cree-admin'
import { template as devisAccepteAdmin } from './devis-accepte-admin'
import { template as devisPaye } from './devis-paye'
import { template as missionDemarreeClient } from './mission-demarree-client'
import { template as missionLivreeClient } from './mission-livree-client'
import { template as convoyeurRefuse } from './convoyeur-refuse'
import { template as convoyeurSuspendu } from './convoyeur-suspendu'
import { template as messageManuel } from './message-manuel'
import { template as devisOtpCode } from './devis-otp-code'
import { template as convoyeurDocumentStatus } from './convoyeur-document-status'
import { template as vehiculeDocumentExpiration } from './vehicule-document-expiration'
import { template as invite } from './invite'
import { template as invitationConvoyeur } from './invitation-convoyeur'
import { template as avisGoogle } from './avis-google'
import { template as suppressionCompteAdmin } from './suppression-compte-admin'




export const TEMPLATES: Record<string, TemplateEntry> = {
  'invitation-convoyeur': invitationConvoyeur,
  'demande-confirmation': demandeConfirmation,
  'inscription-convoyeur': inscriptionConvoyeur,
  'devis-client': devisClient,
  'mission-confirmation': missionConfirmation,
  'convoyeur-validation': convoyeurValidation,
  'offre-acceptee': offreAcceptee,
  'offre-refusee': offreRefusee,
  'nouvelle-offre-admin': nouvelleOffreAdmin,
  'document-mission-admin': documentMissionAdmin,
  'mission-terminee-admin': missionTermineeAdmin,
  'b2b-paiement-admin': b2bPaiementAdmin,
  'b2b-lead-flotte-admin': b2bLeadFlotteAdmin,
  'b2b-conversion-suggestion-admin': b2bConversionSuggestionAdmin,
  'paiement-confirme': paiementConfirme,
  'attribution-convoyeur': attributionConvoyeur,
  'mission-terminee-client': missionTermineeClient,
  'facture-disponible': factureDisponible,
  'devis-accepte': devisAccepte,
  'welcome-client': welcomeClient,
  'nouvelle-demande-admin': nouvelleDemandeAdmin,
  'devis-cree-admin': devisCreeAdmin,
  'devis-accepte-admin': devisAccepteAdmin,
  'devis-paye': devisPaye,
  'mission-demarree-client': missionDemarreeClient,
  'mission-livree-client': missionLivreeClient,
  'convoyeur-refuse': convoyeurRefuse,
  'convoyeur-suspendu': convoyeurSuspendu,
  'message-manuel': messageManuel,
  'devis-otp-code': devisOtpCode,
  'convoyeur-document-status': convoyeurDocumentStatus,
  'vehicule-document-expiration': vehiculeDocumentExpiration,
  'invite': invite,
  'avis-google': avisGoogle,
  'suppression-compte-admin': suppressionCompteAdmin,
}
