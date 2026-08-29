/**
 * Registre centralisé des incidents — vue admin.
 * Archive de tous les signalements convoyeur avec filtres multi-critères,
 * fiche détaillée, statistiques agrégées et export CSV.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle, Download, Filter, Loader2, RefreshCw, Search, ChevronRight, BarChart3, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { IncidentDetailPanel } from "@/components/admin/incidents/IncidentDetailPanel";
import type { AdminOption, IncidentRow } from "@/lib/incidents-types";
import {
  INCIDENT_TYPES, downloadCsv, formatDuration, graviteMeta, incidentTypeKey, incidentTypeLabel,
  resolutionMinutes, statutMeta,
} from "@/lib/incidents";

export const Route = createFileRoute("/_authenticated/admin/incidents")({
  head: () => ({
    meta: [
      { title: "Registre des incidents — Transports Ligneo" },
      { name: "description", content: "Archive centralisée de tous les incidents signalés sur les missions de convoyage." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: IncidentsRegistryPage,
});

type PeriodKey = "7j" | "30j" | "90j" | "tout";

const PERIODS: { key: PeriodKey; label: string; days: number | null }[] = [
  { key: "7j", label: "7 jours", days: 7 },
  { key: "30j", label: "30 jours", days: 30 },
  { key: "90j", label: "90 jours", days: 90 },
  { key: "tout", label: "Tout", days: null },
];

interface RawIncident {
  id: string;
  attribution_id: string;
  type_incident: string | null;
  titre: string;
  description: string;
  gravite: string;
  statut: string;
  photos: unknown;
  latitude: number | null;
  longitude: number | null;
  reponse_admin: string | null;
  assigned_to: string | null;
  prise_en_charge_at: string | null;
  resolu_at: string | null;
  created_at: string;
  attributions: {
    numero_mission: string | null;
    statut: string | null;
    etape_courante: string | null;
    convoyeurs: { id: string; nom: string | null; prenom: string | null; telephone: string | null } | null;
    trajets: { depart: string | null; arrivee: string | null; client_nom: string | null; client_telephone: string | null } | null;
  } | null;
}

function flatten(r: RawIncident): IncidentRow {
  const a = r.attributions;
  const c = a?.convoyeurs ?? null;
  const t = a?.trajets ?? null;
  return {
    id: r.id,
    attribution_id: r.attribution_id,
    type_incident: r.type_incident,
    titre: r.titre,
    description: r.description,
    gravite: r.gravite,
    statut: r.statut,
    photos: r.photos,
    latitude: r.latitude,
    longitude: r.longitude,
    reponse_admin: r.reponse_admin,
    assigned_to: r.assigned_to,
    prise_en_charge_at: r.prise_en_charge_at,
    resolu_at: r.resolu_at,
    created_at: r.created_at,
    numero_mission: a?.numero_mission ?? null,
    mission_statut: a?.statut ?? null,
    mission_etape: a?.etape_courante ?? null,
    depart: t?.depart ?? null,
    arrivee: t?.arrivee ?? null,
    client_nom: t?.client_nom ?? null,
    client_tel: t?.client_telephone ?? null,
    convoyeur_id: c?.id ?? null,
    convoyeur_nom: c ? `${c.prenom ?? ""} ${c.nom ?? ""}`.trim() : null,
    convoyeur_tel: c?.telephone ?? null,
  };
}

function graviteBadgeTone(g: string | null | undefined): string {
  switch (g) {
    case "critique": return "red";
    case "grave": return "orange";
    case "moyen": return "orange";
    default: return "blue";
  }
}

function statutBadgeTone(s: string | null | undefined): string {
  switch (s) {
    case "ouvert": return "red";
    case "en_cours": return "orange";
    case "resolu": return "green";
    default: return "grey";
  }
}

function IncidentsRegistryPage() {
  const [rows, setRows] = useState<IncidentRow[]>([]);
  const [admins, setAdmins] = useState<AdminOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(true);

  // Filtres
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState<PeriodKey>("30j");
  const [fType, setFType] = useState("");
  const [fGravite, setFGravite] = useState("");
  const [fStatut, setFStatut] = useState("");
  const [fConvoyeur, setFConvoyeur] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("mission_incidents")
      .select(
        "id, attribution_id, type_incident, titre, description, gravite, statut, photos, latitude, longitude, reponse_admin, assigned_to, prise_en_charge_at, resolu_at, created_at, attributions(numero_mission, statut, etape_courante, convoyeurs(id, nom, prenom, telephone), trajets(depart, arrivee, client_nom, client_telephone))",
      )
      .order("created_at", { ascending: false })
      .limit(1000);
    setRows(((data ?? []) as unknown as RawIncident[]).map(flatten));
    setLoading(false);
  }, []);

  const fetchAdmins = useCallback(async () => {
    const { data: roles } = await supabase.from("user_roles").select("user_id, role").in("role", ["admin", "super_admin"]);
    const ids = (roles ?? []).map((r) => r.user_id);
    if (ids.length === 0) { setAdmins([]); return; }
    const { data: profs } = await supabase.from("profiles").select("user_id, nom, prenom, email").in("user_id", ids);
    setAdmins(
      (profs ?? []).map((p) => ({
        user_id: p.user_id as string,
        label: `${p.prenom ?? ""} ${p.nom ?? ""}`.trim() || (p.email as string) || "Admin",
      })),
    );
  }, []);

  useEffect(() => { fetchAll(); fetchAdmins(); }, [fetchAll, fetchAdmins]);

  useEffect(() => {
    const ch = supabase
      .channel("admin-incidents-registry")
      .on("postgres_changes", { event: "*", schema: "public", table: "mission_incidents" }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchAll]);

  const convoyeurs = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => { if (r.convoyeur_id && r.convoyeur_nom) map.set(r.convoyeur_id, r.convoyeur_nom); });
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtered = useMemo(() => {
    const days = PERIODS.find((p) => p.key === period)?.days ?? null;
    const since = days ? Date.now() - days * 86400000 : null;
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (since && new Date(r.created_at).getTime() < since) return false;
      if (fType && incidentTypeKey(r.type_incident) !== fType) return false;
      if (fGravite && r.gravite !== fGravite) return false;
      if (fStatut && r.statut !== fStatut) return false;
      if (fConvoyeur && r.convoyeur_id !== fConvoyeur) return false;
      if (needle) {
        const hay = [r.titre, r.description, r.numero_mission, r.client_nom, r.convoyeur_nom, r.depart, r.arrivee]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, period, fType, fGravite, fStatut, fConvoyeur, q]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const byType = new Map<string, number>();
    const byConvoyeur = new Map<string, number>();
    let resolvedSum = 0, resolvedCount = 0, open = 0, critiques = 0;
    filtered.forEach((r) => {
      const tk = incidentTypeLabel(r.type_incident);
      byType.set(tk, (byType.get(tk) ?? 0) + 1);
      if (r.convoyeur_nom) byConvoyeur.set(r.convoyeur_nom, (byConvoyeur.get(r.convoyeur_nom) ?? 0) + 1);
      const m = resolutionMinutes(r.created_at, r.resolu_at);
      if (m != null) { resolvedSum += m; resolvedCount++; }
      if (r.statut === "ouvert" || r.statut === "en_cours") open++;
      if (r.gravite === "critique") critiques++;
    });
    return {
      total, open, critiques,
      avgResolution: resolvedCount ? Math.round(resolvedSum / resolvedCount) : null,
      topTypes: [...byType.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
      topConvoyeurs: [...byConvoyeur.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
  }, [filtered]);

  const exportCsv = () => {
    downloadCsv(
      `incidents-ligneo-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((r) => ({
        Date: new Date(r.created_at).toLocaleString("fr-FR"),
        Mission: r.numero_mission ?? "",
        Type: incidentTypeLabel(r.type_incident),
        Gravite: graviteMeta(r.gravite).label,
        Statut: statutMeta(r.statut).label,
        Titre: r.titre,
        Description: r.description,
        Convoyeur: r.convoyeur_nom ?? "",
        Client: r.client_nom ?? "",
        Trajet: [r.depart, r.arrivee].filter(Boolean).join(" → "),
        GPS: r.latitude != null ? `${r.latitude},${r.longitude}` : "",
        "Résolu le": r.resolu_at ? new Date(r.resolu_at).toLocaleString("fr-FR") : "",
        "Délai de résolution": formatDuration(resolutionMinutes(r.created_at, r.resolu_at)),
      })),
    );
  };

  const resetFilters = () => { setQ(""); setFType(""); setFGravite(""); setFStatut(""); setFConvoyeur(""); setPeriod("30j"); };
  const activeFilters = [fType, fGravite, fStatut, fConvoyeur, q].filter(Boolean).length;
  const current = rows.find((r) => r.id === selected) ?? null;

  return (
    <div>
      {/* ===== En-tête ===== */}
      <div className="dvx-head">
        <div className="min-w-0">
          <h1 className="dvx-title">Registre des incidents</h1>
          <p className="dvx-sub">
            {filtered.length} incident{filtered.length > 1 ? "s" : ""} affiché{filtered.length > 1 ? "s" : ""} · archive complète des signalements convoyeur
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowStats((v) => !v)} className="dvx-btn outline">
            <BarChart3 size={14} /> Statistiques
          </button>
          <button onClick={exportCsv} disabled={filtered.length === 0} className="dvx-btn outline">
            <Download size={14} /> Export CSV
          </button>
          <button onClick={fetchAll} className="dvx-cta">
            <RefreshCw size={16} /> Actualiser
          </button>
        </div>
      </div>

      {showStats && (
        <>
          <div className="dvx-stats">
            <div className="dvx-stat">
              <span className="dvx-stat-ic blue"><AlertTriangle size={17} /></span>
              <p className="dvx-stat-k">Incidents</p>
              <p className="dvx-stat-v">{stats.total}</p>
              <p className="dvx-stat-t dim">Sur la période sélectionnée</p>
            </div>
            <div className="dvx-stat">
              <span className="dvx-stat-ic orange"><Filter size={17} /></span>
              <p className="dvx-stat-k">En traitement</p>
              <p className="dvx-stat-v">{stats.open}</p>
              <p className={`dvx-stat-t ${stats.open > 0 ? "warn" : "dim"}`}>Ouverts ou en cours</p>
            </div>
            <div className="dvx-stat">
              <span className="dvx-stat-ic violet"><AlertTriangle size={17} /></span>
              <p className="dvx-stat-k">Critiques</p>
              <p className="dvx-stat-v">{stats.critiques}</p>
              <p className={`dvx-stat-t ${stats.critiques > 0 ? "warn" : "dim"}`}>Niveau de gravité maximal</p>
            </div>
            <div className="dvx-stat">
              <span className="dvx-stat-ic green"><BarChart3 size={17} /></span>
              <p className="dvx-stat-k">Délai moyen de résolution</p>
              <p className="dvx-stat-v">{formatDuration(stats.avgResolution)}</p>
              <p className="dvx-stat-t dim">Incidents résolus</p>
            </div>
          </div>

          <div className="mb-5 grid gap-3 md:grid-cols-2">
            <div className="dvx-group">
              <p className="dvx-group-t">Types les plus fréquents</p>
              {stats.topTypes.length === 0 ? <p className="text-[12px] text-[#9598a4]">Aucune donnée</p> : (
                <ul className="space-y-1.5">
                  {stats.topTypes.map(([label, n]) => (
                    <li key={label} className="flex items-center gap-2 text-[12.5px]">
                      <span className="w-40 shrink-0 truncate text-[#4a4d59]">{label}</span>
                      <span className="h-1.5 flex-1 rounded-full bg-[#eef1f8]">
                        <span className="block h-1.5 rounded-full bg-[#2f5fff]" style={{ width: `${(n / stats.topTypes[0][1]) * 100}%` }} />
                      </span>
                      <strong className="w-6 text-right text-[#14161c]">{n}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="dvx-group">
              <p className="dvx-group-t">Convoyeurs les plus concernés</p>
              {stats.topConvoyeurs.length === 0 ? <p className="text-[12px] text-[#9598a4]">Aucune donnée</p> : (
                <ul className="space-y-1.5">
                  {stats.topConvoyeurs.map(([label, n]) => (
                    <li key={label} className="flex items-center gap-2 text-[12.5px]">
                      <span className="w-40 shrink-0 truncate text-[#4a4d59]">{label}</span>
                      <span className="h-1.5 flex-1 rounded-full bg-[#eef1f8]">
                        <span className="block h-1.5 rounded-full bg-[#b8862a]" style={{ width: `${(n / stats.topConvoyeurs[0][1]) * 100}%` }} />
                      </span>
                      <strong className="w-6 text-right text-[#14161c]">{n}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}

      {/* Filtres */}
      <div className="dvx-filters">
        <div className="dvx-search">
          <Search size={15} />
          <input
            className="dvx-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher (mission, convoyeur, client, mot-clé)…"
          />
        </div>
        <select value={fType} onChange={(e) => setFType(e.target.value)} className="dvx-select">
          <option value="">Tous les types</option>
          {Object.entries(INCIDENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={fGravite} onChange={(e) => setFGravite(e.target.value)} className="dvx-select">
          <option value="">Toutes gravités</option>
          {["critique", "grave", "moyen", "mineur"].map((g) => <option key={g} value={g}>{graviteMeta(g).label}</option>)}
        </select>
        <select value={fStatut} onChange={(e) => setFStatut(e.target.value)} className="dvx-select">
          <option value="">Tous les statuts</option>
          {["ouvert", "en_cours", "resolu", "annule"].map((s) => <option key={s} value={s}>{statutMeta(s).label}</option>)}
        </select>
        <select value={fConvoyeur} onChange={(e) => setFConvoyeur(e.target.value)} className="dvx-select max-w-[180px]">
          <option value="">Tous les convoyeurs</option>
          {convoyeurs.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <div className="flex overflow-hidden rounded-lg border border-[#eaeaee]">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-2.5 py-2 text-[11.5px] font-semibold ${period === p.key ? "bg-[#2f5fff] text-white" : "text-[#4a4d59] hover:bg-[#f7f8fb]"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {activeFilters > 0 && (
          <button onClick={resetFilters} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-[12px] font-semibold text-[#2f5fff] hover:bg-[#f0f4ff]">
            <X size={13} /> Réinitialiser
          </button>
        )}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-[#70727d]"><Loader2 className="animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#eaeaee] py-16 text-center">
          <Filter size={20} className="mx-auto mb-2 text-[#9598a4]" />
          <p className="text-[13px] text-[#70727d]">Aucun incident ne correspond à ces filtres.</p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filtered.map((r) => {
            const gm = graviteMeta(r.gravite);
            const sm = statutMeta(r.statut);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelected(r.id)}
                className={`dvx-card w-full text-left ${r.statut === "annule" ? "is-archived" : ""}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className={`dvx-badge ${graviteBadgeTone(r.gravite)}`}>{gm.label}</span>
                    <span className={`dvx-badge ${statutBadgeTone(r.statut)}`}>{sm.label}</span>
                    <span className="dvx-badge grey">{incidentTypeLabel(r.type_incident)}</span>
                    <span className="text-[11.5px] text-[#a3a4ac]">
                      {new Date(r.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                  </div>
                  <ChevronRight size={16} className="mt-1 shrink-0 text-[#9598a4]" />
                </div>

                <p className="mt-3 text-[13.5px] font-bold text-[#14161c]">{r.titre}</p>
                <p className="mt-0.5 line-clamp-1 text-[12.5px] text-[#70727d]">{r.description}</p>
                <p className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] text-[#a3a4ac]">
                  {r.numero_mission && <span>{r.numero_mission}</span>}
                  {r.convoyeur_nom && <span>{r.convoyeur_nom}</span>}
                  {r.client_nom && <span>{r.client_nom}</span>}
                  {r.resolu_at && <span>Résolu en {formatDuration(resolutionMinutes(r.created_at, r.resolu_at))}</span>}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {current && (
        <IncidentDetailPanel
          incident={current}
          admins={admins}
          onClose={() => setSelected(null)}
          onChanged={fetchAll}
        />
      )}
    </div>
  );
}
