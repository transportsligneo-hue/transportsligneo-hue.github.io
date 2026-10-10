/** Devis groupés validés par lots : types de lignes, totaux et statut global. */
import { calculateBasePrice } from "./reservation-pricing";
import { resolveDistanceKm } from "./resolve-distance";
import { resolveClientPrice } from "./client-pricing";

export type LigneType = "aller_simple" | "livraison_simple" | "livraison_restitution";
export type LigneStatut = "a_valider" | "validee";

export const LIGNE_TYPES: { value: LigneType; label: string }[] = [
  { value: "aller_simple", label: "Aller simple" },
  { value: "livraison_simple", label: "Livraison simple" },
  { value: "livraison_restitution", label: "restitution et livraison" },
];

export function ligneTypeLabel(t: LigneType): string {
  return LIGNE_TYPES.find((x) => x.value === t)?.label ?? "Aller simple";
}

export interface DevisLigne {
  id: string;
  devis_id: string;
  position: number;
  type_ligne: LigneType;
  depart: string | null;
  arrivee: string | null;
  date_enlevement: string | null;
  heure_enlevement: string | null;
  date_livraison: string | null;
  heure_livraison: string | null;
  adresse_retour: string | null;
  date_restitution: string | null;
  heure_restitution: string | null;
  contact_nom: string | null;
  contact_tel: string | null;
  immatriculation: string | null;
  vin: string | null;
  marque: string | null;
  modele: string | null;
  energie: string | null;
  prix_aller: number;
  prix_retour: number;
  statut: LigneStatut;
  lot_id: string | null;
  mission_ids: string[];
  mission_numero: string | null;
}

/** Prix d'une ligne : le retour ne compte que pour « restitution et livraison ». */
export function lignePrix(l: Pick<DevisLigne, "type_ligne" | "prix_aller" | "prix_retour">): number {
  const r = l.type_ligne === "livraison_restitution" ? Number(l.prix_retour || 0) : 0;
  return Math.round((Number(l.prix_aller || 0) + r) * 100) / 100;
}

export function totalLignes(lignes: Pick<DevisLigne, "type_ligne" | "prix_aller" | "prix_retour">[]): number {
  return Math.round(lignes.reduce((s, l) => s + lignePrix(l), 0) * 100) / 100;
}

/** Champs obligatoires manquants (adresse, date, plaque ; date de restitution si besoin). */
export function champsManquants(l: DevisLigne): string[] {
  const out: string[] = [];
  if (!l.depart?.trim() || !l.arrivee?.trim()) out.push("adresse");
  if (!l.date_enlevement) out.push("date");
  if (!l.immatriculation?.trim()) out.push("plaque");
  if (l.type_ligne === "livraison_restitution" && !l.date_restitution) out.push("date de restitution");
  return out;
}

export type DevisGlobalStatut = "a_valider" | "partiel" | "complet" | "expire";

export function devisGlobalStatut(
  lignes: Pick<DevisLigne, "statut">[],
  expiresAt?: string | null,
  now: Date = new Date(),
): DevisGlobalStatut {
  const total = lignes.length;
  const ok = lignes.filter((l) => l.statut === "validee").length;
  if (total > 0 && ok === total) return "complet";
  if (expiresAt && new Date(expiresAt) < now) return "expire";
  if (ok > 0) return "partiel";
  return "a_valider";
}

export const GLOBAL_LABEL: Record<DevisGlobalStatut, string> = {
  a_valider: "À valider",
  partiel: "Partiellement validé",
  complet: "Entièrement validé",
  expire: "Expiré",
};

/** Type d'une ligne depuis l'ancien format (vehicules.type_trajet) ou un fichier importé. */
export function parseLigneType(raw: unknown): LigneType {
  const s = String(raw ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");
  if (["restitutionetlivraison", "allerretour", "livraisonetrestitution", "livraisonrestitution", "livraisonplusrestitution", "livraisonrestitutions"].includes(s)) return "livraison_restitution";
  if (s.startsWith("livraisonsimple") || s === "livraison") return "livraison_simple";
  return "aller_simple";
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

async function stdPrice(from: string, to: string, ar: boolean): Promise<number> {
  const type = ar ? "aller_retour" : "aller_simple";
  let p = calculateBasePrice(from, to, type);
  if (p.base <= 0) {
    const km = await resolveDistanceKm(from, to);
    p = calculateBasePrice(from, to, type, km);
  }
  return p.base;
}

/**
 * Prix d'une ligne avec le calcul existant (tarifs client personnalisés, sinon barème standard).
 * restitution et livraison : retour à l'adresse de départ = tarif aller-retour existant,
 * détaillé aller/retour ; autre adresse de retour = somme de deux trajets simples.
 */
export async function computeLignePrix(
  l: Pick<DevisLigne, "type_ligne" | "depart" | "arrivee" | "adresse_retour">,
  client: { userId?: string | null; email?: string | null },
): Promise<{ aller: number; retour: number } | null> {
  const dep = l.depart?.trim() ?? "";
  const arr = l.arrivee?.trim() ?? "";
  if (dep.length < 2 || arr.length < 2) return null;
  const custom = async (from: string, to: string, ar: boolean) => {
    try {
      const r = await resolveClientPrice({ ...client, depart: from, arrivee: to, tripType: ar ? "aller_retour" : "aller" });
      return r?.prix_ttc ?? null;
    } catch {
      return null;
    }
  };
  if (l.type_ligne !== "livraison_restitution") {
    const p = (await custom(dep, arr, false)) ?? (await stdPrice(dep, arr, false));
    return p > 0 ? { aller: round2(p), retour: 0 } : null;
  }
  const ret = l.adresse_retour?.trim() || dep;
  if (ret.toLowerCase() === dep.toLowerCase()) {
    const total = (await custom(dep, arr, true)) ?? (await stdPrice(dep, arr, true));
    const simple = (await custom(dep, arr, false)) ?? (await stdPrice(dep, arr, false));
    if (total <= 0) return null;
    const aller = simple > 0 && simple < total ? simple : round2(total / 2);
    return { aller: round2(aller), retour: round2(total - aller) };
  }
  const a = (await custom(dep, arr, false)) ?? (await stdPrice(dep, arr, false));
  const r = (await custom(arr, ret, false)) ?? (await stdPrice(arr, ret, false));
  if (a <= 0 || r <= 0) return null;
  return { aller: round2(a), retour: round2(r) };
}
