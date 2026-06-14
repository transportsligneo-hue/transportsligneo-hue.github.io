import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Truck, Clock, CheckCircle, Calendar, ArrowUpRight, PlusCircle,
  Loader2, MapPin, Building2, FolderOpen, ChevronRight, Sparkles,
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
  const [missions, setMissions] = useState<MissionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const loadMissionRows = async () => {
      const email = user.email ?? "";
      const orFilter = `user_id.eq.${user.id}${email ? `,email.eq.${email}` : ""}`;
      const [{ data: directRows }, { data: profile }, { data: memberships }] = await Promise.all([
        supabase
          .from("missions")
          .select("id, numero, ville_depart, ville_arrivee, date_prise_en_charge, statut, prix_total, created_at")
          .or(orFilter)
          .order("created_at", { ascending: false }),
        supabase.from("profiles").select("organization_id").eq("user_id", user.id).maybeSingle(),
        supabase.from("organization_members").select("organization_id").eq("user_id", user.id).eq("status", "active"),
      ]);

      const orgIds = Array.from(new Set([
        profile?.organization_id,
        ...((memberships ?? []).map((m) => m.organization_id)),
      ].filter(Boolean))) as string[];

      let orgRows: MissionRow[] = [];
      if (orgIds.length > 0) {
        const { data } = await supabase
          .from("missions")
          .select("id, numero, ville_depart, ville_arrivee, date_prise_en_charge, statut, prix_total, created_at")
          .or(orgIds.map((id) => `organization_id.eq.${id},fleet_organization_id.eq.${id}`).join(","))
          .order("created_at", { ascending: false });
        orgRows = (data ?? []) as MissionRow[];
      }

      const merged = [...((directRows ?? []) as MissionRow[]), ...orgRows];
      return Array.from(new Map(merged.map((row) => [row.id, row])).values())
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    };

    void loadMissionRows().then((rows) => {
      if (cancelled) return;
      setMissions(rows);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-pro-accent" size={28} />
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const enCours = missions.filter(m => m.statut === "en_cours").length;
  const aVenir = missions.filter(m => m.statut === "confirmee" && m.date_prise_en_charge >= today).length;
  const terminees = missions.filter(m => m.statut === "livree" || m.statut === "terminee").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-pro-text">Espace Pro</h1>
          <p className="text-pro-muted text-sm mt-0.5">Accès rapide à vos outils de convoyage</p>
        </div>
        <Link
          to="/dashboard-pro/nouvelle-demande"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-pro-accent text-white text-sm font-medium hover:bg-pro-accent-hover transition-colors shadow-sm"
        >
          <PlusCircle size={16} /> Nouvelle mission
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4">
        <KpiCard icon={Clock} label="En cours" value={enCours} tone="amber" />
        <KpiCard icon={Calendar} label="À venir" value={aVenir} tone="blue" />
        <KpiCard icon={CheckCircle} label="Livrées" value={terminees} tone="emerald" />
      </div>

      {/* Hub navigation cards */}
      <div>
        <h2 className="text-pro-text font-semibold text-sm mb-3 flex items-center gap-1.5">
          <Sparkles size={14} className="text-pro-accent" /> Accès rapide
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <HubCard
            to="/dashboard-pro/nouvelle-demande"
            icon={PlusCircle}
            title="Nouvelle demande"
            description="Créer une mission de convoyage en quelques clics"
            tone="emerald"
            featured
          />
          <HubCard
            to="/dashboard-pro/missions"
            icon={Truck}
            title="Mes missions"
            description="Suivre l'état de vos demandes en cours"
            badge={enCours > 0 ? `${enCours} active${enCours > 1 ? "s" : ""}` : undefined}
            tone="blue"
          />
          <HubCard
            to="/dashboard-pro/societe"
            icon={Building2}
            title="Ma société"
            description="Coordonnées, SIRET et facturation"
            tone="violet"
          />
          <HubCard
            to="/dashboard-pro/documents"
            icon={FolderOpen}
            title="Documents"
            description="Factures, bons de commande et CGV"
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
                  <tr key={m.id} className="border-t border-pro-border hover:bg-pro-bg-soft/60 transition-colors">
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
                          Voir le suivi <ArrowUpRight size={12} />
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
  icon: typeof Truck; label: string; value: number | string;
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
