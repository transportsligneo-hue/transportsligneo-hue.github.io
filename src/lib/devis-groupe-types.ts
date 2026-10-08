/**
 * Type de trajet de chaque véhicule d'un devis groupé, avec repli sur le
 * récapitulatif texte pour les devis enregistrés avant le type par véhicule.
 */
type Veh = {
  type?: string | null;
  type_trajet?: string | null;
  immatriculation_retour?: string | null;
  marque_retour?: string | null;
};

export type GroupedVehType = "aller-simple" | "aller-retour" | "recharge";

export function groupedVehicleType(v: Veh, index: number, message?: string | null): GroupedVehType {
  const t = v.type_trajet ?? v.type;
  if (t === "aller-retour" || t === "recharge" || t === "aller-simple") return t;
  if (v.immatriculation_retour || v.marque_retour) return "aller-retour";
  if (message) {
    const line = message
      .split(/\n|(?=Véhicule \d+ :)/)
      .find((l) => l.trim().startsWith(`Véhicule ${index + 1} :`));
    if (line && /Retour\s*:/.test(line)) return "aller-retour";
  }
  return "aller-simple";
}

export function groupedVehicleTypes(vehicules: Veh[], message?: string | null) {
  const out = { simple: 0, retour: 0, recharge: 0 };
  vehicules.forEach((v, i) => {
    const t = groupedVehicleType(v, i, message);
    if (t === "aller-retour") out.retour++;
    else if (t === "recharge") out.recharge++;
    else out.simple++;
  });
  return out;
}

export function groupedPrestationLabel(vehicules: Veh[], message?: string | null): string {
  const t = groupedVehicleTypes(vehicules, message);
  return [
    t.simple ? `Livraison simple (${t.simple})` : null,
    t.retour ? `Livraison + restitution (${t.retour})` : null,
    t.recharge ? `Recharge uniquement (${t.recharge})` : null,
  ].filter(Boolean).join(" · ");
}
