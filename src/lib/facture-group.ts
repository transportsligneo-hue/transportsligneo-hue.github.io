import { supabase } from "@/integrations/supabase/client";

export interface GroupInvoiceBasis {
  /** true si le trajet appartient à un groupe (livraison + restitution / mission groupée) */
  isGroup: boolean;
  /** ids de tous les trajets couverts par la facture */
  trajetIds: string[];
  /** ids des attributions couvertes par la facture */
  attributionIds: string[];
  /** trajet porteur de la facture (volet Livraison / leg 1) */
  primaryTrajetId: string;
  /** id de la mission (table missions) référencée par la facture — null si absent */
  primaryMissionId: string | null;
  /** attribution porteuse de la facture (volet Livraison / leg 1) — null si non attribué */
  primaryAttributionId: string | null;
  /** montant TTC global (jamais coupé par segment) */
  totalTtc: number;
  depart: string | null;
  arrivee: string | null;
  /** itinéraire complet type "A → B → A" */
  itineraire: string | null;
  designation: string;
  /** facture déjà émise pour un des segments du groupe */
  existing: { id: string; numero: string } | null;
}

interface LegRow {
  id: string;
  depart: string | null;
  arrivee: string | null;
  prix: number | null;
  prix_client: number | null;
  leg_type: string | null;
  leg_index: number | null;
  mission_group_id: string | null;
  devis_id: string | null;
  mission_id: string | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Détermine la base de facturation d'un trajet.
 * Pour une mission livraison + restitution (ou groupée), la facture doit être unique
 * et porter le tarif de base global du devis — pas la moitié coupée par segment.
 */
export async function resolveGroupInvoiceBasis(
  trajetId: string,
): Promise<GroupInvoiceBasis> {
  const { data: base } = await supabase
    .from("trajets")
    .select(
      "id, depart, arrivee, prix, prix_client, leg_type, leg_index, mission_group_id, devis_id, mission_id",
    )
    .eq("id", trajetId)
    .maybeSingle();

  const current = (base ?? null) as LegRow | null;
  let legs: LegRow[] = current ? [current] : [];

  if (current?.mission_group_id) {
    const { data: siblings } = await supabase
      .from("trajets")
      .select(
        "id, depart, arrivee, prix, prix_client, leg_type, leg_index, mission_group_id, devis_id, mission_id",
      )
      .eq("mission_group_id", current.mission_group_id);
    let rows = ((siblings ?? []) as LegRow[]).slice();
    // Écarte les trajets "simple" résiduels quand les segments aller/retour existent
    const hasLegs = rows.some(
      (r) => r.leg_type === "aller" || r.leg_type === "retour",
    );
    if (hasLegs)
      rows = rows.filter(
        (r) => r.leg_type === "aller" || r.leg_type === "retour",
      );
    if (rows.length) {
      rows.sort((a, b) => {
        const ai = a.leg_index ?? (a.leg_type === "retour" ? 2 : 1);
        const bi = b.leg_index ?? (b.leg_type === "retour" ? 2 : 1);
        return ai - bi;
      });
      legs = rows;
    }
  }

  const trajetIds = legs.map((l) => l.id);
  const sumLegs = legs.reduce(
    (s, l) => s + Number(l.prix_client ?? l.prix ?? 0),
    0,
  );

  // Tarif de base : le devis d'origine fait foi (il porte le prix global aller-retour)
  let devisTotal = 0;
  const devisId = legs.find((l) => l.devis_id)?.devis_id ?? null;
  if (devisId) {
    const { data: dv } = await supabase
      .from("devis")
      .select("prix_estime, prix_aller, prix_retour")
      .eq("id", devisId)
      .maybeSingle();
    if (dv) {
      const parts = Number(dv.prix_aller ?? 0) + Number(dv.prix_retour ?? 0);
      devisTotal = Math.max(Number(dv.prix_estime ?? 0), parts);
    }
  }

  // Les prix des segments font foi : ce sont eux que l'admin édite sur la fiche
  // mission. Le devis ne sert que de repli quand aucun tarif n'est saisi.
  const totalTtc = round2(sumLegs > 0 ? sumLegs : devisTotal);

  const points: string[] = [];
  legs.forEach((l, i) => {
    if (i === 0 && l.depart) points.push(l.depart);
    if (l.arrivee) points.push(l.arrivee);
  });
  const uniquePoints = points.filter((p, i) => i === 0 || p !== points[i - 1]);
  const itineraire = uniquePoints.length ? uniquePoints.join(" → ") : null;

  // Facture déjà émise sur un segment du groupe ?
  let existing: { id: string; numero: string } | null = null;
  const { data: attrs } = await supabase
    .from("attributions")
    .select("id, trajet_id")
    .in("trajet_id", trajetIds.length ? trajetIds : [trajetId]);
  const attrRows = (attrs ?? []) as { id: string; trajet_id: string }[];
  // Ordonné comme les segments (leg 1 d'abord) pour que la facture porte toujours le volet Livraison
  const orderedAttrs = (trajetIds.length ? trajetIds : [trajetId])
    .map((tid) => attrRows.find((a) => a.trajet_id === tid))
    .filter(Boolean) as { id: string; trajet_id: string }[];
  const attributionIds = orderedAttrs.map((a) => a.id);
  const primaryTrajetId = trajetIds[0] ?? trajetId;
  // La facture pointe vers missions.id (contrainte FK) — jamais vers trajets.id
  const primaryMissionId =
    legs.find((l) => l.id === primaryTrajetId)?.mission_id ??
    legs.find((l) => l.mission_id)?.mission_id ??
    null;
  const primaryAttributionId = orderedAttrs[0]?.id ?? null;

  if (attributionIds.length) {
    const { data: fac } = await supabase
      .from("factures")
      .select("id, numero")
      .in("attribution_id", attributionIds)
      .limit(1);
    if (fac && fac.length)
      existing = { id: fac[0].id as string, numero: fac[0].numero as string };
  }
  if (!existing && primaryMissionId) {
    const { data: fac2 } = await supabase
      .from("factures")
      .select("id, numero")
      .eq("mission_id", primaryMissionId)
      .limit(1);
    if (fac2 && fac2.length)
      existing = { id: fac2[0].id as string, numero: fac2[0].numero as string };
  }

  const isGroup = legs.length > 1;

  return {
    isGroup,
    trajetIds,
    attributionIds,
    primaryTrajetId,
    primaryMissionId,
    primaryAttributionId,
    totalTtc,

    depart: legs[0]?.depart ?? current?.depart ?? null,
    arrivee: isGroup
      ? uniquePoints.slice(1).join(" → ") ||
        legs[legs.length - 1]?.arrivee ||
        null
      : (current?.arrivee ?? null),

    itineraire,
    designation: isGroup
      ? "Convoyage véhicule — livraison + restitution"
      : "Convoyage véhicule",
    existing,
  };
}
