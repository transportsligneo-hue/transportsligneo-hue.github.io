import { createFileRoute, Link } from "@tanstack/react-router";
import FleetPageHeader from "@/components/flotte/FleetPageHeader";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Search, MapPin, Loader2, Truck, PlusCircle, Clock, FileText, ArrowRight, Calendar, Repeat, Zap, Car, Ban } from "lucide-react";
import { prefetchMissionTracking } from "@/lib/mission-prefetch";
import { displayNumero, legRef, stripLegSuffix } from "@/lib/mission-number";
import { MissionLegBadge } from "@/components/mission/MissionLegBadge";
import { MissionViewSwitcher, MissionViewsBody, useMissionView, type MissionViewItem } from "@/components/dashboard/MissionViews";
import { StatusBadge, missionStatusKind, missionStatusLabel } from "@/components/dashboard/StatusBadge";
import { ElectricBadge } from "@/components/mission/ElectricBadge";

export const Route = createFileRoute("/_authenticated/dashboard-pro/missions/")({
  component: ProMissionsIndex,
});

interface MissionRow {
  id: string;
  numero: string;
  ville_depart: string;
  ville_arrivee: string;
  date_prise_en_charge: string;
  statut: string;
  prix_total: number;
  created_at: string;
  leg_type: string | null;
  leg_index: number | null;
  mission_group_id: string | null;
  group_reference: string | null;
  marque: string | null;
  modele: string | null;
  immatriculation: string | null;
  vin: string | null;
  carburant: string | null;
  type_trajet: string | null;
}



interface PendingItem {
  id: string;
  numero: string;
  depart: string;
  arrivee: string;
  date_souhaitee: string | null;
  created_at: string;
  prix_estime: number | null;
  source: "devis" | "demande";
  statut: string;
}

/** Indicateurs enrichis par mission (recharge seule, motif d'annulation, incident). */
interface MissionFlags {
  recharge: boolean;
  motif: string | null;
  incident: string | null;
}

const STATUTS = ["tous", "en_attente", "confirmee", "en_cours", "livree", "terminee", "annulee"] as const;
const statutLabel: Record<string, string> = {
  tous: "Tous", en_attente: "En attente", confirmee: "Confirmée", en_cours: "En cours",
  livree: "Livrée", terminee: "Terminée", annulee: "Annulée",
};

function ProMissionsIndex() {
  const { user } = useAuth();
  const [missions, setMissions] = useState<MissionRow[]>([]);
  const [flags, setFlags] = useState<Record<string, MissionFlags>>({});
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("tous");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    const email = user.email ?? "";
    const orFilter = `user_id.eq.${user.id}${email ? `,email.eq.${email}` : ""}`;

    const loadMissionRows = async () => {
      const [{ data: directRows }, { data: profile }, { data: memberships }] = await Promise.all([
        supabase
          .from("missions")
          .select("id, numero, ville_depart, ville_arrivee, date_prise_en_charge, statut, prix_total, created_at, leg_type, leg_index, mission_group_id, group_reference, marque, modele, immatriculation, vin, carburant, type_trajet")
          .or(orFilter)
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("organization_id")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("organization_members")
          .select("organization_id")
          .eq("user_id", user.id)
          .eq("status", "active"),
      ]);

      const orgIds = Array.from(new Set([
        profile?.organization_id,
        ...((memberships ?? []).map((m) => m.organization_id)),
      ].filter(Boolean))) as string[];

      let orgRows: MissionRow[] = [];
      if (orgIds.length > 0) {
        const { data } = await supabase
          .from("missions")
          .select("id, numero, ville_depart, ville_arrivee, date_prise_en_charge, statut, prix_total, created_at, leg_type, leg_index, mission_group_id, group_reference, marque, modele, immatriculation, vin, carburant, type_trajet")
          .or(orgIds.map((id) => `organization_id.eq.${id},fleet_organization_id.eq.${id}`).join(","))
          .order("created_at", { ascending: false });
        orgRows = (data ?? []) as MissionRow[];
      }

      const merged = [...((directRows ?? []) as MissionRow[]), ...orgRows];
      return Array.from(new Map(merged.map((row) => [row.id, row])).values())
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    };

    const devisPending = supabase
      .from("devis")
      .select("id, numero, depart, arrivee, date_souhaitee, created_at, statut, prix_estime, mission_id")
      .or(orFilter)
      .is("mission_id", null)
      .not("statut", "in", "(refuse,convertit,converti,accepte,termine,terminee,annule,annulee,expire,expiree,archive,archivee)")
      .order("created_at", { ascending: false });

    const demandePending = supabase
      .from("demandes_convoyage")
      .select("id, depart, arrivee, date_souhaitee, created_at, statut, prix_estime")
      .or(orFilter)
      .not("statut", "in", "(refusee,annulee,convertie,converti,terminee,termine,livree,en_cours,validee,acceptee,archivee,archive)")
      .order("created_at", { ascending: false });

    Promise.all([loadMissionRows(), devisPending, demandePending]).then(async ([missionRows, dRes, demRes]) => {
      if (cancelled) return;
      setMissions(missionRows as MissionRow[]);
      const ids = missionRows.map((m) => m.id);
      if (ids.length > 0) {
        const { data: flagRows } = await supabase.rpc("get_missions_client_flags", { p_mission_ids: ids });
        if (!cancelled && flagRows) {
          const map: Record<string, MissionFlags> = {};
          for (const f of flagRows) {
            map[f.mission_id] = { recharge: f.recharge_seule, motif: f.annulation_motif, incident: f.incident_titre };
          }
          setFlags(map);
        }
      }
      const pendingList: PendingItem[] = [
        ...((dRes.data ?? []) as Array<{ id: string; numero: string; depart: string; arrivee: string; date_souhaitee: string | null; created_at: string; statut: string; prix_estime: number | null }>).map(d => ({
          id: `devis-${d.id}`,
          numero: d.numero,
          depart: d.depart,
          arrivee: d.arrivee,
          date_souhaitee: d.date_souhaitee,
          created_at: d.created_at,
          prix_estime: d.prix_estime,
          source: "devis" as const,
          statut: d.statut,
        })),
        ...((demRes.data ?? []) as Array<{ id: string; depart: string; arrivee: string; date_souhaitee: string | null; created_at: string; statut: string; prix_estime: number | null }>).map(d => ({
          id: `dem-${d.id}`,
          numero: `DEM-${d.id.slice(0, 6).toUpperCase()}`,
          depart: d.depart,
          arrivee: d.arrivee,
          date_souhaitee: d.date_souhaitee,
          created_at: d.created_at,
          prix_estime: d.prix_estime,
          source: "demande" as const,
          statut: d.statut,
        })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setPending(pendingList);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [user]);

  const filtered = useMemo(() => {
    let list = missions;
    if (filter !== "tous") list = list.filter(m => m.statut === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        m.numero.toLowerCase().includes(q) ||
        m.ville_depart.toLowerCase().includes(q) ||
        m.ville_arrivee.toLowerCase().includes(q) ||
        (m.immatriculation ?? "").toLowerCase().includes(q) ||
        (m.vin ?? "").toLowerCase().includes(q) ||
        `${m.marque ?? ""} ${m.modele ?? ""}`.toLowerCase().includes(q)
      );
    }
    return list;
  }, [missions, filter, search]);

  /** Regroupe les jambes Livraison + Restitution d'un même dossier. */
  const dossiers = useMemo(() => {
    const map = new Map<string, MissionRow[]>();
    for (const m of filtered) {
      const key = m.mission_group_id ?? m.group_reference ?? stripLegSuffix(m.numero);
      const arr = map.get(key);
      if (arr) arr.push(m);
      else map.set(key, [m]);
    }
    return Array.from(map.entries()).map(([key, legs]) => {
      const ordered = [...legs].sort((a, b) => {
        const rank = (l: MissionRow) => (l.leg_type === "retour" ? 1 : 0);
        return rank(a) - rank(b) || (a.leg_index ?? 0) - (b.leg_index ?? 0);
      });
      const isDuo = ordered.length > 1 || ordered.some(l => l.leg_type === "aller" || l.leg_type === "retour");
      const total = ordered.reduce((sum, l) => sum + Number(l.prix_total ?? 0), 0);
      const head = ordered[0]!;
      return { key, legs: ordered, isDuo, total, head };
    });
  }, [filtered]);


  const pendingFiltered = useMemo(() => {
    if (!search.trim()) return pending;
    const q = search.toLowerCase();
    return pending.filter(p =>
      p.numero.toLowerCase().includes(q) ||
      p.depart.toLowerCase().includes(q) ||
      p.arrivee.toLowerCase().includes(q)
    );
  }, [pending, search]);

  const [view, setView] = useMissionView("ligneo:view:pro-missions:v2");

  const typeLabelFor = (m: MissionRow): string => {
    if (flags[m.id]?.recharge) return "Recharge uniquement";
    if (m.leg_type === "aller" || m.leg_type === "retour" || m.type_trajet === "aller_retour") return "Livraison + Restitution";
    return "Livraison simple";
  };

  const viewItems = useMemo<MissionViewItem[]>(
    () =>
      filtered.map((m) => ({
        id: m.id,
        numero: displayNumero(m.numero),
        depart: m.ville_depart,
        arrivee: m.ville_arrivee,
        date: m.date_prise_en_charge,
        statut: m.statut,
        statutLabel: statutLabel[m.statut] ?? m.statut,
        meta: [
          [m.marque, m.modele].filter(Boolean).join(" ") || m.immatriculation,
          typeLabelFor(m),
          (m.statut === "annulee" || m.statut === "annule") && (flags[m.id]?.motif || flags[m.id]?.incident)
            ? `Annulée : ${flags[m.id]?.motif ?? flags[m.id]?.incident}`
            : null,
        ].filter(Boolean).join(" · ") || undefined,
        amount: `${Number(m.prix_total ?? 0).toFixed(2)} €`,
        wrap: (children) => (
          <Link to="/dashboard-pro/missions/$missionId" params={{ missionId: m.id }} className="block h-full">
            {children}
          </Link>
        ),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, flags],
  );

  return (
    <div className="space-y-5">
      <FleetPageHeader
        breadcrumb="Missions"
        eyebrow="Suivi d'activité"
        title="Toutes vos"
        highlight="missions"
        subtitle="De la demande à la livraison, en un seul endroit."
        actions={
          <Link
            to="/dashboard-pro/nouvelle-demande"
            className="flex items-center gap-1.5 rounded-[9px] fleet-btn-violet px-4 py-2.5 text-[12.5px] font-semibold transition-colors"
          >
            <PlusCircle size={14} /> Nouvelle mission
          </Link>
        }
      />

      <div className="bg-white rounded-xl border border-pro-border p-3 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-pro-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par n°, ville…"
            className="w-full pl-9 pr-3 py-2 text-sm bg-pro-bg-soft border border-transparent focus:border-pro-accent focus:bg-white rounded-md outline-none transition-colors text-pro-text placeholder:text-pro-muted"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUTS.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter === s
                  ? "bg-pro-accent text-white"
                  : "bg-pro-bg-soft text-pro-text-soft hover:bg-slate-200"
              }`}
            >
              {statutLabel[s]}
            </button>
          ))}
        </div>
        <MissionViewSwitcher view={view} onChange={setView} className="md:ml-auto self-start" />
      </div>

      {!loading && filter === "tous" && pendingFiltered.length > 0 && (
        <div className="bg-white rounded-xl border border-pro-border overflow-hidden">
          <div className="px-5 py-3 border-b border-pro-border flex items-center gap-2 bg-amber-50/40">
            <Clock size={14} className="text-amber-600" />
            <h2 className="text-sm font-semibold text-pro-text">En cours de validation</h2>
            <span className="ml-auto text-xs text-pro-text-soft">{pendingFiltered.length} demande{pendingFiltered.length > 1 ? "s" : ""}</span>
          </div>
          <ul className="divide-y divide-pro-border">
            {pendingFiltered.map((p) => (
              <li key={p.id}>
                <Link
                  to={p.source === "devis" ? "/dashboard-pro/devis-instantane" : "/dashboard-pro/missions"}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-pro-bg-soft/60 transition-colors"
                >
                  <FileText size={14} className="text-pro-accent shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-pro-text-soft">{displayNumero(p.numero)}</span>
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide bg-amber-100 text-amber-700">
                        {p.source === "devis" ? "Devis en attente" : "Demande reçue"}
                      </span>
                    </div>
                    <p className="text-sm text-pro-text mt-0.5 truncate">{p.depart} → {p.arrivee}</p>
                    <p className="text-xs text-pro-text-soft mt-0.5 flex flex-wrap gap-x-3">
                      <span><Calendar size={10} className="inline mr-1" />{new Date(p.created_at).toLocaleDateString("fr-FR")}</span>
                      {p.date_souhaitee && <span>Souhaité : {new Date(p.date_souhaitee).toLocaleDateString("fr-FR")}</span>}
                    </p>
                  </div>
                  {p.prix_estime != null && (
                    <span className="text-sm font-semibold text-pro-text whitespace-nowrap">{Number(p.prix_estime).toFixed(2)} €</span>
                  )}
                  <ArrowRight size={14} className="text-pro-muted shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Truck size={14} className="text-[#5334d6]" />
          <h2 className="text-sm font-semibold text-pro-text">Dossiers de transport</h2>
          <span className="ml-auto text-xs text-pro-text-soft">
            {dossiers.length} dossier{dossiers.length > 1 ? "s" : ""} · {filtered.length} mission{filtered.length > 1 ? "s" : ""}
          </span>
        </div>

        {loading ? (
          <div className="p-12 flex justify-center bg-white rounded-2xl border border-pro-border">
            <Loader2 className="animate-spin text-[#5334d6]" size={24} />
          </div>
        ) : dossiers.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-pro-border">
            <Truck className="text-slate-300 mx-auto mb-3" size={36} />
            <p className="text-pro-text-soft text-sm">Aucune mission ne correspond.</p>
          </div>
        ) : view !== "list" ? (
          <MissionViewsBody view={view} items={viewItems} />
        ) : (
          dossiers.map(({ key, legs, isDuo, total, head }) => {
            const elec = (head.carburant ?? "").toLowerCase().includes("elec")
              || (head.carburant ?? "").toLowerCase().includes("élec");
            const fmtDate = (d: string) =>
              new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
            const dates = legs
              .map((l) => l.date_prise_en_charge)
              .filter(Boolean)
              .sort();
            const dateLabel = dates.length === 0
              ? "Date à définir"
              : dates[0] === dates[dates.length - 1]
                ? fmtDate(dates[0]!)
                : `${fmtDate(dates[0]!)} → ${fmtDate(dates[dates.length - 1]!)}`;
            const plates = Array.from(
              new Set(legs.map((l) => l.immatriculation).filter(Boolean) as string[]),
            );
            const anyRecharge = legs.some((l) => flags[l.id]?.recharge);
            return (
              <article key={key} className="fleet-dossier">
                <header className="fleet-dossier-head">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="fleet-dossier-num">{displayNumero(stripLegSuffix(head.numero))}</span>
                    {anyRecharge ? (
                      <span className="fleet-chip-recharge" title="Recharge du véhicule sur place, sans livraison">
                        <Zap size={10} /> Recharge uniquement
                      </span>
                    ) : isDuo ? (
                      <span className="fleet-chip-duo" title="Dossier avec livraison + restitution">
                        <Repeat size={10} /> Livraison + Restitution
                      </span>
                    ) : (
                      <span className="fleet-chip-simple">Livraison simple</span>
                    )}
                    {plates.map((p) => (
                      <span key={p} className="plate-tag">{p}</span>
                    ))}
                    {elec && <span className="fleet-chip-elec"><Zap size={10} /> Électrique</span>}
                  </div>
                  <div className="fleet-dossier-total">
                    {total.toFixed(2)} €
                    {isDuo && legs.length > 1 && <span className="fleet-dossier-total-note">total dossier</span>}
                  </div>
                </header>

                <div className="fleet-dossier-vehicle">
                  <Calendar size={12} className="text-[#5334d6]" />
                  <span className="font-semibold text-[#1b2340]">{dateLabel}</span>
                  <span className="text-pro-muted">·</span>
                  <Car size={12} />
                  <span>{[head.marque, head.modele].filter(Boolean).join(" ") || "Véhicule à préciser"}</span>
                  <ElectricBadge energie={head.carburant} marque={head.marque} modele={head.modele} variant="light" />
                  {head.vin && <span className="fleet-vin">VIN {head.vin}</span>}
                </div>


                <ul className="fleet-leg-list">
                  {legs.map((m) => (
                    <li key={m.id}>
                      <Link
                        to="/dashboard-pro/missions/$missionId"
                        params={{ missionId: m.id }}
                        className="fleet-leg"
                        onMouseEnter={() => prefetchMissionTracking(m.numero, m.id)}
                        onFocus={() => prefetchMissionTracking(m.numero, m.id)}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[11px] text-pro-text-soft">{legRef(m.numero, m.leg_type, m.leg_index, isDuo)}</span>
                          <MissionLegBadge leg={m.leg_type as "aller" | "retour" | "simple" | null} size="xs" />
                          <StatusBadge kind={missionStatusKind(m.statut)}>
                            {statutLabel[m.statut] ?? missionStatusLabel(m.statut)}
                          </StatusBadge>
                          {flags[m.id]?.recharge && (
                            <span className="fleet-chip-recharge" title="Recharge du véhicule sur place, sans livraison">
                              <Zap size={10} /> Recharge uniquement
                            </span>
                          )}
                        </div>
                        <div className="fleet-leg-route">
                          <MapPin size={12} className="text-[#5334d6] shrink-0" />
                          <span className="truncate">{m.ville_depart}</span>
                          <ArrowRight size={12} className="text-pro-muted shrink-0" />
                          <span className="truncate">{m.ville_arrivee}</span>
                        </div>
                        <div className="fleet-leg-meta">
                          <span><Calendar size={10} className="inline mr-1" />{new Date(m.date_prise_en_charge).toLocaleDateString("fr-FR")}</span>
                          {m.immatriculation && <span className="plate-tag plate-tag--sm">{m.immatriculation}</span>}
                          <span className="font-semibold text-pro-text">{Number(m.prix_total).toFixed(2)} €</span>
                          <span className="fleet-leg-cta">Suivi <ArrowRight size={11} /></span>
                        </div>
                        {(m.statut === "annulee" || m.statut === "annule") &&
                          (flags[m.id]?.motif || flags[m.id]?.incident) && (
                            <div className="fleet-leg-cancel-motif">
                              <Ban size={12} className="shrink-0 mt-0.5" />
                              <span>
                                Annulée : {flags[m.id]?.motif ?? flags[m.id]?.incident}
                              </span>
                            </div>
                          )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })
        )}
      </div>

    </div>
  );
}