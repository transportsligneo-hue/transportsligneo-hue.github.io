import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, MapPin, Truck, Loader2, PlusCircle } from "lucide-react";
import { StatusBadge, missionStatusKind, missionStatusLabel } from "@/components/dashboard/StatusBadge";

export const Route = createFileRoute("/_authenticated/dashboard-client/missions")({
  component: ClientMissions,
});

interface Mission {
  id: string;
  numero: string;
  ville_depart: string;
  ville_arrivee: string;
  date_prise_en_charge: string;
  statut: string;
  prix_total: number;
  marque: string | null;
  modele: string | null;
}

const STATUS_FILTERS = [
  { value: "all", label: "Toutes" },
  { value: "en_attente", label: "En attente" },
  { value: "confirmee", label: "Confirmées" },
  { value: "en_cours", label: "En cours" },
  { value: "livree", label: "Livrées" },
];

function ClientMissions() {
  const { user } = useAuth();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    let q = supabase
      .from("missions")
      .select("id, numero, ville_depart, ville_arrivee, date_prise_en_charge, statut, prix_total, marque, modele")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (filter !== "all") q = q.eq("statut", filter);
    q.then(({ data }) => {
      if (!cancelled) {
        setMissions((data ?? []) as Mission[]);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [user, filter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-heading text-2xl text-primary tracking-[0.1em] uppercase">Mes missions</h1>
          <p className="text-cream/50 text-sm mt-1">{missions.length} mission{missions.length > 1 ? "s" : ""}</p>
        </div>
        <Link
          to="/dashboard-client/nouvelle-reservation"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary border border-primary/30 rounded text-sm hover:bg-primary/20 transition-colors"
        >
          <PlusCircle size={14} /> Nouvelle réservation
        </Link>
      </div>

      {/* Filters */}
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

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>
      ) : missions.length === 0 ? (
        <div className="card-premium p-10 rounded text-center">
          <Truck className="text-cream/20 mx-auto mb-3" size={36} />
          <p className="text-cream/50 text-sm">Aucune mission dans cette catégorie.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {missions.map((m) => (
            <Link
              key={m.id}
              to="/dashboard-client/missions/$missionId"
              params={{ missionId: m.id }}
              className="card-premium p-5 rounded hover:border-primary/40 transition-all group"
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-2">
                    <span className="text-cream/40 text-[10px] uppercase tracking-wider">{m.numero}</span>
                    <StatusBadge kind={missionStatusKind(m.statut)}>
                      {missionStatusLabel(m.statut)}
                    </StatusBadge>
                  </div>
                  <p className="text-cream font-heading text-base flex items-center gap-2">
                    <MapPin size={14} className="text-primary shrink-0" />
                    <span className="truncate">{m.ville_depart}</span>
                    <span className="text-cream/30">→</span>
                    <span className="truncate">{m.ville_arrivee}</span>
                  </p>
                  <div className="flex items-center gap-4 text-xs text-cream/50 mt-2">
                    <span className="flex items-center gap-1"><Calendar size={11} />{new Date(m.date_prise_en_charge).toLocaleDateString("fr-FR")}</span>
                    {(m.marque || m.modele) && (
                      <span className="flex items-center gap-1"><Truck size={11} />{[m.marque, m.modele].filter(Boolean).join(" ")}</span>
                    )}
                  </div>
                </div>
                <span className="font-heading text-primary text-xl">{Number(m.prix_total).toFixed(2)} €</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
