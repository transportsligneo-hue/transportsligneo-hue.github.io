import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, MapPin, Truck, Loader2, PlusCircle, Clock, ArrowRight, FileText } from "lucide-react";
import { StatusBadge, missionStatusKind } from "@/components/dashboard/StatusBadge";

const friendlyStatusLabel = (statut: string): string => ({
  en_attente: "En attente de validation",
  confirmee: "Devis prêt",
  en_cours: "Convoyeur en route",
  livree: "Véhicule livré",
  terminee: "Terminée",
  annulee: "Annulée",
  refuse: "Refusée",
}[statut] ?? statut);

export const Route = createFileRoute("/_authenticated/dashboard-client/missions")({
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
  { value: "confirmee", label: "Confirmées" },
  { value: "en_cours", label: "En cours" },
  { value: "livree", label: "Livrées" },
];

function ClientMissions() {
  const { user } = useAuth();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

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
    if (filter !== "all") q = q.eq("statut", filter);

    // Demandes non encore converties (devis + demandes_convoyage sans mission liée)
    const devisPending = supabase
      .from("devis")
      .select("id, numero, depart, arrivee, date_souhaitee, created_at, statut, mission_id")
      .or(orFilter)
      .is("mission_id", null)
      .not("statut", "in", "(refuse,convertit)")
      .order("created_at", { ascending: false });

    const demandePending = supabase
      .from("demandes_convoyage")
      .select("id, depart, arrivee, date_souhaitee, created_at, statut")
      .or(orFilter)
      .not("statut", "in", "(refusee,annulee,convertie)")
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

