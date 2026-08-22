/**
 * Source unique du SMS envoyé après une livraison.
 * L'identité du convoyeur n'est volontairement pas acceptée en paramètre.
 */
export function buildGoogleReviewSms(reviewUrl: string): string {
  return `Transports Ligneo - Bonjour, votre vehicule a bien ete livre. Si vous etes satisfait, un avis nous aiderait beaucoup : ${reviewUrl}`
}