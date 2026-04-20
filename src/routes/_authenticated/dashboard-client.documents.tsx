import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard-client/documents")({
  component: ClientDocuments,
});

interface DocRow {
  mission_id: string;
  numero: string;
  ville_depart: string;
  ville_arrivee: string;
  date_prise_en_charge: string;
}

function ClientDocuments() {
  const { user } = useAuth();
  const [missions, setMissions] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from("missions")
      .select("id, numero, ville_depart, ville_arrivee, date_prise_en_charge")
      .eq("user_id", user.id)
      .in("statut", ["livree", "terminee", "en_cours"])
      .order("date_prise_en_charge", { ascending: false })
      .then(({ data }) => {
        if (cancelled) return;
        if (data) {
          setMissions(data.map(m => ({
            mission_id: m.id,
            numero: m.numero,
            ville_depart: m.ville_depart,
            ville_arrivee: m.ville_arrivee,
            date_prise_en_charge: m.date_prise_en_charge,
          })));
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl text-primary tracking-[0.1em] uppercase">Mes documents</h1>
        <p className="text-cream/50 text-sm mt-1">Factures, attestations et photos d'état des lieux</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>
      ) : missions.length === 0 ? (
        <div className="card-premium p-10 rounded text-center">
          <FileText className="text-cream/20 mx-auto mb-3" size={36} />
          <p className="text-cream/50 text-sm">Aucun document disponible pour le moment.</p>
          <p className="text-cream/30 text-xs mt-2">Les documents apparaîtront ici une fois vos missions démarrées.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {missions.map((m) => (
            <div key={m.mission_id} className="card-premium p-5 rounded">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <div>
                  <p className="text-cream/40 text-[10px] uppercase tracking-wider">{m.numero}</p>
                  <p className="text-cream font-heading text-sm mt-1">{m.ville_depart} → {m.ville_arrivee}</p>
                </div>
                <span className="text-cream/50 text-xs">{new Date(m.date_prise_en_charge).toLocaleDateString("fr-FR")}</span>
              </div>
              <div className="text-cream/40 text-xs italic">
                Documents et photos d'état des lieux disponibles dès l'attribution d'un convoyeur.
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
