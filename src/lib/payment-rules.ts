/**
 * Règle paiement : pros récurrents (flotte_partenaire, client_b2b) → facturation différée.
 * Tous les autres (particuliers, pros ponctuels sans org) → paiement Stripe obligatoire.
 */
export type OrgRole = "client_b2b" | "flotte_partenaire" | "sous_traitant" | null | undefined;

export function requiresImmediatePayment(orgRole: OrgRole): boolean {
  if (orgRole === "flotte_partenaire" || orgRole === "client_b2b") return false;
  return true;
}
