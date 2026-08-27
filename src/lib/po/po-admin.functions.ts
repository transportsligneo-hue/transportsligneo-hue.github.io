import { createServerFn } from "@tanstack/react-start";

import { verifyAdminAccess } from "@/lib/admin-guard.functions";

export type PoRow = {
  id: string;
  numero_po: string;
  vin: string | null;
  montant_ht: number | null;
  date_commande: string | null;
  date_livraison: string | null;
  destinataire: string | null;
  adresse_livraison: string | null;
  contact_livraison: string | null;
  designation: string | null;
  email_subject: string | null;
  email_received_at: string | null;
  pdf_path: string | null;
  devis_id: string | null;
  mission_id: string | null;
  statut: "non_rapproche" | "rapproche" | "ambigu" | "erreur_extraction";
  candidats: { id: string; numero: string; created_at: string; prix_estime: number | null; client: string; arrivee: string | null }[];
  extraction_error: string | null;
  created_at: string;
  devis?: { numero: string; nom: string; prenom: string; depart: string; arrivee: string; prix_estime: number } | null;
};

export const listBonsCommande = createServerFn({ method: "GET" }).handler(async (): Promise<PoRow[]> => {
  await verifyAdminAccess();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("bons_commande")
    .select("*, devis:devis_id(numero, nom, prenom, depart, arrivee, prix_estime)")
    .order("created_at", { ascending: false })
    .limit(400);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PoRow[];
});

export const getPoBadgeCount = createServerFn({ method: "GET" }).handler(async (): Promise<number> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("bons_commande")
    .select("id", { count: "exact", head: true })
    .in("statut", ["ambigu", "erreur_extraction"]);
  return count ?? 0;
});

/** Lien signé (bucket privé) vers le PDF du bon de commande. */
export const getPoPdfUrl = createServerFn({ method: "POST" })
  .inputValidator((d: { path: string }) => d)
  .handler(async ({ data }): Promise<string | null> => {
    await verifyAdminAccess();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed } = await supabaseAdmin.storage
      .from("bons-commande")
      .createSignedUrl(data.path, 60 * 10);
    return signed?.signedUrl ?? null;
  });

/** Rapprochement manuel (candidat ambigu ou devis choisi par l'admin). */
export const linkPoToDevis = createServerFn({ method: "POST" })
  .inputValidator((d: { poId: string; devisId: string }) => d)
  .handler(async ({ data }) => {
    await verifyAdminAccess();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: devis, error } = await supabaseAdmin
      .from("devis")
      .select("id, numero, mission_id")
      .eq("id", data.devisId)
      .single();
    if (error || !devis) throw new Error("Devis introuvable");

    await supabaseAdmin
      .from("bons_commande")
      .update({
        devis_id: devis.id,
        mission_id: (devis.mission_id as string | null) ?? null,
        statut: "rapproche",
        candidats: [],
      } as never)
      .eq("id", data.poId);

    await supabaseAdmin
      .from("devis")
      .update({ statut: "accepte", accepted_at: new Date().toISOString() } as never)
      .eq("id", devis.id);

    const { data: po } = await supabaseAdmin
      .from("bons_commande").select("numero_po, vin").eq("id", data.poId).single();

    let applied = { trajets: 0 };
    if (po?.numero_po) {
      const { applyPoToOperations } = await import("@/lib/po/po-sync.server");
      applied = await applyPoToOperations(
        supabaseAdmin,
        po.numero_po as string,
        devis.id as string,
        (po.vin as string | null) ?? null,
      );
    }

    await supabaseAdmin.from("po_import_logs").insert({
      numero_po: (po?.numero_po as string | null) ?? null, resultat: "rapproche_manuel",
      details: { devis: devis.numero, missions_mises_a_jour: applied.trajets },
    } as never);

    return { ok: true, missions: applied.trajets };
  });


/** Détache un PO d'un devis (erreur de rapprochement). */
export const unlinkPo = createServerFn({ method: "POST" })
  .inputValidator((d: { poId: string }) => d)
  .handler(async ({ data }) => {
    await verifyAdminAccess();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("bons_commande")
      .update({ devis_id: null, mission_id: null, statut: "non_rapproche" } as never)
      .eq("id", data.poId);
    return { ok: true };
  });

/** Recherche de devis par VIN / numéro / client pour rapprochement manuel. */
export const searchDevisForPo = createServerFn({ method: "POST" })
  .inputValidator((d: { query: string }) => d)
  .handler(async ({ data }) => {
    await verifyAdminAccess();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const q = data.query.trim();
    if (q.length < 3) return [];
    const { data: rows } = await supabaseAdmin
      .from("devis")
      .select("id, numero, nom, prenom, depart, arrivee, prix_estime, statut, vin, created_at")
      .or(`vin.ilike.%${q}%,numero.ilike.%${q}%,nom.ilike.%${q}%,immatriculation_retour.ilike.%${q}%`)
      .order("created_at", { ascending: false })
      .limit(20);
    return rows ?? [];
  });

/** Import manuel depuis l'admin (bouton « Synchroniser Gmail »). */
export const runGmailPoSync = createServerFn({ method: "POST" }).handler(async () => {
  await verifyAdminAccess();
  const { syncPoFromGmail } = await import("@/lib/po/po-sync.server");
  return await syncPoFromGmail(40);
});

/** Relance le rapprochement d'un PO existant (après correction d'un VIN de devis). */
export const retryPoMatch = createServerFn({ method: "POST" })
  .inputValidator((d: { poId: string }) => d)
  .handler(async ({ data }) => {
    await verifyAdminAccess();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { matchPoToDevis } = await import("@/lib/po/po-sync.server");
    const { data: po } = await supabaseAdmin
      .from("bons_commande").select("id, numero_po, vin").eq("id", data.poId).single();
    if (!po?.vin) throw new Error("VIN manquant sur ce bon de commande");
    const outcome = await matchPoToDevis(supabaseAdmin, po.id as string, po.numero_po as string, po.vin as string);
    return { outcome };
  });

/** Correction manuelle du VIN d'un PO en erreur d'extraction, puis rapprochement. */
export const setPoVin = createServerFn({ method: "POST" })
  .inputValidator((d: { poId: string; vin: string }) => d)
  .handler(async ({ data }) => {
    await verifyAdminAccess();
    const { normalizeVin, isValidVinFormat } = await import("@/lib/vin");
    const vin = normalizeVin(data.vin);
    if (!isValidVinFormat(vin)) throw new Error("VIN invalide (17 caractères, hors I/O/Q)");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { matchPoToDevis } = await import("@/lib/po/po-sync.server");
    const { data: po } = await supabaseAdmin
      .from("bons_commande")
      .update({ vin, extraction_error: null, statut: "non_rapproche" } as never)
      .eq("id", data.poId)
      .select("id, numero_po")
      .single();
    if (!po) throw new Error("Bon de commande introuvable");
    const outcome = await matchPoToDevis(supabaseAdmin, po.id as string, po.numero_po as string, vin);
    return { outcome };
  });

/** PO rattaché à un devis / une mission (fiches détail). */
export const getPoForRecord = createServerFn({ method: "POST" })
  .inputValidator((d: { devisId?: string; missionId?: string }) => d)
  .handler(async ({ data }): Promise<PoRow | null> => {
    await verifyAdminAccess();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const filters: string[] = [];
    if (data.devisId) filters.push(`devis_id.eq.${data.devisId}`);
    if (data.missionId) filters.push(`mission_id.eq.${data.missionId}`);
    if (!filters.length) return null;
    const { data: rows } = await supabaseAdmin
      .from("bons_commande")
      .select("*")
      .or(filters.join(","))
      .limit(1);
    return ((rows ?? [])[0] as unknown as PoRow) ?? null;
  });
