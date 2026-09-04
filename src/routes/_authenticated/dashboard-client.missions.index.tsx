import { createFileRoute, Link } from "@tanstack/react-router";
import ClientPageHeader from "@/components/dashboard/ClientPageHeader";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Calendar,
  MapPin,
  Truck,
  Loader2,
  PlusCircle,
  Clock,
  ArrowRight,
  FileText,
  LayoutList,
  LayoutGrid,
  Kanban,
  CalendarDays,
} from "lucide-react";
import { StatusBadge, missionStatusKind, missionStatusLabel } from "@/components/dashboard/StatusBadge";
import { prefetchMissionTracking } from "@/lib/mission-prefetch";

const friendlyStatusLabel = (statut: string): string => missionStatusLabel(statut);

export const Route = createFileRoute("/_authenticated/dashboard-client/missions/")({
  component: ClientMissions,
});

interface PendingItem {
  id: string;
  numero: string;
  depart: string;
  arrivee: string;
  date_souhaitee: string | null;
  created_at: string;
  source: "devis" | "demande";
}

interface Mission {
  id: string;
  numero: string;
  ville_depart: string;
  ville_arrivee: string;
  date_prise_en_charge: string;
  statut: string;
  marque: string | null;
  modele: string | null;
  immatriculation: string | null;
}

const STATUS_FILTERS = [
  { value: "all", label: "Toutes" },
  { value: "en_attente", label: "En attente" },
  { value: "confirmee", label: "Planifiées" },
  { value: "en_cours", label: "En cours" },
  { value: "archives", label: "Archives" },
];

const ARCHIVE_STATUTS = ["livree", "terminee", "validee", "en_attente_validation", "annulee"];

type ViewMode = "list" | "cards" | "kanban" | "planning";

const VIEWS: { value: ViewMode; label: string; icon: typeof LayoutList }[] = [
  { value: "list", label: "Liste", icon: LayoutList },
  { value: "cards", label: "Cartes", icon: LayoutGrid },
  { value: "kanban", label: "Kanban", icon: Kanban },
  { value: "planning", label: "Planning", icon: CalendarDays },
];

const KANBAN_COLUMNS: { key: string; label: string; match: (s: string) => boolean }[] = [
  { key: "en_attente", label: "En attente", match: (s) => s === "en_attente" || s === "en_recherche" },
  { key: "confirmee", label: "Planifiées", match: (s) => s === "confirmee" || s === "attribuee" },
  { key: "en_cours", label: "En cours", match: (s) => s === "en_cours" || s === "demarree" },
  { key: "terminee", label: "Terminées", match: (s) => ARCHIVE_STATUTS.includes(s) },
];

function ClientMissions() {
  const { user } = useAuth();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "list";
    return (localStorage.getItem("client-missions-view") as ViewMode) || "list";
  });

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("client-missions-view", view);
  }, [view]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    const email = user.email ?? "";
    const orFilter = `user_id.eq.${user.id}${email ? `,email.eq.${email}` : ""}`;

    let q = supabase
      .from("missions")
      .select("id, numero, ville_depart, ville_arrivee, date_prise_en_charge, statut, marque, modele, immatriculation")
      .or(orFilter)
      .order("created_at", { ascending: false });
    if (filter === "archives") {
      q = q.in("statut", ARCHIVE_STATUTS);
    } else if (filter !== "all") {
      q = q.eq("statut", filter);
    }

    const devisPending = supabase
      .from("devis")
      .select("id, numero, depart, arrivee, date_souhaitee, created_at, statut, mission_id")
      .or(orFilter)
      .is("mission_id", null)
      .not("statut", "in", "(refuse,convertit,converti,accepte,termine,terminee,annule,annulee,expire,expiree,archive,archivee)")
      .order("created_at", { ascending: false });

    const demandePending = supabase
      .from("demandes_convoyage")
      .select("id, depart, arrivee, date_souhaitee, created_at, statut")
      .or(orFilter)
      .not("statut", "in", "(refusee,annulee,convertie,converti,terminee,termine,livree,en_cours,validee,acceptee,archivee,archive)")
      .order("created_at", { ascending: false });

    Promise.all([q, devisPending, demandePending]).then(([mRes, dRes, demRes]) => {
      if (cancelled) return;
      setMissions((mRes.data ?? []) as Mission[]);
      const pendingList: PendingItem[] = [
        ...((dRes.data ?? []) as Array<{ id: string; numero: string; depart: string; arrivee: string; date_souhaitee: string | null; created_at: string }>).map(d => ({
          id: `devis-${d.id}`,
          numero: d.numero,
          depart: d.depart,
          arrivee: d.arrivee,
          date_souhaitee: d.date_souhaitee,
          created_at: d.created_at,
          source: "devis" as const,
        })),
        ...((demRes.data ?? []) as Array<{ id: string; depart: string; arrivee: string; date_souhaitee: string | null; created_at: string }>).map(d => ({
          id: `dem-${d.id}`,
          numero: `DEM-${d.id.slice(0, 6).toUpperCase()}`,
          depart: d.depart,
          arrivee: d.arrivee,
          date_souhaitee: d.date_souhaitee,
          created_at: d.created_at,
          source: "demande" as const,
        })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setPending(pendingList);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [user, filter]);

  const planningGroups = useMemo(() => {
    const groups = new Map<string, Mission[]>();
    for (const m of missions) {
      const d = m.date_prise_en_charge ? new Date(m.date_prise_en_charge) : null;
      const key = d ? d.toISOString().slice(0, 10) : "sans-date";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(m);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => (a > b ? 1 : -1));
  }, [missions]);

  const kanbanColumns = useMemo(() => {
    return KANBAN_COLUMNS.map((col) => ({
      ...col,
      items: missions.filter((m) => col.match(m.statut)),
    }));
  }, [missions]);

  const prefetchLinkProps = (m: Mission) => ({
    to: "/dashboard-client/missions/$missionId" as const,
    params: { missionId: m.id },
    onMouseEnter: () => prefetchMissionTracking(m.numero, m.id),
    onFocus: () => prefetchMissionTracking(m.numero, m.id),
    onTouchStart: () => prefetchMissionTracking(m.numero, m.id),
  });

  return (
    <div className="space-y-6">
      <ClientPageHeader
        breadcrumb="Mes missions"
        eyebrow="Suivi des convoyages"
        title="Mes"
        highlight="missions"
        subtitle={`${missions.length} mission${missions.length > 1 ? "s" : ""} enregistrée${missions.length > 1 ? "s" : ""} sur votre compte.`}
      />
      <div className="flex items-center justify-end flex-wrap gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          {/* View switcher */}
          <div className="inline-flex rounded border border-primary/20 bg-navy/40 p-0.5">
            {VIEWS.map((v) => {
              const Icon = v.icon;
              const active = view === v.value;
              return (
                <button
                  key={v.value}
                  onClick={() => setView(v.value)}
                  title={v.label}
                  aria-label={v.label}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] uppercase tracking-wider rounded transition-all ${
                    active
                      ? "bg-primary text-navy"
                      : "text-cream/60 hover:text-cream"
                  }`}
                >
                  <Icon size={13} />
                  <span className="hidden sm:inline">{v.label}</span>
                </button>
              );
            })}
          </div>
          <Link
            to="/dashboard-client/nouvelle-reservation"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary border border-primary/30 rounded text-sm hover:bg-primary/20 transition-colors"
          >
            <PlusCircle size={14} /> Nouvelle réservation
          </Link>
        </div>
      </div>

      {/* Filters (hidden in kanban since columns act as filters) */}
      {view !== "kanban" && (
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-4 py-1.5 text-xs uppercase tracking-wider rounded border transition-all ${
                filter === f.value
                  ? "bg-primary text-navy border-primary"
                  : "bg-navy/40 text-cream/60 border-primary/20 hover:border-primary/50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>
      ) : missions.length === 0 ? (
        <div className="card-premium p-10 rounded text-center">
          <Truck className="text-cream/20 mx-auto mb-3" size={36} />
          <p className="text-cream/50 text-sm">Aucune mission dans cette catégorie.</p>
          <Link
            to="/dashboard-client/nouvelle-reservation"
            className="client-btn-blue mt-4 inline-flex items-center gap-2 rounded-[9px] px-4 py-2.5 text-[12.5px] font-semibold"
          >
            <PlusCircle size={14} /> Réserver un convoyage
          </Link>
        </div>
      ) : view === "list" ? (
        <div className="grid gap-3">
          {missions.map((m) => (
            <Link
              key={m.id}
              {...prefetchLinkProps(m)}
              className="card-premium p-5 rounded hover:border-primary/40 transition-all group"
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-2">
                    <span className="text-cream/40 text-[10px] uppercase tracking-wider">{m.numero}</span>
                    <StatusBadge kind={missionStatusKind(m.statut)}>
                      {friendlyStatusLabel(m.statut)}
                    </StatusBadge>
                  </div>
                  <p className="text-cream font-heading text-base flex items-center gap-2">
                    <MapPin size={14} className="text-primary shrink-0" />
                    <span className="truncate">{m.ville_depart}</span>
                    <span className="text-cream/30">→</span>
                    <span className="truncate">{m.ville_arrivee}</span>
                  </p>
                  <div className="flex items-center gap-4 text-xs text-cream/50 mt-2 flex-wrap">
                    <span className="flex items-center gap-1"><Calendar size={11} />{new Date(m.date_prise_en_charge).toLocaleDateString("fr-FR")}</span>
                    {(m.marque || m.modele) && (
                      <span className="flex items-center gap-1"><Truck size={11} />{[m.marque, m.modele].filter(Boolean).join(" ")}{m.immatriculation ? ` · ${m.immatriculation}` : ""}</span>
                    )}
                  </div>
                </div>
                <span className="text-primary text-[10px] uppercase tracking-wider opacity-60 group-hover:opacity-100">Voir le suivi →</span>
              </div>
            </Link>
          ))}
        </div>
      ) : view === "cards" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {missions.map((m) => (
            <Link
              key={m.id}
              {...prefetchLinkProps(m)}
              className="card-premium p-5 rounded hover:border-primary/40 transition-all group flex flex-col gap-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-cream/40 text-[10px] uppercase tracking-wider">{m.numero}</span>
                <StatusBadge kind={missionStatusKind(m.statut)}>{friendlyStatusLabel(m.statut)}</StatusBadge>
              </div>
              <div className="space-y-1.5">
                <p className="text-cream text-sm flex items-center gap-2">
                  <MapPin size={12} className="text-primary shrink-0" />
                  <span className="truncate">{m.ville_depart}</span>
                </p>
                <p className="text-cream text-sm flex items-center gap-2">
                  <ArrowRight size={12} className="text-primary/60 shrink-0" />
                  <span className="truncate">{m.ville_arrivee}</span>
                </p>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-cream/50 flex-wrap pt-2 border-t border-primary/10">
                <span className="flex items-center gap-1"><Calendar size={11} />{new Date(m.date_prise_en_charge).toLocaleDateString("fr-FR")}</span>
                {(m.marque || m.modele) && (
                  <span className="flex items-center gap-1"><Truck size={11} />{[m.marque, m.modele].filter(Boolean).join(" ")}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : view === "kanban" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {kanbanColumns.map((col) => (
            <div key={col.key} className="card-premium p-3 rounded flex flex-col min-h-[300px]">
              <div className="flex items-center justify-between px-1 pb-3 mb-2 border-b border-primary/15">
                <h3 className="text-cream/80 text-[11px] uppercase tracking-wider font-heading">{col.label}</h3>
                <span className="text-cream/50 text-[10px] bg-navy/60 px-1.5 py-0.5 rounded">{col.items.length}</span>
              </div>
              <div className="space-y-2 flex-1">
                {col.items.length === 0 ? (
                  <p className="text-cream/30 text-[11px] text-center py-6">—</p>
                ) : (
                  col.items.map((m) => (
                    <Link
                      key={m.id}
                      {...prefetchLinkProps(m)}
                      className="block p-3 rounded bg-navy/50 border border-primary/15 hover:border-primary/40 transition-all"
                    >
                      <div className="text-cream/40 text-[10px] uppercase tracking-wider mb-1">{m.numero}</div>
                      <p className="text-cream text-xs leading-snug">
                        <span className="truncate block">{m.ville_depart}</span>
                        <span className="text-primary/60">↓</span>
                        <span className="truncate block">{m.ville_arrivee}</span>
                      </p>
                      <div className="flex items-center gap-1 text-[10px] text-cream/50 mt-2">
                        <Calendar size={10} />{new Date(m.date_prise_en_charge).toLocaleDateString("fr-FR")}
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Planning
        <div className="space-y-4">
          {planningGroups.map(([dateKey, list]) => {
            const d = dateKey === "sans-date" ? null : new Date(dateKey);
            const label = d
              ? d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
              : "Sans date";
            const isToday = d && d.toDateString() === new Date().toDateString();
            return (
              <div key={dateKey} className="card-premium rounded overflow-hidden">
                <div className={`flex items-center justify-between px-4 py-2.5 border-b border-primary/15 ${isToday ? "bg-primary/10" : "bg-navy/60"}`}>
                  <span className={`text-[11px] uppercase tracking-wider font-heading ${isToday ? "text-primary" : "text-cream/70"}`}>
                    {label} {isToday && <span className="ml-2 text-[10px] normal-case">· Aujourd'hui</span>}
                  </span>
                  <span className="text-cream/50 text-[10px]">{list.length} mission{list.length > 1 ? "s" : ""}</span>
                </div>
                <div className="divide-y divide-primary/10">
                  {list.map((m) => (
                    <Link
                      key={m.id}
                      {...prefetchLinkProps(m)}
                      className="flex items-center gap-3 p-3 hover:bg-primary/5 transition-colors group"
                    >
                      <div className="flex flex-col items-center justify-center min-w-[54px] px-2 py-1 rounded bg-navy/60">
                        <span className="text-primary text-sm font-heading tabular-nums">
                          {new Date(m.date_prise_en_charge).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="text-cream/40 text-[10px] uppercase tracking-wider">{m.numero}</span>
                          <StatusBadge kind={missionStatusKind(m.statut)}>{friendlyStatusLabel(m.statut)}</StatusBadge>
                        </div>
                        <p className="text-cream text-sm truncate">
                          {m.ville_depart} <span className="text-cream/30">→</span> {m.ville_arrivee}
                        </p>
                      </div>
                      <ArrowRight size={14} className="text-cream/30 group-hover:text-primary shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Demandes en attente de traitement admin */}
      {!loading && filter === "all" && pending.length > 0 && (
        <div className="pt-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading text-sm text-cream/80 tracking-wider uppercase flex items-center gap-2">
              <Clock size={14} className="text-amber-300" />
              Demandes en cours de validation
            </h2>
            <Link to="/dashboard-client/devis" className="text-primary text-[10px] uppercase tracking-wider hover:text-gold-light transition-colors">
              Détails →
            </Link>
          </div>
          <p className="text-cream/50 text-xs mb-3">
            Ces demandes ne sont pas encore converties en mission. Notre équipe les traite et elles apparaîtront ci-dessus dès validation.
          </p>
          <div className="grid gap-2">
            {pending.map((p) => (
              <Link
                key={p.id}
                to="/dashboard-client/devis"
                className="card-premium p-4 rounded flex flex-col sm:flex-row sm:items-center gap-3 hover:border-primary/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <FileText size={11} className="text-primary" />
                    <span className="text-cream/40 text-[10px] uppercase tracking-wider">{p.numero}</span>
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border bg-amber-500/15 text-amber-300 border-amber-500/30">
                      En cours de validation
                    </span>
                  </div>
                  <p className="text-cream/85 text-sm truncate">{p.depart} → {p.arrivee}</p>
                  <p className="text-cream/50 text-xs mt-0.5 flex flex-wrap gap-x-3">
                    <span><Calendar size={10} className="inline mr-1" />{new Date(p.created_at).toLocaleDateString("fr-FR")}</span>
                    {p.date_souhaitee && (
                      <span>Souhaité : {new Date(p.date_souhaitee).toLocaleDateString("fr-FR")}</span>
                    )}
                  </p>
                </div>
                <ArrowRight size={14} className="text-cream/30 shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
