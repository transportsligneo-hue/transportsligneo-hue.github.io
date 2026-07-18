import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrgAccountType } from "@/hooks/useCurrentOrgAccountType";
import {
  Truck, Clock, CheckCircle, Calendar, ArrowUpRight, PlusCircle,
  Loader2, MapPin, Building2, FolderOpen, ChevronRight, Sparkles,
  Car, Wrench, AlertTriangle, Receipt, FileText, Activity, TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard-pro/")({
  component: ProDashboard,
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
}

interface VehicleRow {
  id: string;
  marque: string | null;
  modele: string | null;
  immatriculation: string | null;
  statut: "actif" | "en_mission" | "indispo" | "archive" | string;
}

interface DevisRow {
  id: string;
  numero: string;
  depart: string;
  arrivee: string;
  prix_estime: number | null;
  statut: string;
  created_at: string;
  paid_at: string | null;
  accepted_at: string | null;
  locked_at: string | null;
  mission_id: string | null;
}

interface FactureRow {
  id: string;
  numero: string;
  prix_ttc: number | null;
  statut: string;
  mode_paiement: string | null;
  date_facture: string | null;
  created_at: string;
}

interface ActivityRow {
  id: string;
  action: string;
  entity_type: string;
  actor_label: string | null;
  created_at: string;
}

const statutLabel: Record<string, string> = {
  en_attente: "En attente", confirmee: "Confirmée", en_cours: "En cours",
  livree: "Livrée", terminee: "Terminée", annulee: "Annulée", refuse: "Refusée",
};

const statutPillClasses: Record<string, string> = {
  en_attente: "bg-slate-100 text-slate-700",
  confirmee: "bg-blue-50 text-blue-700",
  en_cours: "bg-amber-50 text-amber-700",
  livree: "bg-emerald-50 text-emerald-700",
  terminee: "bg-emerald-50 text-emerald-700",
  annulee: "bg-red-50 text-red-700",
  refuse: "bg-red-50 text-red-700",
};

function ProDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate({ from: Route.fullPath });
  const [missions, setMissions] = useState<MissionRow[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [devis, setDevis] = useState<DevisRow[]>([]);
  const [factures, setFactures] = useState<FactureRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      const email = user.email ?? "";
      const orFilter = `user_id.eq.${user.id}${email ? `,email.eq.${email}` : ""}`;

      const [{ data: directRows }, { data: profile }, { data: memberships }, { data: devisData }, { data: facturesData }] = await Promise.all([
        supabase
          .from("missions")
          .select("id, numero, ville_depart, ville_arrivee, date_prise_en_charge, statut, prix_total, created_at")
          .or(orFilter)
          .order("created_at", { ascending: false }),
        supabase.from("profiles").select("organization_id").eq("user_id", user.id).maybeSingle(),
        supabase.from("organization_members").select("organization_id").eq("user_id", user.id).eq("status", "active"),
        supabase.from("devis")
          .select("id, numero, depart, arrivee, prix_estime, statut, created_at, paid_at, accepted_at, locked_at, mission_id")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase.from("factures")
          .select("id, numero, prix_ttc, statut, mode_paiement, date_facture, created_at")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      const orgIds = Array.from(new Set([
        profile?.organization_id,
        ...((memberships ?? []).map((m) => m.organization_id)),
      ].filter(Boolean))) as string[];

      let orgRows: MissionRow[] = [];
      let vehicleRows: VehicleRow[] = [];
      let activityRows: ActivityRow[] = [];

      if (orgIds.length > 0) {
        const [{ data: mData }, { data: vData }] = await Promise.all([
          supabase
            .from("missions")
            .select("id, numero, ville_depart, ville_arrivee, date_prise_en_charge, statut, prix_total, created_at")
            .or(orgIds.map((id) => `organization_id.eq.${id},fleet_organization_id.eq.${id}`).join(","))
            .order("created_at", { ascending: false }),
          supabase
            .from("vehicles")
            .select("id, marque, modele, immatriculation, statut")
            .in("organization_id", orgIds),
        ]);
        orgRows = (mData ?? []) as MissionRow[];
        vehicleRows = (vData ?? []) as VehicleRow[];
      }

      // Activity logs filtered by user id — best-effort (RLS applies)
      const { data: aData } = await supabase
        .from("activity_logs")
        .select("id, action, entity_type, actor_label, created_at")
        .eq("actor_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(6);
      activityRows = (aData ?? []) as ActivityRow[];

      const merged = [...((directRows ?? []) as MissionRow[]), ...orgRows];
      const uniqueMissions = Array.from(new Map(merged.map((row) => [row.id, row])).values())
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      if (cancelled) return;
      setMissions(uniqueMissions);
      setVehicles(vehicleRows);
      setDevis((devisData ?? []) as DevisRow[]);
      setFactures((facturesData ?? []) as FactureRow[]);
      setActivity(activityRows);
      setLoading(false);
    };

    void load();
    return () => { cancelled = true; };
  }, [user]);

  const today = new Date().toISOString().slice(0, 10);
  const enAttente = missions.filter(m => m.statut === "en_attente").length;
  const enCours = missions.filter(m => m.statut === "en_cours").length;
  const aVenir = missions.filter(m => m.statut === "confirmee" && m.date_prise_en_charge >= today).length;
  const terminees = missions.filter(m => m.statut === "livree" || m.statut === "terminee").length;

  const vehicleStats = useMemo(() => {
    const active = vehicles.filter(v => v.statut !== "archive");
    return {
      total: active.length,
      dispo: active.filter(v => v.statut === "actif").length,
      enMission: active.filter(v => v.statut === "en_mission").length,
      indispo: active.filter(v => v.statut === "indispo").length,
    };
  }, [vehicles]);

  const facturesImpayees = factures.filter(f => f.statut !== "payee" && f.statut !== "paid").length;
  const isDeferredInvoice = (mode?: string | null) => /virement|diff[ée]r|30|60|90/i.test(mode ?? "");
  const facturesARegler = factures.filter(f => f.statut !== "payee" && f.statut !== "paid" && !isDeferredInvoice(f.mode_paiement)).length;
  const devisEnAttente = devis.filter(d => {
    if (d.paid_at || d.accepted_at || d.locked_at || d.mission_id) return false;
    // Exclure aussi les devis convertis, refusés, annulés
    if ((d as { converted_at?: string | null }).converted_at) return false;
    if ((d as { refused_at?: string | null }).refused_at) return false;
    const terminal = ["accepte", "paye", "converti", "refuse", "annule", "expire"];
    if (terminal.includes(d.statut ?? "")) return false;
    return d.statut === "envoye" || d.statut === "en_attente";
  }).length;


  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-pro-accent" size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-pro-text">Espace Pro</h1>
          <p className="text-pro-muted text-sm mt-0.5">Vue d'ensemble de votre flotte et de vos missions</p>
        </div>
        <Link
          to="/dashboard-pro/nouvelle-demande"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-pro-accent text-white text-sm font-medium hover:bg-pro-accent-hover transition-colors shadow-sm"
        >
          <PlusCircle size={16} /> Nouvelle mission
        </Link>
      </div>

      {/* Alerts row */}
      {(facturesARegler > 0 || devisEnAttente > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {facturesARegler > 0 && (
            <Link to="/dashboard-pro/documents" className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200 hover:bg-amber-100/60 transition-colors">
              <div className="w-8 h-8 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-900">
                  {facturesARegler} facture{facturesARegler > 1 ? "s" : ""} à régler
                </p>
                <p className="text-xs text-amber-700/80">Consultez vos documents pour régulariser</p>
              </div>
              <ChevronRight size={16} className="text-amber-700 shrink-0" />
            </Link>
          )}
          {devisEnAttente > 0 && (
            <Link to="/dashboard-pro/documents" className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200 hover:bg-blue-100/60 transition-colors">
              <div className="w-8 h-8 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <FileText size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-blue-900">
                  {devisEnAttente} devis en attente d'action
                </p>
                <p className="text-xs text-blue-700/80">À valider ou payer</p>
              </div>
              <ChevronRight size={16} className="text-blue-700 shrink-0" />
            </Link>
          )}
        </div>
      )}

      {/* Missions KPIs */}
      <div>
        <p className="text-[11px] uppercase tracking-wider text-pro-muted font-medium mb-2">Missions</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard icon={Clock} label="En attente" value={enAttente} tone="amber" />
          <KpiCard icon={Truck} label="En cours" value={enCours} tone="blue" />
          <KpiCard icon={Calendar} label="À venir" value={aVenir} tone="violet" />
          <KpiCard icon={CheckCircle} label="Terminées" value={terminees} tone="emerald" />
        </div>
      </div>

      {/* Fleet KPIs */}
      {vehicleStats.total > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] uppercase tracking-wider text-pro-muted font-medium">Flotte</p>
            <Link to="/dashboard-pro/flotte" className="text-xs text-pro-accent hover:underline inline-flex items-center gap-1">
              Gérer la flotte <ArrowUpRight size={12} />
            </Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard icon={Car} label="Véhicules" value={vehicleStats.total} tone="blue" />
            <KpiCard icon={CheckCircle} label="Disponibles" value={vehicleStats.dispo} tone="emerald" />
            <KpiCard icon={Truck} label="En convoyage" value={vehicleStats.enMission} tone="violet" />
            <KpiCard icon={Wrench} label="Immobilisés" value={vehicleStats.indispo} tone="amber" />
          </div>
        </div>
      )}

      {/* Hub navigation cards */}
      <div>
        <h2 className="text-pro-text font-semibold text-sm mb-3 flex items-center gap-1.5">
          <Sparkles size={14} className="text-pro-accent" /> Accès rapide
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <HubCard
            to="/dashboard-pro/nouvelle-demande"
            icon={PlusCircle}
            title="Nouvelle demande"
            description="Créer une mission en quelques clics"
            tone="emerald"
            featured
          />
          <HubCard
            to="/dashboard-pro/missions"
            icon={Truck}
            title="Mes missions"
            description="Suivre l'état de vos demandes"
            badge={enCours > 0 ? `${enCours} active${enCours > 1 ? "s" : ""}` : undefined}
            tone="blue"
          />
          <HubCard
            to="/dashboard-pro/flotte"
            icon={Car}
            title="Ma flotte"
            description="Véhicules, statuts et historique"
            badge={vehicleStats.total > 0 ? `${vehicleStats.total} véh.` : undefined}
            tone="violet"
          />
          <HubCard
            to="/dashboard-pro/documents"
            icon={FolderOpen}
            title="Documents"
            description="Factures, devis et bons de commande"
            tone="amber"
          />
        </div>
      </div>

      {/* Missions table */}
      <div className="bg-white rounded-xl border border-pro-border overflow-hidden">
        <div className="px-5 py-4 border-b border-pro-border flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-pro-text">Dernières missions</h2>
            <p className="text-pro-muted text-xs mt-0.5">{missions.length} mission{missions.length > 1 ? "s" : ""} au total</p>
          </div>
          <Link to="/dashboard-pro/missions" className="text-pro-accent text-sm font-medium hover:underline inline-flex items-center gap-1">
            Tout voir <ArrowUpRight size={14} />
          </Link>
        </div>

        {missions.length === 0 ? (
          <div className="p-12 text-center">
            <Truck className="text-slate-300 mx-auto mb-3" size={36} />
            <p className="text-pro-text-soft text-sm">Aucune mission pour le moment.</p>
            <Link
              to="/dashboard-pro/nouvelle-demande"
              className="inline-flex items-center gap-1.5 mt-4 text-pro-accent text-sm font-medium hover:underline"
            >
              <PlusCircle size={14} /> Créer la première mission
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-pro-bg-soft text-pro-muted text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">N°</th>
                  <th className="text-left px-5 py-3 font-medium">Trajet</th>
                  <th className="text-left px-5 py-3 font-medium">Date</th>
                  <th className="text-left px-5 py-3 font-medium">Statut</th>
                  <th className="text-right px-5 py-3 font-medium">Montant</th>
                </tr>
              </thead>
              <tbody>
                {missions.slice(0, 8).map((m) => (
                  <tr
                    key={m.id}
                    className="border-t border-pro-border hover:bg-pro-bg-soft/60 transition-colors cursor-pointer"
                    onClick={() => navigate({ to: "/dashboard-pro/missions/$missionId", params: { missionId: m.id } })}
                  >
                    <td className="px-5 py-3 text-pro-text-soft font-mono text-xs">
                      <Link to="/dashboard-pro/missions/$missionId" params={{ missionId: m.id }} className="block">{m.numero}</Link>
                    </td>
                    <td className="px-5 py-3 text-pro-text">
                      <Link to="/dashboard-pro/missions/$missionId" params={{ missionId: m.id }} className="inline-flex items-center gap-1.5 w-full">
                        <MapPin size={12} className="text-pro-muted" />
                        {m.ville_depart} → {m.ville_arrivee}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-pro-text-soft">
                      <Link to="/dashboard-pro/missions/$missionId" params={{ missionId: m.id }} className="block">{new Date(m.date_prise_en_charge).toLocaleDateString("fr-FR")}</Link>
                    </td>
                    <td className="px-5 py-3">
                      <Link to="/dashboard-pro/missions/$missionId" params={{ missionId: m.id }} className="block">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statutPillClasses[m.statut] ?? "bg-slate-100 text-slate-700"}`}>
                          {statutLabel[m.statut] ?? m.statut}
                        </span>
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-pro-text">
                      <div className="flex items-center justify-end gap-3">
                        <Link to="/dashboard-pro/missions/$missionId" params={{ missionId: m.id }} className="block">{Number(m.prix_total).toFixed(2)} €</Link>
                        <Link
                          to="/dashboard-pro/missions/$missionId"
                          params={{ missionId: m.id }}
                          className="inline-flex items-center gap-1 text-pro-accent text-[11px] uppercase tracking-wider hover:underline"
                        >
                          Voir <ArrowUpRight size={12} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent devis & factures */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MiniListPanel
          title="Derniers devis"
          icon={FileText}
          linkTo="/dashboard-pro/documents"
          emptyLabel="Aucun devis récent"
        >
          {devis.slice(0, 5).map((d) => (
            <Link
              key={d.id}
              to="/dashboard-pro/documents"
              className="flex items-center justify-between px-4 py-2.5 border-t border-pro-border hover:bg-pro-bg-soft/50 transition-colors first:border-t-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-pro-text truncate">{d.numero}</p>
                <p className="text-xs text-pro-muted truncate">{d.depart} → {d.arrivee}</p>
              </div>
              <div className="text-right shrink-0 ml-3">
                <p className="text-sm font-semibold text-pro-text">
                  {d.prix_estime != null ? `${Number(d.prix_estime).toFixed(0)} €` : "—"}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-pro-muted">{d.statut}</p>
              </div>
            </Link>
          ))}
        </MiniListPanel>

        <MiniListPanel
          title="Dernières factures"
          icon={Receipt}
          linkTo="/dashboard-pro/documents"
          emptyLabel="Aucune facture récente"
        >
          {factures.slice(0, 5).map((f) => (
            <Link
              key={f.id}
              to="/dashboard-pro/documents"
              className="flex items-center justify-between px-4 py-2.5 border-t border-pro-border hover:bg-pro-bg-soft/50 transition-colors first:border-t-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-pro-text truncate">{f.numero}</p>
                <p className="text-xs text-pro-muted">
                  {f.date_facture ? new Date(f.date_facture).toLocaleDateString("fr-FR") : new Date(f.created_at).toLocaleDateString("fr-FR")}
                </p>
              </div>
              <div className="text-right shrink-0 ml-3">
                <p className="text-sm font-semibold text-pro-text">
                  {f.prix_ttc != null ? `${Number(f.prix_ttc).toFixed(2)} €` : "—"}
                </p>
                <p className={`text-[10px] uppercase tracking-wide font-medium ${
                  f.statut === "payee" || f.statut === "paid" ? "text-emerald-600" : "text-amber-600"
                }`}>
                  {f.statut === "payee" || f.statut === "paid" ? "Payée" : f.statut}
                </p>
              </div>
            </Link>
          ))}
        </MiniListPanel>
      </div>

      {/* Recent activity */}
      {activity.length > 0 && (
        <div className="bg-white rounded-xl border border-pro-border overflow-hidden">
          <div className="px-5 py-4 border-b border-pro-border flex items-center gap-2">
            <Activity size={16} className="text-pro-accent" />
            <h2 className="font-semibold text-pro-text text-sm">Activité récente</h2>
          </div>
          <ul className="divide-y divide-pro-border">
            {activity.map((a) => (
              <li key={a.id} className="px-5 py-3 flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-pro-accent mt-1.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-pro-text">
                    {`${(a.actor_label ?? "Système")} · ${a.action.replace(/_/g, " ")} · ${a.entity_type}`}
                  </p>
                  <p className="text-xs text-pro-muted mt-0.5">
                    {new Date(a.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MiniListPanel({
  title, icon: Icon, linkTo, emptyLabel, children,
}: {
  title: string;
  icon: LucideIcon;
  linkTo: string;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  const arr = Array.isArray(children) ? children : [children];
  const isEmpty = arr.filter(Boolean).length === 0;
  return (
    <div className="bg-white rounded-xl border border-pro-border overflow-hidden">
      <div className="px-5 py-4 border-b border-pro-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-pro-accent" />
          <h2 className="font-semibold text-pro-text text-sm">{title}</h2>
        </div>
        <Link to={linkTo} className="text-pro-accent text-xs font-medium hover:underline inline-flex items-center gap-1">
          Tout voir <ArrowUpRight size={12} />
        </Link>
      </div>
      {isEmpty ? (
        <div className="px-5 py-10 text-center text-pro-muted text-sm">{emptyLabel}</div>
      ) : (
        <div>{children}</div>
      )}
    </div>
  );
}

function HubCard({
  to, icon: Icon, title, description, badge, tone, featured,
}: {
  to: string;
  icon: LucideIcon;
  title: string;
  description: string;
  badge?: string;
  tone: "amber" | "blue" | "emerald" | "violet";
  featured?: boolean;
}) {
  const tones = {
    amber: { bg: "bg-amber-50", text: "text-amber-600", border: "hover:border-amber-200" },
    blue: { bg: "bg-blue-50", text: "text-blue-600", border: "hover:border-blue-200" },
    emerald: { bg: "bg-emerald-50", text: "text-emerald-600", border: "hover:border-emerald-200" },
    violet: { bg: "bg-violet-50", text: "text-violet-600", border: "hover:border-violet-200" },
  };
  const t = tones[tone];
  return (
    <Link
      to={to}
      className={`group bg-white rounded-xl border border-pro-border ${t.border} p-4 transition-all hover:shadow-md hover:-translate-y-0.5 ${
        featured ? "ring-1 ring-pro-accent/20" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${t.bg} ${t.text}`}>
          <Icon size={18} />
        </div>
        <ChevronRight size={16} className="text-pro-muted group-hover:text-pro-accent transition-colors mt-1" />
      </div>
      <div className="mt-3">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-pro-text text-sm">{title}</p>
          {badge && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${t.bg} ${t.text}`}>
              {badge}
            </span>
          )}
        </div>
        <p className="text-pro-muted text-xs mt-1 leading-snug">{description}</p>
      </div>
    </Link>
  );
}

function KpiCard({
  icon: Icon, label, value, tone,
}: {
  icon: LucideIcon; label: string; value: number | string;
  tone: "amber" | "blue" | "emerald" | "violet";
}) {
  const tones = {
    amber: "bg-amber-50 text-amber-600",
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    violet: "bg-violet-50 text-violet-600",
  };
  return (
    <div className="bg-white rounded-xl border border-pro-border p-4 lg:p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-pro-muted text-xs uppercase tracking-wide font-medium">{label}</p>
          <p className="text-2xl lg:text-3xl font-semibold text-pro-text mt-1.5">{value}</p>
        </div>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${tones[tone]}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}
