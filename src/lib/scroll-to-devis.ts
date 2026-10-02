/**
 * Scroll vers l'estimateur (id="devis" sur desktop/tarifs, "mobile-devis" sur la home mobile),
 * centré dans le viewport. À utiliser pour tous les boutons "Estimer / Estimer mon trajet".
 */
export function scrollToDevis() {
  const el = ["mobile-devis", "devis"]
    .map((id) => document.getElementById(id))
    .find((node) => node && node.getClientRects().length > 0);
  if (!el) return false;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  return true;
}
