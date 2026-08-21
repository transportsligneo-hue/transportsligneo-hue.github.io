import { createFileRoute, Link } from "@tanstack/react-router";
import AdminSectionHeader from "@/components/admin/AdminSectionHeader";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { VehiculesPrixDialog } from "@/components/admin/VehiculesPrixDialog";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { RefreshCw, Search, Route as RouteIcon, ArrowRight, ArrowLeftRight, ClipboardList, Zap, Fuel, CalendarDays, Layers } from "lucide-react";
import { MissionUnifiedPanel } from "@/components/admin/missions/MissionUnifiedPanel";
import {
  UNIFIED_ORDER,
  UNIFIED_STATUS,
  trajetToUnified,
  type UnifiedMission,
  type UnifiedStatus,
} from "@/components/admin/missions/mission-unified-types";
import {
  ColumnsMenu,
  ConvoyeurCell,
  FactureQuickLink,
  MISSION_COLUMNS,
  PaymentBadge,
  paymentState,
  type ConvoyeurOption,
  type FactureLite,
  type MissionMeta,
} from "@/components/admin/missions/MissionsTableExtras";
import { displayTrajetRef, displayNumero, stripLegSuffix, hasLegSuffix } from "@/lib/mission-number";
import { LegSuffixLegend } from "@/components/admin/LegSuffixLegend";
import { CreateTestMissionButton } from "@/components/admin/TestMissionActions";
import { RadarEmptyV6 } from "@/components/admin/dashboard/RadarEmptyV6";
import { useMissionAlerts } from "@/hooks/useMissionAlerts";
import { SEVERITY_META } from "@/lib/mission-alerts";
import { ClientBrand, clientBrandOf, useClientBrands } from "@/components/admin/ClientBrand";
import { RechargeBadge, isRechargeSeule } from "@/components/admin/RechargeBadge";
import { useMissionPv, pvOf } from "@/components/admin/MissionPvBadges";

export const Route = createFileRoute("/_authenticated/admin/missions/")({
  component: AdminMissionsUnified,
});

interface TrajetRow {
  id: string; depart: string; arrivee: string; date_trajet: string | null; heure_trajet: string | null;
  date_souhaitee: string | null;
  marque: string | null; modele: string | null; immatriculation: string | null;
  vehicule_immatriculation: string | null; vin: string | null; vehicule_vin: string | null;
  vehicule_energie: string | null; mission_id: string | null; options_meta?: unknown;
  client_nom: string | null; client_email: string | null; client_telephone: string | null;
  prix: number | null; prix_convoyeur: number | null; tarif_convoyeur: number | null;
  prix_suggere: number | null; statut: string; statut_publication: string | null;
  demande_id: string | null; created_at: string; is_test_data: boolean | null;
  mission_group_id: string | null; leg_type: string | null; leg_index: number | null;
  pricing_mode: "fixe" | "enchere" | null; prix_client_ttc: number | null;
  prix_convoyeur_fixe: number | null; prix_convoyeur_min: number | null; prix_convoyeur_max: number | null;
  marge_indicative_pct: number | null; type_mission: string | null; numero_mission: string | null;
  lot_id: string | null; lot_reference: string | null;
}

interface DemandeRow {
  id: string; nom: string; prenom: string; email: string | null; telephone: string | null;
  depart: string; arrivee: string; date_souhaitee: string | null; heure_souhaitee: string | null;
  marque: string | null; modele: string | null; immatriculation: string | null;
  prix_estime: number | null; statut: string; created_at: string; date_retour: string | null; depart_retour: string | null;
}

const PRIORITY: Record<string, number> = { en_cours: 60, attribue: 50, accepte: 40, en_attente: 30, termine: 20, annule: 10 };
const ACTIVE_ATTR = ["propose", "accepte", "en_cours", "en_attente_validation"];
const TABLE_KEY = "admin_missions";

const QUICK_STATUS: { value: string; label: string }[] = [
  { value: "attribue", label: "Attribuée" },
  { value: "en_cours", label: "En cours" },
  { value: "termine", label: "Terminée" },
  { value: "annule", label: "Annulée" },
];

function isElectric(energie: string | null | undefined) {
  const e = (energie ?? "").toLowerCase();
  return e.includes("elec") || e.includes("élec") || e === "ev";
}

function MissionDateCell({
  refLabel,
  date,
  heure,
  onChange,
}: {
  refLabel: string;
  date: string | null;
  heure: string | null;
  onChange: (field: "date_trajet" | "heure_trajet", value: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <div className="flex items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
        <CalendarDays size={12} className="shrink-0 text-[var(--a6-accent)]" />
        <span className={date ? "font-semibold text-[var(--a6-text)]" : "font-semibold text-amber-700"}>
          {date ? new Date(date).toLocaleDateString("fr-FR") : "À planifier"}
          {date && heure ? ` · ${heure.slice(0, 5)}` : ""}
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-md border border-[var(--a6-border)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--a6-accent)] transition hover:bg-[var(--a6-accent)]/10"
        >
          Modifier
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-1.5" onClick={(event) => event.stopPropagation()}>
      <input
        type="date"
        autoFocus
        value={date?.slice(0, 10) ?? ""}
        aria-label={`Date de mission ${refLabel}`}
        onChange={(event) => onChange("date_trajet", event.target.value)}
        className="h-8 w-full rounded-md border border-[var(--a6-border)] bg-[var(--a6-surface)] px-2 text-[11px] font-semibold text-[var(--a6-text)] outline-none focus:border-[var(--a6-accent)]"
      />
      <input
        type="time"
        value={heure?.slice(0, 5) ?? ""}
        aria-label={`Heure de mission ${refLabel}`}
        onChange={(event) => onChange("heure_trajet", event.target.value)}
        className="h-8 w-full rounded-md border border-[var(--a6-border)] bg-[var(--a6-surface)] px-2 text-[11px] font-medium text-[var(--a6-text)] outline-none focus:border-[var(--a6-accent)]"
      />
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="justify-self-start rounded-md px-1 text-[10px] font-semibold text-[var(--a6-dim)] hover:text-[var(--a6-text)]"
      >
        Terminé
      </button>
    </div>
  );
}



function AdminMissionsUnified() {
  const { user } = useAuth();
  const [rows, setRows] = useState<UnifiedMission[]>([]);
  const [meta, setMeta] = useState<Map<string, MissionMeta>>(new Map());
  const [convoyeurs, setConvoyeurs] = useState<ConvoyeurOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<UnifiedStatus | "all">("all");
  const [convFilter, setConvFilter] = useState("all");
  const [payFilter, setPayFilter] = useState("all");
  const [energyFilter, setEnergyFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<UnifiedMission | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [lotBusy, setLotBusy] = useState(false);
  const [prixLot, setPrixLot] = useState<{ ids: string[]; ref: string } | null>(null);
  const { byTrajet: alertsByTrajet } = useMissionAlerts("active");
  const clientBrands = useClientBrands(rows.map((r) => r.clientEmail));
  const pvMap = useMissionPv(Array.from(meta.values()).map((m) => m.attributionId));

  const show = useCallback((key: string) => !hidden.has(key), [hidden]);
  const colCount = useMemo(() => MISSION_COLUMNS.filter((c) => !hidden.has(c.key)).length + 1, [hidden]);

  /* ---------------- Préférences de colonnes (par admin) ---------------- */
  useEffect(() => {
    if (!user) return;
    supabase
      .from("admin_table_prefs")
      .select("hidden_columns")
      .eq("user_id", user.id)
      .eq("table_key", TABLE_KEY)
      .maybeSingle()
      .then(({ data }) => {
        const cols = (data?.hidden_columns ?? null) as string[] | null;
        if (Array.isArray(cols)) setHidden(new Set(cols));
      });
  }, [user]);

  const toggleColumn = async (key: string) => {
    const next = new Set(hidden);
    if (next.has(key)) next.delete(key); else next.add(key);
    setHidden(next);
    if (!user) return;
    await supabase
      .from("admin_table_prefs")
      .upsert(
        { user_id: user.id, table_key: TABLE_KEY, hidden_columns: Array.from(next) },
        { onConflict: "user_id,table_key" },
      );
  };

  /* ---------------- Chargement ---------------- */
  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: trajetsData }, { data: demandesData }, { data: attributionsData }, { data: convData }] = await Promise.all([
      supabase.from("trajets").select("*").order("created_at", { ascending: false }),
      supabase
        .from("demandes_convoyage")
        .select("id, nom, prenom, email, telephone, depart, arrivee, date_souhaitee, heure_souhaitee, marque, modele, immatriculation, prix_estime, statut, created_at, date_retour, depart_retour")
        .in("statut", ["nouvelle", "a_traiter"])
        .order("created_at", { ascending: false }),
      supabase.from("attributions").select("id, trajet_id, convoyeur_id, statut, numero_mission, created_at"),
      supabase.from("convoyeurs").select("id, prenom, nom, statut").eq("statut", "valide").order("nom"),
    ]);

    setConvoyeurs(
      ((convData ?? []) as { id: string; prenom: string | null; nom: string | null }[]).map((c) => ({
        id: c.id,
        nom: `${c.prenom ?? ""} ${c.nom ?? ""}`.trim() || "Convoyeur",
      })),
    );

    const trajets = ((trajetsData ?? []) as unknown as TrajetRow[]).filter(
      (t) => !(t.depart ?? "").trim().toLowerCase().includes("partenariat"),
    );

    const deduped = new Map<string, TrajetRow>();
    trajets.forEach((t) => {
      const key = t.demande_id
        ? `demande:${t.demande_id}:${t.mission_group_id ?? "solo"}:${t.leg_type ?? "simple"}:${t.leg_index ?? 1}`
        : `trajet:${t.id}`;
      const cur = deduped.get(key);
      if (!cur) { deduped.set(key, t); return; }
      const p1 = PRIORITY[cur.statut] ?? 0;
      const p2 = PRIORITY[t.statut] ?? 0;
      if (p2 > p1 || (p2 === p1 && new Date(t.created_at) > new Date(cur.created_at))) deduped.set(key, t);
    });

    const convertedDemandeIds = new Set(trajets.map((t) => t.demande_id).filter(Boolean) as string[]);

    const attrRows = (attributionsData ?? []) as unknown as {
      id: string; trajet_id: string | null; convoyeur_id: string | null; numero_mission: string | null; statut: string | null; created_at: string;
    }[];
    const numeroByTrajet = new Map<string, string>();
    const activeAttrByTrajet = new Map<string, { id: string; convoyeur_id: string | null; statut: string | null }>();
    attrRows.forEach((a) => {
      if (!a.trajet_id) return;
      if (a.numero_mission && !numeroByTrajet.has(a.trajet_id)) numeroByTrajet.set(a.trajet_id, a.numero_mission);
      if (ACTIVE_ATTR.includes(a.statut ?? "") && !activeAttrByTrajet.has(a.trajet_id)) {
        activeAttrByTrajet.set(a.trajet_id, { id: a.id, convoyeur_id: a.convoyeur_id, statut: a.statut });
      }
    });

    // Convoyeurs référencés (même non validés) pour l'affichage du nom
    const convIds = Array.from(new Set(Array.from(activeAttrByTrajet.values()).map((a) => a.convoyeur_id).filter(Boolean))) as string[];
    const convNames = new Map<string, string>();
    ((convData ?? []) as { id: string; prenom: string | null; nom: string | null }[]).forEach((c) =>
      convNames.set(c.id, `${c.prenom ?? ""} ${c.nom ?? ""}`.trim()),
    );
    const missingConv = convIds.filter((id) => !convNames.has(id));
    if (missingConv.length) {
      const { data } = await supabase.from("convoyeurs").select("id, prenom, nom").in("id", missingConv);
      ((data ?? []) as { id: string; prenom: string | null; nom: string | null }[]).forEach((c) =>
        convNames.set(c.id, `${c.prenom ?? ""} ${c.nom ?? ""}`.trim()),
      );
    }

    // Factures liées (via mission_id du trajet)
    const missionIds = Array.from(new Set(trajets.map((t) => t.mission_id).filter(Boolean))) as string[];
    const factureByMission = new Map<string, FactureLite>();
    if (missionIds.length) {
      const { data } = await supabase
        .from("factures")
        .select("id, numero, statut, total_ttc, prix_ttc, date_echeance, pdf_url, mission_id")
        .in("mission_id", missionIds);
      ((data ?? []) as unknown as {
        id: string; numero: string; statut: string | null; total_ttc: number | null; prix_ttc: number | null;
        date_echeance: string | null; pdf_url: string | null; mission_id: string | null;
      }[]).forEach((f) => {
        if (!f.mission_id || factureByMission.has(f.mission_id)) return;
        factureByMission.set(f.mission_id, {
          id: f.id,
          numero: f.numero,
          statut: f.statut,
          total: f.total_ttc ?? f.prix_ttc,
          echeance: f.date_echeance,
          pdfUrl: f.pdf_url,
        });
      });
    }

    const metaMap = new Map<string, MissionMeta>();
    trajets.forEach((t) => {
      const attr = activeAttrByTrajet.get(t.id);
      metaMap.set(t.id, {
        convoyeurId: attr?.convoyeur_id ?? null,
        convoyeurNom: attr?.convoyeur_id ? convNames.get(attr.convoyeur_id) ?? "Convoyeur" : null,
        attributionStatut: attr?.statut ?? null,
        attributionId: attr?.id ?? null,
        facture: t.mission_id ? factureByMission.get(t.mission_id) ?? null : null,
        vin: t.vin ?? t.vehicule_vin ?? null,
        energie: t.vehicule_energie ?? null,
        missionId: t.mission_id ?? null,
      });
    });
    setMeta(metaMap);

    const baseByGroup = new Map<string, string>();
    trajets.forEach((t) => {
      if (!t.mission_group_id) return;
      const num = t.numero_mission ?? numeroByTrajet.get(t.id);
      if (!num) return;
      const base = stripLegSuffix(num);
      const cur = baseByGroup.get(t.mission_group_id);
      if (!cur || (t.leg_index ?? 1) === 1 || base < cur) baseByGroup.set(t.mission_group_id, base);
    });

    const trajetMissions: UnifiedMission[] = Array.from(deduped.values()).map((t) => {
      const isAR = !!t.mission_group_id || t.type_mission === "aller_retour";
      const storedNumero = t.numero_mission ?? numeroByTrajet.get(t.id) ?? null;
      const ref = storedNumero
        ? displayNumero(storedNumero)
        : displayTrajetRef({
            id: t.id,
            createdAt: t.created_at,
            groupId: t.mission_group_id,
            isRoundTrip: isAR,
            legType: t.leg_type,
            legIndex: t.leg_index,
            baseNumero: t.mission_group_id ? baseByGroup.get(t.mission_group_id) : null,
          });
      return {
        kind: "trajet",
        id: t.id,
        ref,
        status: trajetToUnified(t.statut),
        depart: t.depart,
        arrivee: t.arrivee,
        date: t.date_trajet ?? t.date_souhaitee,
        heure: t.heure_trajet,
        marque: t.marque,
        modele: t.modele,
        immatriculation: t.immatriculation ?? t.vehicule_immatriculation,
        clientNom: t.client_nom,
        clientEmail: t.client_email,
        clientTel: t.client_telephone,
        prix: t.prix,
        prixConvoyeur: t.prix_convoyeur ?? t.tarif_convoyeur,
        prixSuggere: t.prix_suggere,
        statutPublication: t.statut_publication,
        isRoundTrip: isAR,
        legType: t.leg_type,
        groupId: t.mission_group_id,
        legIndex: t.leg_index,
        isTest: !!t.is_test_data,
        createdAt: t.created_at,
        pricingMode: t.pricing_mode,
        prixClientTtc: t.prix_client_ttc,
        prixConvoyeurFixe: t.prix_convoyeur_fixe,
        prixConvoyeurMin: t.prix_convoyeur_min,
        prixConvoyeurMax: t.prix_convoyeur_max,
        margeIndicativePct: t.marge_indicative_pct,
        rechargeSeule: isRechargeSeule(t),
        lotId: t.lot_id ?? null,
        lotRef: t.lot_reference ?? null,
      };
    });

    const demandeMissions: UnifiedMission[] = ((demandesData ?? []) as unknown as DemandeRow[])
      .filter((d) => !convertedDemandeIds.has(d.id))
      .map((d) => ({
        kind: "demande",
        id: d.id,
        ref: `DEM-TLG-${new Date(d.created_at).getFullYear()}-#${d.id.replace(/-/g, "").slice(-3).toUpperCase()}`,
        status: "nouvelle",
        depart: d.depart,
        arrivee: d.arrivee,
        date: d.date_souhaitee,
        heure: d.heure_souhaitee,
        marque: d.marque,
        modele: d.modele,
        immatriculation: d.immatriculation,
        clientNom: `${d.prenom ?? ""} ${d.nom ?? ""}`.trim(),
        clientEmail: d.email,
        clientTel: d.telephone,
        prix: d.prix_estime,
        prixConvoyeur: null,
        prixSuggere: null,
        statutPublication: null,
        isRoundTrip: Boolean(d.date_retour || d.depart_retour),
        legType: null,
        isTest: false,
        createdAt: d.created_at,
      }));

    setRows(
      [...demandeMissions, ...trajetMissions].sort((a, b) => {
        const ta = new Date(a.createdAt).getTime();
        const tb = new Date(b.createdAt).getTime();
        if (tb !== ta) return tb - ta;
        if (a.groupId && a.groupId === b.groupId) return (a.legIndex ?? 1) - (b.legIndex ?? 1);
        return 0;
      }),
    );

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel("admin-missions-unified")
      .on("postgres_changes", { event: "*", schema: "public", table: "trajets" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "attributions" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "demandes_convoyage" }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  /* ---------------- Actions rapides ---------------- */
  const assignConvoyeur = async (trajetId: string, convoyeurId: string) => {
    const { error } = await supabase.rpc("admin_assign_convoyeur", {
      _trajet_id: trajetId,
      _convoyeur_id: convoyeurId,
    });
    if (error) return toast.error(error.message);
    toast.success("Convoyeur attribué");
    fetchAll();
  };

  const quickStatus = async (trajetId: string, statut: string) => {
    const { error } = await supabase.from("trajets").update({ statut }).eq("id", trajetId);
    if (error) return toast.error(error.message);
    toast.success("Statut mis à jour");
    fetchAll();
  };

  const updatePlanning = async (trajetId: string, key: "date_trajet" | "heure_trajet", value: string) => {
    const { error } = await supabase.rpc("admin_update_mission_infos" as never, {
      _trajet_id: trajetId,
      _patch: { [key]: value || null } as never,
    } as never);
    if (error) return toast.error("Planning non enregistré", { description: error.message });
    toast.success(key === "date_trajet" ? "Date de mission enregistrée" : "Heure enregistrée");
    fetchAll();
  };

  /* ---------------- Lots multi-plaques ---------------- */
  const togglePick = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const groupLot = async () => {
    const ids = Array.from(picked);
    if (ids.length < 2) return toast.error("Sélectionnez au moins deux missions");
    setLotBusy(true);
    const { data, error } = await supabase.rpc("admin_group_trajets_lot" as never, { _trajet_ids: ids } as never);
    setLotBusy(false);
    if (error) return toast.error("Regroupement impossible", { description: error.message });
    const ref = (data as { lot_reference?: string }[] | null)?.[0]?.lot_reference;
    toast.success(`Lot créé${ref ? ` · ${ref}` : ""}`, { description: `${ids.length} plaques regroupées` });
    setPicked(new Set());
    fetchAll();
  };

  const ungroupLot = async (ids: string[]) => {
    if (!ids.length) return;
    setLotBusy(true);
    const { error } = await supabase.rpc("admin_ungroup_trajets_lot" as never, { _trajet_ids: ids } as never);
    setLotBusy(false);
    if (error) return toast.error("Dégroupage impossible", { description: error.message });
    toast.success("Missions dégroupées");
    setPicked(new Set());
    fetchAll();
  };

  const assignMany = async (ids: string[], convoyeurId: string) => {
    if (!convoyeurId || !ids.length) return;
    setLotBusy(true);
    let ok = 0;
    for (const id of ids) {
      const { error } = await supabase.rpc("admin_assign_convoyeur", { _trajet_id: id, _convoyeur_id: convoyeurId });
      if (error) toast.error("Attribution partielle", { description: error.message });
      else ok += 1;
    }
    setLotBusy(false);
    if (ok) toast.success(`${ok} mission${ok > 1 ? "s" : ""} attribuée${ok > 1 ? "s" : ""}`);
    setPicked(new Set());
    fetchAll();
  };

  /* ---------------- Filtres / tri ---------------- */
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    UNIFIED_ORDER.forEach((s) => { c[s] = rows.filter((r) => r.status === s).length; });
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      const m = meta.get(r.id);
      if (convFilter !== "all") {
        if (convFilter === "none" ? !!m?.convoyeurId : m?.convoyeurId !== convFilter) return false;
      }
      if (payFilter !== "all" && paymentState(m?.facture ?? null) !== payFilter) return false;
      if (energyFilter !== "all") {
        const elec = isElectric(m?.energie);
        if (energyFilter === "electrique" ? !elec : elec) return false;
      }
      if (!q) return true;
      return [r.ref, r.depart, r.arrivee, r.clientNom, r.immatriculation, r.marque, r.modele, m?.vin, m?.convoyeurNom]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q));
    });

    const sorted = [...list];
    if (sortBy === "prix") sorted.sort((a, b) => (b.prix ?? 0) - (a.prix ?? 0));
    else if (sortBy === "date") sorted.sort((a, b) => new Date(b.date ?? b.createdAt).getTime() - new Date(a.date ?? a.createdAt).getTime());
    else if (sortBy === "client") sorted.sort((a, b) => (a.clientNom ?? "").localeCompare(b.clientNom ?? ""));
    return sorted;
  }, [rows, filter, search, meta, convFilter, payFilter, energyFilter, sortBy]);

  /* ---------------- Regroupement duo L/R ---------------- */
  type ListRow =
    | { type: "groupHeader"; gid: string; refs: string[]; convs: string[]; total: number; statut: string; clientEmail: string | null; clientNom: string | null; pv: string[] }
    | { type: "lotHeader"; lotId: string; lotRef: string; ids: string[]; plaques: string[]; convs: string[]; total: number; clientNom: string | null; clientEmail: string | null }
    | { type: "row"; m: (typeof visible)[number]; band: boolean; inGroup: boolean; last: boolean };

  const listRows = useMemo<ListRow[]>(() => {
    const out: ListRow[] = [];
    const seen = new Set<string>();
    let band = false;
    const isRetour = (x: (typeof visible)[number]) => x.legType === "retour" || x.legIndex === 2;
    const isAller = (x: (typeof visible)[number]) => x.legType === "aller" || x.legIndex === 1;

    const emitted = new Set<string>();

    visible.forEach((m) => {
      if (emitted.has(m.id)) return;

      // Lot multi-plaques : missions séparées, regroupées uniquement pour les actions admin.
      const lot = m.lotId ?? null;
      if (lot) {
        const members = visible.filter((x) => x.lotId === lot);
        if (members.length >= 2 && !seen.has(`lot:${lot}`)) {
          seen.add(`lot:${lot}`);
          band = !band;
          out.push({
            type: "lotHeader",
            lotId: lot,
            lotRef: m.lotRef ?? "Lot",
            ids: members.map((x) => x.id),
            plaques: members.map((x) => x.immatriculation).filter(Boolean) as string[],
            convs: Array.from(new Set(members.map((x) => meta.get(x.id)?.convoyeurNom).filter(Boolean))) as string[],
            total: members.reduce((s2, x) => s2 + (x.prix ?? 0), 0),
            clientNom: members.find((x) => x.clientNom)?.clientNom ?? null,
            clientEmail: members.find((x) => x.clientEmail)?.clientEmail ?? null,
          });
          members.forEach((x, i) => {
            emitted.add(x.id);
            out.push({ type: "row", m: x, band, inGroup: true, last: i === members.length - 1 });
          });
          return;
        }
      }

      const gid = m.groupId ?? null;
      const all = gid ? visible.filter((x) => x.groupId === gid) : [];
      const duo = [all.find(isAller), all.find(isRetour)].filter(Boolean) as typeof all;
      const inDuo = new Set(duo.map((x) => x.id));

      if (gid && duo.length === 2) {
        if (!seen.has(gid)) {
          seen.add(gid);
          band = !band;
          const convs = Array.from(new Set(duo.map((x) => meta.get(x.id)?.convoyeurNom).filter(Boolean))) as string[];
          const total = duo.reduce((s, x) => s + (x.prix ?? 0), 0);
          const statuts = duo.map((x) => UNIFIED_STATUS[x.status].label);
          out.push({
            type: "groupHeader",
            gid,
            refs: duo.map((x) => x.ref),
            convs,
            total,
            statut: Array.from(new Set(statuts)).join(" · "),
            clientEmail: duo.find((x) => x.clientEmail)?.clientEmail ?? null,
            clientNom: duo.find((x) => x.clientNom)?.clientNom ?? null,
            pv: Array.from(new Set(duo.flatMap((x) => pvOf(pvMap, meta.get(x.id)?.attributionId)))),
          });
          duo.forEach((x, i) => {
            emitted.add(x.id);
            out.push({ type: "row", m: x, band, inGroup: true, last: i === duo.length - 1 });
          });
        }
        if (inDuo.has(m.id)) return;
      }

      band = !band;
      emitted.add(m.id);
      out.push({ type: "row", m, band, inGroup: false, last: true });
    });
    return out;
  }, [visible, meta]);

  useEffect(() => {
    if (!selected) return;
    const fresh = rows.find((r) => r.id === selected.id && r.kind === selected.kind);
    if (fresh && fresh !== selected) setSelected(fresh);
    if (!fresh) setSelected(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  return (
    <div className="adm6">
      <AdminSectionHeader
        breadcrumb="Missions"
        eyebrow="Flux opérationnel"
        title="Missions"
        subtitle={`Demandes, trajets et attributions réunis dans un seul flux — ${rows.length} mission${rows.length > 1 ? "s" : ""}`}
        actions={
          <>
            <ColumnsMenu hidden={hidden} onToggle={toggleColumn} />
            <Link
              to="/admin/attributions"
              search={{} as never}
              className="h-9 px-3 rounded-lg border border-[#eaeaee] bg-white flex items-center gap-1.5 text-[13px] font-medium text-[#2f5fff] hover:bg-[#f4f7ff]"
            >
              <ClipboardList size={15} /> Attributions
            </Link>
            <CreateTestMissionButton onCreated={fetchAll} />
            <button onClick={fetchAll} className="w-9 h-9 rounded-lg border border-[#eaeaee] bg-white flex items-center justify-center text-[#70727d] hover:text-[#2f5fff]">
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
          </>
        }
      />

      {/* Filtres statut */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <button className={`a6-chip ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>
          Toutes · {counts.all}
        </button>
        {UNIFIED_ORDER.map((s) => (
          <button key={s} className={`a6-chip ${filter === s ? "active" : ""}`} onClick={() => setFilter(s)}>
            {UNIFIED_STATUS[s].label} · {counts[s] ?? 0}
          </button>
        ))}
        <div className="relative ml-auto w-full sm:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--a6-dim)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher mission, client, plaque, VIN, convoyeur…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--a6-border)] bg-white text-[12.5px] outline-none focus:border-[var(--a6-blue)]"
          />
        </div>
      </div>

      {/* Filtres croisés */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        {[
          {
            value: convFilter, set: setConvFilter, label: "Convoyeur",
            options: [{ v: "all", l: "Tous les convoyeurs" }, { v: "none", l: "Non attribuées" }, ...convoyeurs.map((c) => ({ v: c.id, l: c.nom }))],
          },
          {
            value: payFilter, set: setPayFilter, label: "Facture",
            options: [
              { v: "all", l: "Tout paiement" }, { v: "payee", l: "Payée" },
              { v: "attente", l: "En attente" }, { v: "retard", l: "En retard" }, { v: "aucune", l: "Sans facture" },
            ],
          },
          {
            value: energyFilter, set: setEnergyFilter, label: "Énergie",
            options: [{ v: "all", l: "Toutes énergies" }, { v: "electrique", l: "Électrique" }, { v: "thermique", l: "Thermique" }],
          },
          {
            value: sortBy, set: setSortBy, label: "Tri",
            options: [
              { v: "recent", l: "Plus récentes" }, { v: "date", l: "Date de mission" },
              { v: "prix", l: "Prix décroissant" }, { v: "client", l: "Client (A→Z)" },
            ],
          },
        ].map((f) => (
          <select
            key={f.label}
            value={f.value}
            onChange={(e) => f.set(e.target.value)}
            className="h-9 rounded-lg border border-[var(--a6-border)] bg-white px-2.5 text-[12.5px] text-[var(--a6-text)] outline-none focus:border-[var(--a6-blue)]"
          >
            {f.options.map((o) => (
              <option key={o.v} value={o.v}>{o.l}</option>
            ))}
          </select>
        ))}
      </div>

      {picked.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[#4f46e5]/30 bg-[#eef0ff] px-3 py-2">
          <span className="text-[12px] font-semibold text-[#3730a3]">
            {picked.size} mission{picked.size > 1 ? "s" : ""} sélectionnée{picked.size > 1 ? "s" : ""}
          </span>
          <button
            type="button"
            disabled={lotBusy || picked.size < 2}
            onClick={groupLot}
            className="h-8 rounded-lg bg-[#4f46e5] px-3 text-[12px] font-semibold text-white disabled:opacity-50"
          >
            Regrouper les missions
          </button>
          <button
            type="button"
            disabled={lotBusy}
            onClick={() => ungroupLot(Array.from(picked))}
            className="h-8 rounded-lg border border-[#4f46e5]/40 bg-white px-3 text-[12px] font-semibold text-[#3730a3] disabled:opacity-50"
          >
            Dégrouper
          </button>
          <select
            value=""
            disabled={lotBusy}
            onChange={(e) => e.target.value && assignMany(Array.from(picked), e.target.value)}
            className="h-8 rounded-lg border border-[#4f46e5]/40 bg-white px-2 text-[12px] font-semibold text-[#3730a3]"
          >
            <option value="">Attribuer la sélection à…</option>
            {convoyeurs.map((c) => (
              <option key={c.id} value={c.id}>{c.nom}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setPicked(new Set())}
            className="ml-auto text-[11.5px] font-medium text-[#3730a3] underline"
          >
            Tout désélectionner
          </button>
        </div>
      )}

      <LegSuffixLegend className="mb-3" />

      {/* Tableau unique */}
      <div className="a6-card overflow-hidden">
        {visible.length === 0 ? (
          <RadarEmptyV6
            title="Aucune mission"
            subtitle="Les demandes reçues et les trajets créés apparaîtront ici automatiquement."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="a6-table">
              <thead>
                <tr>
                  <th className="w-8"></th>
                  <th>Référence</th>
                  {show("trajet") && <th>Trajet</th>}
                  {show("plaque") && <th>Plaque / VIN</th>}
                  {show("vehicule") && <th>Véhicule</th>}
                  {show("client") && <th>Client</th>}
                  {show("convoyeur") && <th>Convoyeur</th>}
                  {show("date") && <th>Date</th>}
                  {show("prix") && <th>Prix</th>}
                  {show("paiement") && <th>Facture</th>}
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {listRows.map((r) =>
                  r.type === "lotHeader" ? (
                    <tr key={`lot-${r.lotId}`} className="bg-[#eafaf2]">
                      <td
                        colSpan={colCount}
                        className="!py-2.5 border-t-[3px] border-t-[#0f9d63] shadow-[inset_4px_0_0_0_#0f9d63]"
                        style={{ paddingLeft: 14 }}
                      >
                        <span className="inline-flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0f9d63] px-2.5 py-0.5 text-[10.5px] font-semibold text-white">
                            <Layers size={11} /> Lot {r.lotRef} · {r.ids.length} véhicules
                          </span>
                          {r.plaques.map((pl) => (
                            <span key={pl} className="plate-tag plate-tag--sm">{pl}</span>
                          ))}
                          <span className="rounded-full bg-white/80 px-2 py-0.5">
                            <ClientBrand
                              brand={clientBrandOf(clientBrands, r.clientEmail)}
                              fallbackName={r.clientNom}
                              size={20}
                            />
                          </span>
                          <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10.5px] font-semibold text-[#065f41]">
                            Convoyeur{r.convs.length > 1 ? "s" : ""} : {r.convs.length ? r.convs.join(", ") : "non attribué"}
                          </span>
                          <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10.5px] font-semibold text-[#065f41]">
                            Total : {r.total.toFixed(2)} €
                          </span>
                          <select
                            value=""
                            disabled={lotBusy}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => e.target.value && assignMany(r.ids, e.target.value)}
                            className="h-7 rounded-lg border border-[#0f9d63]/40 bg-white px-2 text-[11px] font-semibold text-[#065f41]"
                          >
                            <option value="">Attribuer tout le lot à…</option>
                            {convoyeurs.map((c) => (
                              <option key={c.id} value={c.id}>{c.nom}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setPrixLot({ ids: r.ids, ref: r.lotRef }); }}
                            className="h-7 rounded-lg border border-[#0f9d63]/40 bg-white px-2 text-[11px] font-semibold text-[#065f41]"
                          >
                            Prix par véhicule
                          </button>
                          <button
                            type="button"
                            disabled={lotBusy}
                            onClick={(e) => { e.stopPropagation(); ungroupLot(r.ids); }}
                            className="h-7 rounded-lg border border-[#0f9d63]/40 bg-white px-2 text-[11px] font-semibold text-[#065f41]"
                          >
                            Dégrouper
                          </button>
                        </span>
                      </td>
                    </tr>
                  ) : r.type === "groupHeader" ? (
                    <tr key={`g-${r.gid}`} className="bg-[#e5e9ff]">
                      <td
                        colSpan={colCount}
                        className="!py-2.5 border-t-[3px] border-t-[#4f46e5] shadow-[inset_4px_0_0_0_#4f46e5]"
                        style={{ paddingLeft: 14 }}
                      >
                        <span className="inline-flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#4f46e5] px-2.5 py-0.5 text-[10.5px] font-semibold text-white">
                            <ArrowLeftRight size={11} /> Duo Livraison–Restitution
                          </span>
                          <span className="text-[11px] font-medium text-[#3730a3]">
                            Livraison {r.refs[0] ?? "—"} + Restitution {r.refs[1] ?? "—"} — un seul dossier
                          </span>
                          <span className="rounded-full bg-white/80 px-2 py-0.5">
                            <ClientBrand
                              brand={clientBrandOf(clientBrands, r.clientEmail)}
                              fallbackName={r.clientNom}
                              size={20}
                              pv={r.pv}
                            />
                          </span>
                          <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10.5px] font-semibold text-[#3730a3]">
                            Convoyeur{r.convs.length > 1 ? "s" : ""} : {r.convs.length ? r.convs.join(", ") : "non attribué"}
                          </span>
                          <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10.5px] font-semibold text-[#3730a3]">
                            Total cumulé : {r.total.toFixed(2)} €
                          </span>
                          <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10.5px] font-semibold text-[#3730a3]">
                            Statut : {r.statut}
                          </span>
                        </span>
                      </td>
                    </tr>
                  ) : (
                    <tr
                      key={`${r.m.kind}-${r.m.id}`}
                      className={`row ${r.inGroup ? "bg-[#f6f7ff]" : r.band ? "bg-[var(--a6-blue)]/[0.05]" : "bg-white"} ${r.inGroup ? "shadow-[inset_4px_0_0_0_#4f46e5]" : ""} ${r.inGroup && r.last ? "border-b-[3px] border-b-[#4f46e5]" : ""}`}
                      onClick={() => setSelected(r.m)}
                    >
                      <td className="w-8" onClick={(e) => e.stopPropagation()}>
                        {r.m.kind === "trajet" && (
                          <input
                            type="checkbox"
                            aria-label={`Sélectionner ${r.m.ref}`}
                            checked={picked.has(r.m.id)}
                            onChange={() => togglePick(r.m.id)}
                            className="h-3.5 w-3.5 accent-[#4f46e5]"
                          />
                        )}
                      </td>
                      <td className={r.inGroup ? "pl-5" : ""}>
                        <p className="a6-mono text-[11px] text-[var(--a6-blue-deep)] font-semibold inline-flex items-center gap-1.5">
                          {alertsByTrajet.get(r.m.id) && (
                            <span
                              title={`Alerte ${SEVERITY_META[alertsByTrajet.get(r.m.id)!].label}`}
                              className={`h-2 w-2 rounded-full ${SEVERITY_META[alertsByTrajet.get(r.m.id)!].dot} ${alertsByTrajet.get(r.m.id) === "critique" ? "animate-pulse" : ""}`}
                            />
                          )}
                          {r.m.ref}
                        </p>
                        <div className="flex gap-1.5 mt-1 flex-wrap">
                          {r.m.rechargeSeule && <RechargeBadge compact />}
                          {r.m.isRoundTrip ? (
                            <span className="a6-badge attribuee" title="L = Livraison · R = Restitution">
                              {r.m.legType === "retour" || r.m.legIndex === 2 ? "Restitution (R)" : "Livraison (L)"}
                            </span>
                          ) : (
                            !r.m.rechargeSeule && <span className="a6-badge">Livraison simple</span>
                          )}
                          {r.m.isTest && <span className="a6-badge annulee">Test</span>}
                        </div>
                        {!r.inGroup && hasLegSuffix(r.m.ref) && (
                          <p className="mt-1 text-[10.5px] text-[#4f46e5]">Ancien duo Livraison–Restitution</p>
                        )}
                      </td>

                      {show("trajet") && (
                        <td>
                          <p className="font-semibold text-[var(--a6-text)] inline-flex items-center gap-1.5">
                            {r.m.depart} <ArrowRight size={12} className="text-[var(--a6-dim)]" /> {r.m.arrivee}
                          </p>
                        </td>
                      )}

                      {show("plaque") && (
                        <td>
                          {r.m.immatriculation ? (
                            <span className="plate-tag plate-tag--sm">
                              {r.m.immatriculation}
                            </span>
                          ) : (
                            <span className="text-[11px] text-[var(--a6-dim)]">—</span>
                          )}
                          {meta.get(r.m.id)?.vin && (
                            <p className="mt-0.5 a6-mono text-[10px] text-[var(--a6-dim)]">VIN {meta.get(r.m.id)?.vin}</p>
                          )}
                        </td>
                      )}

                      {show("vehicule") && (
                        <td className="text-[11.5px] text-[var(--a6-muted)]">
                          <span className="inline-flex items-center gap-1">
                            {isElectric(meta.get(r.m.id)?.energie) ? (
                              <Zap size={11} className="text-emerald-600" />
                            ) : (
                              <Fuel size={11} className="text-[var(--a6-dim)]" />
                            )}
                            {[r.m.marque, r.m.modele].filter(Boolean).join(" ") || "—"}
                          </span>
                        </td>
                      )}

                      {show("client") && (
                        <td className="text-[var(--a6-muted)]">
                          <ClientBrand
                            brand={clientBrandOf(clientBrands, r.m.clientEmail)}
                            fallbackName={r.m.clientNom}
                            size={22}
                            pv={pvOf(pvMap, meta.get(r.m.id)?.attributionId)}
                          />
                        </td>
                      )}

                      {show("convoyeur") && (
                        <td>
                          {r.m.kind === "trajet" ? (
                            <ConvoyeurCell
                              meta={meta.get(r.m.id)}
                              convoyeurs={convoyeurs}
                              onAssign={(cid) => assignConvoyeur(r.m.id, cid)}
                            />
                          ) : (
                            <span className="text-[11px] text-[var(--a6-dim)]">Demande</span>
                          )}
                        </td>
                      )}

                      {show("date") && (
                        <td className="min-w-[170px] text-[var(--a6-dim)] text-[11.5px]">
                          {r.m.kind === "trajet" ? (
                            <MissionDateCell
                              refLabel={r.m.ref}
                              date={r.m.date ?? null}
                              heure={r.m.heure ?? null}
                              onChange={(field, value) => void updatePlanning(r.m.id, field, value)}
                            />
                          ) : (
                            <>
                              {r.m.date ? new Date(r.m.date).toLocaleDateString("fr-FR") : "À planifier"}
                              {r.m.heure ? ` · ${r.m.heure}` : ""}
                            </>
                          )}
                        </td>
                      )}


                      {show("prix") && (
                        <td className="a6-num font-semibold whitespace-nowrap">
                          {r.m.prix != null ? `${Number(r.m.prix).toFixed(2)} €` : "—"}
                          {r.m.kind === "trajet" && (
                            <button
                              type="button"
                              title={`Modifier le prix de ${r.m.immatriculation ?? r.m.ref}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setPrixLot({ ids: [r.m.id], ref: r.m.immatriculation ?? r.m.ref });
                              }}
                              className="ml-1.5 rounded-md border border-[var(--a6-border)] bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[var(--a6-blue)] hover:border-[var(--a6-blue)]"
                            >
                              Modifier
                            </button>
                          )}
                        </td>
                      )}

                      {show("paiement") && (
                        <td>
                          <div className="flex items-center gap-1.5">
                            <PaymentBadge facture={meta.get(r.m.id)?.facture ?? null} />
                            <FactureQuickLink facture={meta.get(r.m.id)?.facture ?? null} />
                          </div>
                        </td>
                      )}

                      <td>
                        <span className={`a6-badge ${UNIFIED_STATUS[r.m.status].cls}`}>{UNIFIED_STATUS[r.m.status].label}</span>
                        {r.m.kind === "trajet" && (
                          <select
                            value=""
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => e.target.value && quickStatus(r.m.id, e.target.value)}
                            className="mt-1 block w-[104px] rounded-md border border-[#eaeaee] bg-white px-1 py-0.5 text-[10.5px] text-[var(--a6-muted)] outline-none focus:border-[var(--a6-blue)]"
                          >
                            <option value="">Changer…</option>
                            {QUICK_STATUS.map((s) => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </select>
                        )}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <MissionUnifiedPanel mission={selected} onClose={() => setSelected(null)} onChanged={fetchAll} />
      )}

      <VehiculesPrixDialog
        open={!!prixLot}
        onClose={() => setPrixLot(null)}
        trajetIds={prixLot?.ids}
        title={
          prixLot && prixLot.ids.length === 1
            ? `Prix du véhicule — ${prixLot.ref}`
            : `Prix par véhicule — lot ${prixLot?.ref ?? ""}`
        }
        onSaved={fetchAll}
      />

      <p className="mt-4 text-[11px] text-[var(--a6-dim)] inline-flex items-center gap-1.5">
        <RouteIcon size={12} /> Les statuts fusionnent demandes, trajets et attributions : Nouvelle → À attribuer → Attribuée → En cours → Terminée / Annulée.
      </p>
    </div>
  );
}
