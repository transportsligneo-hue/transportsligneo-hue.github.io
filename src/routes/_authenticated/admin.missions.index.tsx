import { createFileRoute, Link } from "@tanstack/react-router";
import AdminSectionHeader from "@/components/admin/AdminSectionHeader";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Search, Route as RouteIcon, ArrowRight, ArrowLeftRight, ClipboardList } from "lucide-react";
import { MissionUnifiedPanel } from "@/components/admin/missions/MissionUnifiedPanel";
import {
  UNIFIED_ORDER,
  UNIFIED_STATUS,
  trajetToUnified,
  type UnifiedMission,
  type UnifiedStatus,
} from "@/components/admin/missions/mission-unified-types";
import { displayTrajetRef, displayNumero, stripLegSuffix, hasLegSuffix, shortMissionSeq } from "@/lib/mission-number";
import { LegSuffixLegend } from "@/components/admin/LegSuffixLegend";
import { CreateTestMissionButton } from "@/components/admin/TestMissionActions";
import { RadarEmptyV6 } from "@/components/admin/dashboard/RadarEmptyV6";

export const Route = createFileRoute("/_authenticated/admin/missions/")({
  component: AdminMissionsUnified,
});

interface TrajetRow {
  id: string; depart: string; arrivee: string; date_trajet: string | null; heure_trajet: string | null;
  marque: string | null; modele: string | null; immatriculation: string | null;
  client_nom: string | null; client_email: string | null; client_telephone: string | null;
  prix: number | null; prix_convoyeur: number | null; tarif_convoyeur: number | null;
  prix_suggere: number | null; statut: string; statut_publication: string | null;
  demande_id: string | null; created_at: string; is_test_data: boolean | null;
  mission_group_id: string | null; leg_type: string | null; leg_index: number | null;
  pricing_mode: "fixe" | "enchere" | null; prix_client_ttc: number | null;
  prix_convoyeur_fixe: number | null; prix_convoyeur_min: number | null; prix_convoyeur_max: number | null;
  marge_indicative_pct: number | null; type_mission: string | null; numero_mission: string | null;
}

interface DemandeRow {
  id: string; nom: string; prenom: string; email: string | null; telephone: string | null;
  depart: string; arrivee: string; date_souhaitee: string | null; heure_souhaitee: string | null;
  marque: string | null; modele: string | null; immatriculation: string | null;
  prix_estime: number | null; statut: string; created_at: string; type_trajet: string | null;
}

const PRIORITY: Record<string, number> = { en_cours: 60, attribue: 50, accepte: 40, en_attente: 30, termine: 20, annule: 10 };

function AdminMissionsUnified() {
  const [rows, setRows] = useState<UnifiedMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<UnifiedStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<UnifiedMission | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: trajetsData }, { data: demandesData }, { data: attributionsData }] = await Promise.all([
      supabase.from("trajets").select("*").order("created_at", { ascending: false }),
      supabase
        .from("demandes_convoyage")
        .select("id, nom, prenom, email, telephone, depart, arrivee, date_souhaitee, heure_souhaitee, marque, modele, immatriculation, prix_estime, statut, created_at, type_trajet")
        .in("statut", ["nouvelle", "a_traiter"])
        .order("created_at", { ascending: false }),
      supabase.from("attributions").select("trajet_id, numero_mission, created_at"),
    ]);

    const trajets = ((trajetsData ?? []) as unknown as TrajetRow[]).filter(
      (t) => !(t.depart ?? "").trim().toLowerCase().includes("partenariat"),
    );

    // Déduplication identique au pipeline existant (aller / retour conservés séparément)
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

    // Vrais numéros de mission (attributions) : un aller-retour partage le numéro de base
    const attrRows = (attributionsData ?? []) as unknown as { trajet_id: string | null; numero_mission: string | null; created_at: string }[];
    const numeroByTrajet = new Map<string, string>();
    attrRows.forEach((a) => {
      if (!a.trajet_id || !a.numero_mission) return;
      const cur = numeroByTrajet.get(a.trajet_id);
      if (!cur) numeroByTrajet.set(a.trajet_id, a.numero_mission);
    });
    // Numéro de base par groupe A/R : on prend celui de l'aller, sinon le plus petit
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
      // Le numéro saisi/attribué dans l'admin est immuable à l'affichage.
      // On normalise juste le format (dièse devant la séquence) sans reconstruire.
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
      date: t.date_trajet,
      heure: t.heure_trajet,
      marque: t.marque,
      modele: t.modele,
      immatriculation: t.immatriculation,
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
        isRoundTrip: d.type_trajet === "aller_retour",
        legType: null,
        isTest: false,
        createdAt: d.created_at,
      }));

    setRows(
      [...demandeMissions, ...trajetMissions].sort((a, b) => {
        const ta = new Date(a.createdAt).getTime();
        const tb = new Date(b.createdAt).getTime();
        if (tb !== ta) return tb - ta;
        // Même groupe (aller-retour) : aller d'abord, puis retour
        if (a.groupId && a.groupId === b.groupId) {
          return (a.legIndex ?? 1) - (b.legIndex ?? 1);
        }
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
      .on("postgres_changes", { event: "*", schema: "public", table: "demandes_convoyage" }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    UNIFIED_ORDER.forEach((s) => { c[s] = rows.filter((r) => r.status === s).length; });
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!q) return true;
      return [r.ref, r.depart, r.arrivee, r.clientNom, r.immatriculation, r.marque, r.modele]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q));
    });
  }, [rows, filter, search]);

  // Regroupement visuel des missions groupées (Livraison L + Restitution R)
  type ListRow =
    | { type: "groupHeader"; gid: string; refs: string[] }
    | { type: "row"; m: (typeof visible)[number]; band: boolean; inGroup: boolean; last: boolean };

  const listRows = useMemo<ListRow[]>(() => {
    const out: ListRow[] = [];
    const seen = new Set<string>();
    let band = false;
    const isRetour = (x: (typeof visible)[number]) => x.legType === "retour" || x.legIndex === 2;
    const isAller = (x: (typeof visible)[number]) => x.legType === "aller" || x.legIndex === 1;

    visible.forEach((m) => {
      const gid = m.groupId ?? null;
      const all = gid ? visible.filter((x) => x.groupId === gid) : [];
      // Un duo = exactement 1 volet Livraison + 1 volet Restitution.
      // Les éventuels trajets "simple" résiduels du même groupe restent affichés à part.
      const duo = [all.find(isAller), all.find(isRetour)].filter(Boolean) as typeof all;
      const inDuo = new Set(duo.map((x) => x.id));

      if (gid && duo.length === 2) {
        if (!seen.has(gid)) {
          seen.add(gid);
          band = !band;
          out.push({ type: "groupHeader", gid, refs: duo.map((x) => x.ref) });
          duo.forEach((x, i) => out.push({ type: "row", m: x, band, inGroup: true, last: i === duo.length - 1 }));
        }
        if (inDuo.has(m.id)) return;
      }

      band = !band;
      out.push({ type: "row", m, band, inGroup: false, last: true });
    });
    return out;
  }, [visible]);



  // Garde le panneau synchronisé avec les données rafraîchies
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


      {/* Filtres */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
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
            placeholder="Rechercher une mission, un client, une plaque…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--a6-border)] bg-white text-[12.5px] outline-none focus:border-[var(--a6-blue)]"
          />
        </div>
      </div>

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
                  <th>Référence</th>
                  <th>Trajet</th>
                  <th className="hidden md:table-cell">Client</th>
                  <th className="hidden lg:table-cell">Date</th>
                  <th className="hidden lg:table-cell">Prix</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {listRows.map((r) =>
                  r.type === "groupHeader" ? (
                    <tr key={`g-${r.gid}`} className="bg-[#e5e9ff]">
                      <td
                        colSpan={6}
                        className="!py-2.5 border-t-[3px] border-t-[#4f46e5] shadow-[inset_4px_0_0_0_#4f46e5]"
                        style={{ paddingLeft: 14 }}
                      >
                        <span className="inline-flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#4f46e5] px-2.5 py-0.5 text-[10.5px] font-semibold text-white">
                             <ArrowLeftRight size={11} /> Duo Livraison–Restitution
                          </span>
                          <span className="text-[11px] font-medium text-[#3730a3]">
                            Livraison {r.refs[0] ?? "—"} + Restitution {r.refs[1] ?? "—"} — les 2 lignes ci-dessous forment un seul dossier
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
                        {r.m.isRoundTrip ? (
                          <span className="a6-badge attribuee" title="L = Livraison · R = Restitution">
                            {r.m.legType === "retour" || r.m.legIndex === 2 ? "Restitution (R)" : "Livraison (L)"}
                          </span>
                        ) : (
                          <span className="a6-badge">Livraison simple</span>
                        )}
                        {r.m.isTest && <span className="a6-badge annulee">Test</span>}
                      </div>
                      {!r.inGroup && hasLegSuffix(r.m.ref) && (
                        <p className="mt-1 text-[10.5px] text-[#4f46e5]">
                           Ancien duo Livraison–Restitution
                        </p>
                      )}
                    </td>
                    <td>
                      <p className="font-semibold text-[var(--a6-text)] inline-flex items-center gap-1.5">
                        {r.m.depart} <ArrowRight size={12} className="text-[var(--a6-dim)]" /> {r.m.arrivee}
                      </p>
                      {(r.m.marque || r.m.modele) && (
                        <p className="text-[11px] text-[var(--a6-dim)]">{[r.m.marque, r.m.modele].filter(Boolean).join(" ")}</p>
                      )}
                    </td>
                    <td className="hidden md:table-cell text-[var(--a6-muted)]">{r.m.clientNom || "—"}</td>
                    <td className="hidden lg:table-cell text-[var(--a6-dim)] text-[11.5px]">
                      {r.m.date ? new Date(r.m.date).toLocaleDateString("fr-FR") : "—"}
                      {r.m.heure ? ` · ${r.m.heure}` : ""}
                    </td>
                    <td className="hidden lg:table-cell a6-num font-semibold">{r.m.prix != null ? `${r.m.prix} €` : "—"}</td>
                    <td>
                      <span className={`a6-badge ${UNIFIED_STATUS[r.m.status].cls}`}>{UNIFIED_STATUS[r.m.status].label}</span>
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

      <p className="mt-4 text-[11px] text-[var(--a6-dim)] inline-flex items-center gap-1.5">
        <RouteIcon size={12} /> Les statuts fusionnent demandes, trajets et attributions : Nouvelle → À attribuer → Attribuée → En cours → Terminée / Annulée.
      </p>
    </div>
  );
}
