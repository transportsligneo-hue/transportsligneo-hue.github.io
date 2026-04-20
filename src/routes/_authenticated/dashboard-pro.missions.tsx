import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Search, MapPin, Loader2, Truck, PlusCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard-pro/missions")({
  component: ProMissions,
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

const STATUTS = ["tous", "en_attente", "confirmee", "en_cours", "livree", "terminee", "annulee"] as const;
const statutLabel: Record<string, string> = {
  tous: "Tous", en_attente: "En attente", confirmee: "Confirmée", en_cours: "En cours",
  livree: "Livrée", terminee: "Terminée", annulee: "Annulée",
};
const statutPill: Record<string, string> = {
  en_attente: "bg-slate-100 text-slate-700",
  confirmee: "bg-blue-50 text-blue-700",
  en_cours: "bg-amber-50 text-amber-700",
  livree: "bg-emerald-50 text-emerald-700",
  terminee: "bg-emerald-50 text-emerald-700",
  annulee: "bg-red-50 text-red-700",
};

function ProMissions() {
  const { user } = useAuth();
  const [missions, setMissions] = useState<MissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("tous");
  const [search, setSearch] = useState("");

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

  const filtered = useMemo(() => {
    let list = missions;
    if (filter !== "tous") list = list.filter(m => m.statut === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        m.numero.toLowerCase().includes(q) ||
        m.ville_depart.toLowerCase().includes(q) ||
        m.ville_arrivee.toLowerCase().includes(q)
      );
    }
    return list;
  }, [missions, filter, search]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-pro-text">Missions</h1>
          <p className="text-pro-muted text-sm mt-0.5">Historique complet et suivi</p>
        </div>
        <Link
          to="/dashboard-pro/nouvelle-demande"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-pro-accent text-white text-sm font-medium hover:bg-pro-accent-hover shadow-sm"
        >
          <PlusCircle size={16} /> Nouvelle mission
        </Link>
      </div>

      {/* Filtres */}
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
      </div>

      {/* Liste */}
      <div className="bg-white rounded-xl border border-pro-border overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-pro-accent" size={24} /></div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Truck className="text-slate-300 mx-auto mb-3" size={36} />
            <p className="text-pro-text-soft text-sm">Aucune mission ne correspond.</p>
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
                {filtered.map((m) => (
                  <tr key={m.id} className="border-t border-pro-border hover:bg-pro-bg-soft/60">
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
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statutPill[m.statut] ?? "bg-slate-100 text-slate-700"}`}>
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
