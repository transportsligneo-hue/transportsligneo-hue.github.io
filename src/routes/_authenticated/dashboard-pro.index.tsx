import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Truck, Clock, CheckCircle, Calendar, Euro, ArrowUpRight, PlusCircle,
  TrendingUp, Loader2, MapPin,
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
    supabase
      .from("missions")
      .select("id, numero, ville_depart, ville_arrivee, date_prise_en_charge, statut, prix_total, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setMissions((data ?? []) as MissionRow[]);
        setLoading(false);
      });
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
  const ca = missions
    .filter(m => m.statut === "livree" || m.statut === "terminee")
    .reduce((sum, m) => sum + Number(m.prix_total ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-pro-text">Vue d'ensemble</h1>
          <p className="text-pro-muted text-sm mt-0.5">Suivi de vos missions de convoyage</p>
        </div>
        <Link
          to="/dashboard-pro/nouvelle-demande"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-pro-accent text-white text-sm font-medium hover:bg-pro-accent-hover transition-colors shadow-sm"
        >
          <PlusCircle size={16} /> Nouvelle mission
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <KpiCard icon={Clock} label="En cours" value={enCours} tone="amber" />
        <KpiCard icon={Calendar} label="À venir" value={aVenir} tone="blue" />
        <KpiCard icon={CheckCircle} label="Livrées" value={terminees} tone="emerald" />
        <KpiCard icon={Euro} label="CA réalisé" value={`${ca.toFixed(0)} €`} tone="violet" />
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
                    <td className="px-5 py-3 text-pro-text-soft font-mono text-xs">{m.numero}</td>
                    <td className="px-5 py-3 text-pro-text">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin size={12} className="text-pro-muted" />
                        {m.ville_depart} → {m.ville_arrivee}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-pro-text-soft">
                      {new Date(m.date_prise_en_charge).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statutPillClasses[m.statut] ?? "bg-slate-100 text-slate-700"}`}>
                        {statutLabel[m.statut] ?? m.statut}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-pro-text">
                      {Number(m.prix_total).toFixed(2)} €
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
