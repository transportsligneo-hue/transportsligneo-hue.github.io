/** Raisons pour lesquelles un devis ne devrait pas encore devenir une mission. */
export type DevisReglement = {
  locked_at?: string | null;
  paid_at?: string | null;
  paiement_immediat?: boolean | null;
};

export function devisConversionProblems(d: DevisReglement): string[] {
  const problems: string[] = [];
  if (!d.locked_at) problems.push("Le client n’a pas signé le devis.");
  // Facturation différée (flotte / pro) : signé suffit, pas de paiement attendu.
  if (!d.paid_at && d.paiement_immediat !== false) problems.push("Le client n’a pas payé le devis.");
  return problems;
}
