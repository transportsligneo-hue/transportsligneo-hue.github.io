/**
 * Scroll vers l'estimateur (id="devis" sur desktop/tarifs, "mobile-devis" sur la home mobile),
 * centré dans le viewport. À utiliser pour tous les boutons "Estimer / Estimer mon trajet".
 */
export function scrollToDevis() {
  const el =
    document.getElementById("mobile-devis") ||
    document.getElementById("devis");
  if (!el) return false;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  return true;
}
