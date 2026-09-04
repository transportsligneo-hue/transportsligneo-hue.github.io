import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const COST_CATEGORIES = [
  { id: "carburant", label: "Carburant / énergie" },
  { id: "entretien", label: "Entretien & révisions" },
  { id: "assurance", label: "Assurance" },
  { id: "pneumatiques", label: "Pneumatiques" },
  { id: "peages", label: "Péages" },
  { id: "amendes", label: "Amendes" },
  { id: "convoyage", label: "Convoyage & transport" },
  { id: "financement", label: "Financement / acquisition" },
  { id: "taxes", label: "Taxes & malus" },
  { id: "depreciation", label: "Dépréciation" },
  { id: "autre", label: "Autre" },
] as const;

export type CostCategory = (typeof COST_CATEGORIES)[number]["id"];

export type VehicleTco = {
  vehicle_id: string;
  total: number;
  brut: number;
  revente: number;
  par_categorie: Record<string, number>;
  kilometrage: number;
  tco_km: number | null;
  tco_mensuel: number;
  mois_service: number;
};

export type FleetTco = {
  total: number;
  par_categorie: Record<string, number>;
  vehicules: Array<{
    id: string;
    immatriculation: string | null;
    marque: string | null;
    modele: string | null;
    type_vehicule: string | null;
    site_id: string | null;
    kilometrage: number;
    total: number;
    tco_km: number | null;
  }>;
};

export type FleetAlert = {
  type: "controle_technique" | "revision" | "contrat" | "tco_eleve";
  vehicle_id: string;
  immatriculation: string | null;
  severite: "critique" | "haute" | "moyenne";
  date?: string | null;
  km_restants?: number | null;
  tco_km?: number | null;
  moyenne?: number | null;
};

const num = (v: unknown) => (v == null ? 0 : Number(v));

/* ------------------------------------------------------------------ */
/* Vue d'ensemble flotte                                               */
/* ------------------------------------------------------------------ */

export const getFleetOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string; from?: string | null; to?: string | null; siteId?: string | null }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [tcoRes, alertsRes, sitesRes, settingsRes] = await Promise.all([
      supabase.rpc("get_fleet_tco", {
        _org_id: data.orgId,
        _from: data.from ?? null,
        _to: data.to ?? null,
        _site_id: data.siteId ?? null,
      }),
      supabase.rpc("get_fleet_alerts", { _org_id: data.orgId }),
      supabase.from("organization_sites").select("id, nom").eq("organization_id", data.orgId),
      supabase.from("fleet_settings").select("*").eq("organization_id", data.orgId).maybeSingle(),
    ]);

    if (tcoRes.error) throw new Error(tcoRes.error.message);

    return {
      tco: (tcoRes.data ?? { total: 0, par_categorie: {}, vehicules: [] }) as unknown as FleetTco,
      alerts: ((alertsRes.data ?? []) as unknown as FleetAlert[]),
      sites: (sitesRes.data ?? []) as Array<{ id: string; nom: string | null }>,
      settings: settingsRes.data as { tco_ecart_seuil_pct: number; alertes_email_actives: boolean } | null,
    };
  });

/* ------------------------------------------------------------------ */
/* Fiche véhicule : coûts & TCO                                        */
/* ------------------------------------------------------------------ */

export const getVehicleCostDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { vehicleId: string; from?: string | null; to?: string | null }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [tcoRes, costsRes, contractsRes, eventsRes] = await Promise.all([
      supabase.rpc("get_vehicle_tco", {
        _vehicle_id: data.vehicleId,
        _from: data.from ?? null,
        _to: data.to ?? null,
      }),
      supabase
        .from("vehicle_costs")
        .select("*")
        .eq("vehicle_id", data.vehicleId)
        .order("date_cout", { ascending: false })
        .limit(1000),
      supabase.from("vehicle_finance_contracts").select("*").eq("vehicle_id", data.vehicleId),
      supabase
        .from("vehicle_service_events")
        .select("*")
        .eq("vehicle_id", data.vehicleId)
        .order("date_prevue", { ascending: true }),
    ]);

    if (tcoRes.error) throw new Error(tcoRes.error.message);

    const costs = (costsRes.data ?? []).map((c) => ({ ...c, montant: num(c.montant) }));
    // courbe de TCO cumulé (lignes actives, ordre chronologique)
    let cumul = 0;
    const serie = costs
      .filter((c) => c.statut === "actif")
      .slice()
      .sort((a, b) => (a.date_cout < b.date_cout ? -1 : 1))
      .map((c) => {
        cumul += c.montant;
        return { date: c.date_cout, cumul: Math.round(cumul * 100) / 100 };
      });

    return {
      tco: tcoRes.data as unknown as VehicleTco,
      costs,
      serie,
      contracts: contractsRes.data ?? [],
      events: eventsRes.data ?? [],
    };
  });

/* ------------------------------------------------------------------ */
/* Écritures                                                           */
/* ------------------------------------------------------------------ */

export const addVehicleCost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      vehicleId: string;
      categorie: CostCategory;
      montant: number;
      dateCout: string;
      libelle?: string | null;
      notes?: string | null;
      kilometrage?: number | null;
      justificatifPath: string;
    }) => {
      if (!d.vehicleId) throw new Error("Véhicule manquant");
      if (!(d.montant > 0)) throw new Error("Montant invalide");
      if (!d.justificatifPath) throw new Error("Justificatif obligatoire");
      return d;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("vehicle_costs")
      .insert({
        vehicle_id: data.vehicleId,
        categorie: data.categorie,
        montant: data.montant,
        date_cout: data.dateCout,
        source: "manuel",
        libelle: data.libelle || null,
        notes: data.notes || null,
        kilometrage: data.kilometrage ?? null,
        justificatif_path: data.justificatifPath,
        created_by: userId,
      })
      .select("id")
      .single();

    if (error) {
      // rollback : on retire le justificatif déjà déposé pour ne laisser aucun orphelin
      await supabase.storage.from("vehicle-costs").remove([data.justificatifPath]);
      throw new Error(error.message);
    }
    return { id: row.id };
  });

export const archiveVehicleCost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { costId: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("vehicle_costs")
      .update({ statut: "archive", archived_at: new Date().toISOString() })
      .eq("id", data.costId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getCostReceiptUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { path: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: signed, error } = await context.supabase.storage
      .from("vehicle-costs")
      .createSignedUrl(data.path, 300);
    if (error || !signed?.signedUrl) throw new Error(error?.message ?? "Lien indisponible");
    return { url: signed.signedUrl };
  });

export const saveFinanceContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id?: string | null;
      vehicleId: string;
      type: string;
      valeurAcquisition?: number | null;
      loyerMensuel?: number | null;
      dureeMois?: number | null;
      dateDebut?: string | null;
      dateFin?: string | null;
      valeurResiduelle?: number | null;
      organisme?: string | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const payload = {
      vehicle_id: data.vehicleId,
      type: data.type,
      valeur_acquisition: data.valeurAcquisition ?? null,
      loyer_mensuel: data.loyerMensuel ?? null,
      duree_mois: data.dureeMois ?? null,
      date_debut: data.dateDebut || null,
      date_fin: data.dateFin || null,
      valeur_residuelle: data.valeurResiduelle ?? null,
      organisme: data.organisme || null,
      created_by: context.userId,
    };
    const q = data.id
      ? context.supabase.from("vehicle_finance_contracts").update(payload).eq("id", data.id)
      : context.supabase.from("vehicle_finance_contracts").insert(payload);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveServiceEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id?: string | null;
      vehicleId: string;
      type: string;
      datePrevue?: string | null;
      dateRealisee?: string | null;
      kilometragePrevu?: number | null;
      statut?: string;
      notes?: string | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const payload = {
      vehicle_id: data.vehicleId,
      type: data.type,
      date_prevue: data.datePrevue || null,
      date_realisee: data.dateRealisee || null,
      kilometrage_prevu: data.kilometragePrevu ?? null,
      statut: data.statut ?? "planifie",
      notes: data.notes || null,
      created_by: context.userId,
    };
    const q = data.id
      ? context.supabase.from("vehicle_service_events").update(payload).eq("id", data.id)
      : context.supabase.from("vehicle_service_events").insert(payload);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveFleetSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string; seuilPct: number; emailsActifs: boolean; emails: string[] }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("fleet_settings").upsert(
      {
        organization_id: data.orgId,
        tco_ecart_seuil_pct: data.seuilPct,
        alertes_email_actives: data.emailsActifs,
        alert_emails: data.emails,
      },
      { onConflict: "organization_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Rôles & périmètres                                                  */
/* ------------------------------------------------------------------ */

export const FLEET_ROLES = [
  { id: "fleet_viewer", label: "Lecture seule" },
  { id: "fleet_ops", label: "Gestion missions" },
  { id: "fleet_finance", label: "Gestion financière" },
  { id: "fleet_admin", label: "Admin flotte" },
] as const;

export const getFleetMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: members, error } = await supabase
      .from("organization_members")
      .select("id, user_id, member_role, status")
      .eq("organization_id", data.orgId)
      .eq("status", "active");
    if (error) throw new Error(error.message);

    const ids = (members ?? []).map((m) => m.user_id);
    const [{ data: profiles }, { data: links }] = await Promise.all([
      ids.length
        ? supabase.from("profiles").select("id, user_id, email, prenom, nom").in("user_id", ids)
        : Promise.resolve({ data: [] as never[] }),
      supabase
        .from("organization_member_sites")
        .select("member_id, site_id")
        .in("member_id", (members ?? []).map((m) => m.id)),
    ]);

    return (members ?? []).map((m) => {
      const p = (profiles ?? []).find((x: { user_id: string | null }) => x.user_id === m.user_id);
      return {
        id: m.id,
        user_id: m.user_id,
        role: m.member_role,
        email: p?.email ?? null,
        nom: [p?.prenom, p?.nom].filter(Boolean).join(" ") || null,
        sites: (links ?? []).filter((l) => l.member_id === m.id).map((l) => l.site_id),
      };
    });
  });

export const updateFleetMemberAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { memberId: string; role: string; siteIds: string[] }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error: roleErr } = await supabase
      .from("organization_members")
      .update({ member_role: data.role })
      .eq("id", data.memberId);
    if (roleErr) throw new Error(roleErr.message);

    const { error: delErr } = await supabase
      .from("organization_member_sites")
      .delete()
      .eq("member_id", data.memberId);
    if (delErr) throw new Error(delErr.message);

    if (data.siteIds.length > 0) {
      const { error: insErr } = await supabase
        .from("organization_member_sites")
        .insert(data.siteIds.map((site_id) => ({ member_id: data.memberId, site_id })));
      if (insErr) throw new Error(insErr.message);
    }
    return { ok: true };
  });
