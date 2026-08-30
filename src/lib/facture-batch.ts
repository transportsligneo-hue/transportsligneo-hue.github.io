import { supabase } from "@/integrations/supabase/client";
import { resolveGroupInvoiceBasis } from "@/lib/facture-group";
import { fetchActiveRegime } from "@/lib/pricing/fetch";
import { generateFacturePdf, type FactureData } from "@/lib/facture-pdf";
import { stripLegSuffix } from "@/lib/mission-number";

export interface FactureCandidate {
  /** trajet porteur (volet Livraison pour un duo) */
  trajetId: string;
  attributionId: string;
  numeroMission: string | null;
  clientLabel: string;
  clientEmail: string | null;
  itineraire: string;
  dateMission: string | null;
  montantTtc: number;
  isGroup: boolean;
  /** facture déjà émise */
  factureId: string | null;
  factureNumero: string | null;
  referenceClient: string | null;
  referenceLabel: string | null;
}

interface AttrRow {
  id: string;
  trajet_id: string;
  statut: string;
  numero_mission: string | null;
  created_at: string;
  trajet: {
    depart: string | null;
    arrivee: string | null;
    date_trajet: string | null;
    client_nom: string | null;
    client_email: string | null;
    prix: number | null;
    prix_client: number | null;
    mission_group_id: string | null;
    leg_index: number | null;
    leg_type: string | null;
    is_test_data: boolean | null;
    numero_mission: string | null;
    mission_id: string | null;
    devis_id: string | null;
    commande_ref: string | null;
    devis: {
      numero: string | null;
      prix_estime: number | null;
      prix_aller: number | null;
      prix_retour: number | null;
    } | null;
  } | null;
}

const numberRoot = (numero: string | null | undefined) => {
  const match = numero?.match(/(\d+)(?:\.\d+)?(?:-[ARL])?$/i);
  return match?.[1] ? String(Number(match[1])) : null;
};

/**
 * Missions terminées facturables (une seule entrée par duo Livraison + Restitution).
 * Inclut celles déjà facturées : l'admin voit le n° de facture et le PO existants.
 */
export async function listFactureCandidates(): Promise<FactureCandidate[]> {
  const { data, error } = await supabase
    .from("attributions")
    .select(
      "id, trajet_id, statut, numero_mission, created_at, trajet:trajets(depart, arrivee, date_trajet, client_nom, client_email, prix, prix_client, mission_group_id, leg_index, leg_type, is_test_data, numero_mission, mission_id, devis_id, commande_ref, devis:devis(numero, prix_estime, prix_aller, prix_retour))",
    )
    .in("statut", ["termine", "validee"])
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const allRows = ((data ?? []) as unknown as AttrRow[]).filter(
    (r) => !r.trajet?.is_test_data,
  );

  // Un ancien trajet peut subsister après la recréation d'une mission depuis le même devis
  // (#053 puis #083, par exemple). Quand le numéro canonique du devis existe, les anciennes
  // copies décalées ne doivent jamais réapparaître dans la facturation en lot.
  const canonicalDevisRoots = new Map<string, string>();
  allRows.forEach((r) => {
    const devisId = r.trajet?.devis_id;
    const devisRoot = numberRoot(r.trajet?.devis?.numero);
    const missionRoot = numberRoot(r.trajet?.numero_mission);
    if (devisId && devisRoot && missionRoot === devisRoot)
      canonicalDevisRoots.set(devisId, devisRoot);
  });
  const rows = allRows.filter((r) => {
    const devisId = r.trajet?.devis_id;
    const canonicalRoot = devisId ? canonicalDevisRoots.get(devisId) : null;
    return (
      !canonicalRoot || numberRoot(r.trajet?.numero_mission) === canonicalRoot
    );
  });

  // Dé-doublonnage duo : on garde le volet Livraison (leg 1) comme porteur.
  // Clé : mission_group_id, sinon numéro de mission sans suffixe -L / -R.
  const keyOf = (r: AttrRow) =>
    r.trajet?.mission_group_id ??
    (r.numero_mission ? `n:${stripLegSuffix(r.numero_mission)}` : r.id);
  const byGroup = new Map<string, AttrRow>();
  rows.forEach((r) => {
    const key = keyOf(r);
    const prev = byGroup.get(key);
    if (!prev) return void byGroup.set(key, r);
    const legOf = (x: AttrRow) =>
      x.trajet?.leg_index ?? (x.trajet?.leg_type === "retour" ? 2 : 1);
    if (legOf(r) < legOf(prev)) byGroup.set(key, r);
  });
  // Plus récentes en premier (date de mission, à défaut date de création)
  const tsOf = (r: AttrRow) =>
    new Date(r.trajet?.date_trajet ?? r.created_at).getTime();
  const kept = Array.from(byGroup.values()).sort((a, b) => tsOf(b) - tsOf(a));

  const attrIds = rows.map((r) => r.id);
  const missionIds = kept
    .map((r) => r.trajet?.mission_id)
    .filter((id): id is string => !!id);
  const factures = new Map<
    string,
    {
      id: string;
      numero: string;
      reference_client: string | null;
      reference_label: string | null;
    }
  >();
  if (attrIds.length) {
    const query = supabase
      .from("factures")
      .select(
        "id, numero, attribution_id, mission_id, reference_client, reference_label",
      );
    const filters = [`attribution_id.in.(${attrIds.join(",")})`];
    if (missionIds.length)
      filters.push(`mission_id.in.(${missionIds.join(",")})`);
    const { data: fac } = await query.or(filters.join(","));
    (fac ?? []).forEach((f) => {
      const rec = {
        id: f.id as string,
        numero: f.numero as string,
        reference_client: (f.reference_client as string) ?? null,
        reference_label: (f.reference_label as string) ?? null,
      };
      if (f.attribution_id) factures.set(`a:${f.attribution_id}`, rec);
      if (f.mission_id) factures.set(`m:${f.mission_id}`, rec);
    });
  }

  return kept.map((r) => {
    const t = r.trajet;
    const grouped = rows.filter((x) => keyOf(x) === keyOf(r));
    const hasLegs = grouped.some(
      (x) => x.trajet?.leg_type === "aller" || x.trajet?.leg_type === "retour",
    );
    const legRows = hasLegs
      ? grouped.filter(
          (x) =>
            x.trajet?.leg_type === "aller" || x.trajet?.leg_type === "retour",
        )
      : grouped;
    // Un même trajet peut porter plusieurs attributions (re-livraison quand le
    // client était absent) : on ne facture qu'une fois chaque segment.
    const seenTrajets = new Set<string>();
    const billableLegs = legRows.filter((x) => {
      if (seenTrajets.has(x.trajet_id)) return false;
      seenTrajets.add(x.trajet_id);
      return true;
    });
    const segmentTotal = billableLegs.reduce(
      (sum, x) => sum + Number(x.trajet?.prix_client ?? x.trajet?.prix ?? 0),
      0,
    );

    const devis = t?.devis;
    const devisParts =
      Number(devis?.prix_aller ?? 0) + Number(devis?.prix_retour ?? 0);
    const devisTotal = Math.max(Number(devis?.prix_estime ?? 0), devisParts);
    const fac =
      billableLegs
        .map((leg) => factures.get(`a:${leg.id}`))
        .find((invoice) => !!invoice) ??
      (t?.mission_id ? factures.get(`m:${t.mission_id}`) : null) ??
      null;
    // PO saisi côté fiche mission (trajets.commande_ref) : on le récupère sur
    // n'importe quel volet du duo quand la facture n'en porte pas encore.
    const missionPo =
      grouped
        .map((x) => (x.trajet?.commande_ref ?? "").trim())
        .find((ref) => !!ref) ?? null;
    const referenceClient =
      (fac?.reference_client ?? "").trim() || missionPo || null;
    return {
      trajetId: r.trajet_id,
      attributionId: r.id,
      numeroMission: t?.numero_mission
        ? stripLegSuffix(t.numero_mission)
        : r.numero_mission
          ? stripLegSuffix(r.numero_mission)
          : null,

      clientLabel: t?.client_nom || t?.client_email || "Client",
      clientEmail: t?.client_email ?? null,
      itineraire: `${t?.depart ?? "—"} → ${t?.arrivee ?? "—"}`,
      dateMission: t?.date_trajet ?? null,
      montantTtc:
        Math.round((segmentTotal > 0 ? segmentTotal : devisTotal) * 100) / 100,
      isGroup: billableLegs.length > 1,
      factureId: fac?.id ?? null,
      factureNumero: fac?.numero ?? null,
      referenceClient,
      referenceLabel:
        fac?.reference_label ?? (referenceClient ? "N° de PO" : null),
    };
  });
}

export interface FactureRow {
  id: string;
  numero: string;
  type_facture: string;
  date_facture: string | null;
  date_mission: string | null;
  date_echeance: string | null;
  mode_paiement: string | null;
  conditions_paiement: string | null;
  client_nom: string | null;
  client_prenom: string | null;
  client_societe: string | null;
  client_email: string | null;
  client_adresse: string | null;
  client_siret: string | null;
  client_tva: string | null;
  designation: string | null;
  depart: string | null;
  arrivee: string | null;
  distance_km: number | null;
  prix_ht: number;
  tva_taux: number;
  prix_tva: number;
  prix_ttc: number;
  reference_client: string | null;
  reference_label: string | null;
  vehicule_marque: string | null;
  vehicule_modele: string | null;
  vehicule_immatriculation: string | null;
  vehicule_vin: string | null;
  [k: string]: unknown;
}

export function factureRowToPdfData(row: FactureRow): FactureData {
  return {
    numero: row.numero,
    type_facture: (row.type_facture as "particulier" | "b2b") ?? "particulier",
    date_facture: row.date_facture ?? undefined,
    date_mission: row.date_mission,
    date_echeance: row.date_echeance,
    mode_paiement: row.mode_paiement,
    conditions_paiement: row.conditions_paiement,
    client_nom: row.client_nom,
    client_prenom: row.client_prenom,
    client_societe: row.client_societe,
    client_email: row.client_email,
    client_adresse: row.client_adresse,
    client_siret: row.client_siret,
    client_tva: row.client_tva,
    designation: row.designation,
    depart: row.depart,
    arrivee: row.arrivee,
    distance_km: row.distance_km,
    prix_ht: Number(row.prix_ht),
    tva_taux: Number(row.tva_taux),
    prix_tva: Number(row.prix_tva),
    prix_ttc: Number(row.prix_ttc),
    reference_client: row.reference_client,
    reference_label: row.reference_label,
    vehicule_marque: row.vehicule_marque,
    vehicule_modele: row.vehicule_modele,
    vehicule_immatriculation: row.vehicule_immatriculation,
    vehicule_vin: row.vehicule_vin,
  } as FactureData;
}

/**
 * Récupère la facture existante d'une mission (duo compris) ou la crée.
 * Applique systématiquement la référence client (PO) fournie.
 */
export async function ensureFacture(
  trajetId: string,
  attributionId: string | null,
  po: { referenceClient?: string | null; referenceLabel?: string | null } = {},
): Promise<{ row: FactureRow; created: boolean }> {
  const basis = await resolveGroupInvoiceBasis(trajetId);
  let refClient = (po.referenceClient ?? "").trim() || null;
  if (!refClient) {
    // Aucun PO fourni : on reprend celui saisi sur la fiche mission.
    const { data: poTrajet } = await supabase
      .from("trajets")
      .select("commande_ref, mission_group_id")
      .eq("id", trajetId)
      .maybeSingle();
    refClient = (poTrajet?.commande_ref ?? "").trim() || null;
    if (!refClient && poTrajet?.mission_group_id) {
      const { data: legs } = await supabase
        .from("trajets")
        .select("commande_ref")
        .eq("mission_group_id", poTrajet.mission_group_id);
      refClient =
        (legs ?? [])
          .map((l) => (l.commande_ref ?? "").trim())
          .find((v) => !!v) || null;
    }
  }
  const refLabel = refClient
    ? po.referenceLabel || "N° de PO"
    : (po.referenceLabel ?? null);
  const { regime, vatRate } = await fetchActiveRegime();
  const micro = regime !== "societe";
  const basisTtc = Number(basis.totalTtc ?? 0);
  const basisHt = micro
    ? basisTtc
    : basisTtc > 0
      ? basisTtc / (1 + vatRate / 100)
      : 0;
  const basisTva = +(basisTtc - basisHt).toFixed(2);

  if (basis.existing) {
    const priceCorrections = {
      prix_ht: +basisHt.toFixed(2),
      prix_tva: basisTva,
      prix_ttc: basisTtc,
      tva_taux: micro ? 0 : vatRate,
    };
    const corrections = refClient
      ? {
          ...priceCorrections,
          reference_client: refClient,
          reference_label: refLabel,
        }
      : priceCorrections;
    const { error: updateError } = await supabase
      .from("factures")
      .update(corrections)
      .eq("id", basis.existing.id);
    if (updateError) throw new Error(updateError.message);
    const { data, error } = await supabase
      .from("factures")
      .select("*")
      .eq("id", basis.existing.id)
      .single();
    if (error || !data)
      throw new Error(error?.message || "Facture introuvable");
    return { row: data as unknown as FactureRow, created: false };
  }

  const { data: trajet, error: tErr } = await supabase
    .from("trajets")
    .select(
      "id, depart, arrivee, date_trajet, client_email, client_nom, prix, devis_id, demande_id, marque, modele, immatriculation, vin, vehicule_immatriculation, vehicule_vin",
    )
    .eq("id", trajetId)
    .maybeSingle();
  if (tErr || !trajet) throw new Error("Trajet introuvable");

  // Email client : trajet -> devis -> demande -> profil
  let clientEmail = (trajet.client_email ?? "").trim();
  let clientNom = trajet.client_nom ?? "";
  if (!clientEmail && trajet.devis_id) {
    const { data: dv } = await supabase
      .from("devis")
      .select("email, nom, prenom")
      .eq("id", trajet.devis_id)
      .maybeSingle();
    if (dv?.email) clientEmail = dv.email;
    if (!clientNom && dv)
      clientNom = `${dv.prenom ?? ""} ${dv.nom ?? ""}`.trim();
  }
  if (!clientEmail && trajet.demande_id) {
    const { data: dc } = await supabase
      .from("demandes_convoyage")
      .select("email, nom, prenom")
      .eq("id", trajet.demande_id)
      .maybeSingle();
    if (dc?.email) clientEmail = dc.email;
    if (!clientNom && dc)
      clientNom = `${dc.prenom ?? ""} ${dc.nom ?? ""}`.trim();
  }
  if (!clientEmail)
    throw new Error(
      "Email client introuvable — renseignez l'email sur la mission",
    );

  const prixTTC =
    basis.totalTtc > 0 ? basis.totalTtc : Number(trajet.prix ?? 0);
  const prixHT = micro
    ? prixTTC
    : prixTTC > 0
      ? prixTTC / (1 + vatRate / 100)
      : 0;
  const prixTVA = +(prixTTC - prixHT).toFixed(2);

  const today = new Date();
  const echeance = new Date(today.getTime() + 30 * 86400000);
  const [prenom, ...rest] = (clientNom || "").trim().split(/\s+/);
  const nomFamille = rest.join(" ") || prenom || "Client";

  const { data: inserted, error: iErr } = await supabase
    .from("factures")
    .insert({
      numero: "AUTO",
      type_facture: "particulier",
      attribution_id: basis.primaryAttributionId ?? attributionId,
      mission_id: basis.primaryMissionId,
      client_email: clientEmail,
      client_nom: nomFamille,
      client_prenom: rest.length ? prenom : null,
      date_facture: today.toISOString().slice(0, 10),
      date_mission: trajet.date_trajet,
      date_echeance: echeance.toISOString().slice(0, 10),
      mode_paiement: "Virement bancaire",
      designation: basis.isGroup
        ? "Prestation de convoyage automobile — livraison + restitution"
        : "Prestation de convoyage automobile",
      depart: basis.depart ?? trajet.depart,
      arrivee: basis.arrivee ?? trajet.arrivee,
      prix_ht: +prixHT.toFixed(2),
      prix_tva: prixTVA,
      prix_ttc: prixTTC,
      tva_taux: micro ? 0 : vatRate,
      statut: "emise",
      reference_client: refClient,
      reference_label: refLabel,
      vehicule_marque: trajet.marque,
      vehicule_modele: trajet.modele,
      vehicule_immatriculation:
        trajet.immatriculation ?? trajet.vehicule_immatriculation,
      vehicule_vin: trajet.vin ?? trajet.vehicule_vin,
    })
    .select("*")
    .single();
  if (iErr || !inserted)
    throw new Error(iErr?.message || "Insertion impossible");
  return { row: inserted as unknown as FactureRow, created: true };
}

/** Fusionne plusieurs PDF en un seul document. */
export async function mergePdfBlobs(blobs: Blob[]): Promise<Blob> {
  const { PDFDocument } = await import("pdf-lib");
  const merged = await PDFDocument.create();
  for (const b of blobs) {
    const bytes = new Uint8Array(await b.arrayBuffer());
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
  }
  const out = await merged.save();
  return new Blob([out as unknown as BlobPart], { type: "application/pdf" });
}
