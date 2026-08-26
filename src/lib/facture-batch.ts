import { supabase } from "@/integrations/supabase/client";
import { resolveGroupInvoiceBasis } from "@/lib/facture-group";
import { fetchActiveRegime } from "@/lib/pricing/fetch";
import { generateFacturePdf, type FactureData } from "@/lib/facture-pdf";

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
    mission_group_id: string | null;
    leg_index: number | null;
    leg_type: string | null;
    is_test_data: boolean | null;
  } | null;
}

/**
 * Missions terminées facturables (une seule entrée par duo Livraison + Restitution).
 * Inclut celles déjà facturées : l'admin voit le n° de facture et le PO existants.
 */
export async function listFactureCandidates(): Promise<FactureCandidate[]> {
  const { data, error } = await supabase
    .from("attributions")
    .select(
      "id, trajet_id, statut, numero_mission, created_at, trajet:trajets(depart, arrivee, date_trajet, client_nom, client_email, prix, mission_group_id, leg_index, leg_type, is_test_data)"
    )
    .in("statut", ["termine", "validee"])
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const rows = ((data ?? []) as unknown as AttrRow[]).filter((r) => !r.trajet?.is_test_data);

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
    const legOf = (x: AttrRow) => x.trajet?.leg_index ?? (x.trajet?.leg_type === "retour" ? 2 : 1);
    if (legOf(r) < legOf(prev)) byGroup.set(key, r);
  });
  // Plus récentes en premier (date de mission, à défaut date de création)
  const tsOf = (r: AttrRow) => new Date(r.trajet?.date_trajet ?? r.created_at).getTime();
  const kept = Array.from(byGroup.values()).sort((a, b) => tsOf(b) - tsOf(a));


  const attrIds = kept.map((r) => r.id);
  const trajetIds = kept.map((r) => r.trajet_id);
  const factures = new Map<string, { id: string; numero: string; reference_client: string | null; reference_label: string | null }>();
  if (attrIds.length) {
    const { data: fac } = await supabase
      .from("factures")
      .select("id, numero, attribution_id, mission_id, reference_client, reference_label")
      .or(`attribution_id.in.(${attrIds.join(",")}),mission_id.in.(${trajetIds.join(",")})`);
    (fac ?? []).forEach((f) => {
      const rec = { id: f.id as string, numero: f.numero as string, reference_client: (f.reference_client as string) ?? null, reference_label: (f.reference_label as string) ?? null };
      if (f.attribution_id) factures.set(`a:${f.attribution_id}`, rec);
      if (f.mission_id) factures.set(`m:${f.mission_id}`, rec);
    });
  }

  return kept.map((r) => {
    const t = r.trajet;
    const grouped = rows.filter((x) => keyOf(x) === keyOf(r));
    const fac = factures.get(`a:${r.id}`) ?? factures.get(`m:${r.trajet_id}`) ?? null;
    return {
      trajetId: r.trajet_id,
      attributionId: r.id,
      numeroMission: r.numero_mission ? stripLegSuffix(r.numero_mission) : (t?.date_trajet ?? null),

      clientLabel: t?.client_nom || t?.client_email || "Client",
      clientEmail: t?.client_email ?? null,
      itineraire: `${t?.depart ?? "—"} → ${t?.arrivee ?? "—"}`,
      dateMission: t?.date_trajet ?? null,
      montantTtc: Number(t?.prix ?? 0),
      isGroup: grouped.length > 1,
      factureId: fac?.id ?? null,
      factureNumero: fac?.numero ?? null,
      referenceClient: fac?.reference_client ?? null,
      referenceLabel: fac?.reference_label ?? null,
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
  } as FactureData;
}

/**
 * Récupère la facture existante d'une mission (duo compris) ou la crée.
 * Applique systématiquement la référence client (PO) fournie.
 */
export async function ensureFacture(
  trajetId: string,
  attributionId: string | null,
  po: { referenceClient?: string | null; referenceLabel?: string | null } = {}
): Promise<{ row: FactureRow; created: boolean }> {
  const basis = await resolveGroupInvoiceBasis(trajetId);
  const refClient = (po.referenceClient ?? "").trim() || null;
  const refLabel = refClient ? (po.referenceLabel || "Référence client") : (po.referenceLabel ?? null);

  if (basis.existing) {
    if (refClient) {
      await supabase
        .from("factures")
        .update({ reference_client: refClient, reference_label: refLabel })
        .eq("id", basis.existing.id);
    }
    const { data, error } = await supabase.from("factures").select("*").eq("id", basis.existing.id).single();
    if (error || !data) throw new Error(error?.message || "Facture introuvable");
    return { row: data as unknown as FactureRow, created: false };
  }

  const { data: trajet, error: tErr } = await supabase
    .from("trajets")
    .select("id, depart, arrivee, date_trajet, client_email, client_nom, prix, devis_id, demande_id")
    .eq("id", trajetId)
    .maybeSingle();
  if (tErr || !trajet) throw new Error("Trajet introuvable");

  // Email client : trajet -> devis -> demande -> profil
  let clientEmail = (trajet.client_email ?? "").trim();
  let clientNom = trajet.client_nom ?? "";
  if (!clientEmail && trajet.devis_id) {
    const { data: dv } = await supabase.from("devis").select("email, nom, prenom").eq("id", trajet.devis_id).maybeSingle();
    if (dv?.email) clientEmail = dv.email;
    if (!clientNom && dv) clientNom = `${dv.prenom ?? ""} ${dv.nom ?? ""}`.trim();
  }
  if (!clientEmail && trajet.demande_id) {
    const { data: dc } = await supabase.from("demandes_convoyage").select("email, nom, prenom").eq("id", trajet.demande_id).maybeSingle();
    if (dc?.email) clientEmail = dc.email;
    if (!clientNom && dc) clientNom = `${dc.prenom ?? ""} ${dc.nom ?? ""}`.trim();
  }
  if (!clientEmail) throw new Error("Email client introuvable — renseignez l'email sur la mission");

  const prixTTC = basis.totalTtc > 0 ? basis.totalTtc : Number(trajet.prix ?? 0);
  const { regime, vatRate } = await fetchActiveRegime();
  const micro = regime !== "societe";
  const prixHT = micro ? prixTTC : prixTTC > 0 ? prixTTC / (1 + vatRate / 100) : 0;
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
    })
    .select("*")
    .single();
  if (iErr || !inserted) throw new Error(iErr?.message || "Insertion impossible");
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
