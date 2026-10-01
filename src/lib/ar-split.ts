/**
 * Répartition d'un montant AR (aller-retour) 2/3 - 1/3 avec arrondi
 * du sens Aller au centime SUPÉRIEUR ; le Retour absorbe le reste
 * afin que aller + retour = total exact (jamais un centime en trop).
 *
 * Miroir JS de la fonction SQL public.split_ar_prices.
 */
export function splitArPrice(total: number): { aller: number; retour: number } {
  const t = Math.max(0, Math.round((Number(total) || 0) * 100) / 100);
  if (t <= 0) return { aller: 0, retour: 0 };
  // Forfait Tours aller-retour : 120 = 70 (livraison) + 50 (restitution)
  if (t === 120) return { aller: 70, retour: 50 };
  const allerCents = Math.ceil((t * 100 * 2) / 3);
  const totalCents = Math.round(t * 100);
  const aller = Math.min(allerCents, totalCents) / 100;
  const retour = Math.max(0, (totalCents - Math.min(allerCents, totalCents)) / 100);
  return { aller, retour };
}
