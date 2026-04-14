import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Eye, X, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/demandes")({
  component: AdminDemandes,
});

interface Demande {
  id: string;
  nom: string;
  prenom: string;
  telephone: string;
  email: string;
  depart: string;
  arrivee: string;
  date_souhaitee: string | null;
  heure_souhaitee: string;
  marque: string;
  modele: string;
  immatriculation: string;
  carburant: string;
  options: string;
  message: string;
  statut: string;
  created_at: string;
}

const statuts = ["nouvelle", "a_traiter", "convertie", "attribuee", "terminee", "annulee"];
const statutLabels: Record<string, string> = {
  nouvelle: "Nouvelle",
  a_traiter: "À traiter",
  convertie: "Convertie",
  attribuee: "Attribuée",
  terminee: "Terminée",
  annulee: "Annulée",
};

function AdminDemandes() {
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [selected, setSelected] = useState<Demande | null>(null);
  const [filterStatut, setFilterStatut] = useState<string>("all");

  const fetchDemandes = async () => {
    let query = supabase.from("demandes_convoyage").select("*").order("created_at", { ascending: false });
    if (filterStatut !== "all") query = query.eq("statut", filterStatut);
    const { data } = await query;
    if (data) setDemandes(data as Demande[]);
  };

  useEffect(() => { fetchDemandes(); }, [filterStatut]);

  const updateStatut = async (id: string, statut: string) => {
    await supabase.from("demandes_convoyage").update({ statut }).eq("id", id);
    fetchDemandes();
    if (selected?.id === id) setSelected({ ...selected, statut });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-heading text-2xl text-primary tracking-[0.1em] uppercase">Demandes</h1>
          <p className="text-cream/50 text-sm mt-1">Toutes les demandes clients</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filterStatut}
            onChange={(e) => setFilterStatut(e.target.value)}
            className="bg-navy/60 border border-primary/20 rounded px-3 py-2 text-cream text-sm focus:border-primary/60 focus:outline-none appearance-none"
          >
            <option value="all">Tous les statuts</option>
            {statuts.map((s) => (
              <option key={s} value={s}>{statutLabels[s]}</option>
            ))}
          </select>
          <button onClick={fetchDemandes} className="p-2 text-cream/50 hover:text-primary transition-colors">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {demandes.length === 0 ? (
        <div className="card-premium p-8 rounded text-center text-cream/40">Aucune demande trouvée.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm card-premium rounded">
            <thead>
              <tr className="text-cream/50 text-xs uppercase tracking-wider border-b border-primary/10">
                <th className="text-left py-3 px-4">Client</th>
                <th className="text-left py-3 px-4">Contact</th>
                <th className="text-left py-3 px-4">Trajet</th>
                <th className="text-left py-3 px-4">Date</th>
                <th className="text-left py-3 px-4">Statut</th>
                <th className="text-left py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {demandes.map((d) => (
                <tr key={d.id} className="border-b border-primary/5 text-cream/80 hover:bg-primary/5 transition-colors">
                  <td className="py-3 px-4">{d.prenom} {d.nom}</td>
                  <td className="py-3 px-4 text-cream/60 text-xs">
                    <div>{d.email}</div>
                    {d.telephone && <div>{d.telephone}</div>}
                  </td>
                  <td className="py-3 px-4 text-cream/60">{d.depart} → {d.arrivee}</td>
                  <td className="py-3 px-4 text-cream/40">{new Date(d.created_at).toLocaleDateString("fr-FR")}</td>
                  <td className="py-3 px-4">
                    <select
                      value={d.statut}
                      onChange={(e) => updateStatut(d.id, e.target.value)}
                      className="bg-navy/60 border border-primary/20 rounded px-2 py-1 text-xs text-primary focus:outline-none appearance-none"
                    >
                      {statuts.map((s) => (
                        <option key={s} value={s}>{statutLabels[s]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 px-4">
                    <button onClick={() => setSelected(d)} className="text-cream/50 hover:text-primary transition-colors">
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setSelected(null)}>
          <div className="card-premium rounded-lg p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-lg text-primary">Détail demande</h3>
              <button onClick={() => setSelected(null)} className="text-cream/50 hover:text-cream">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <DetailRow label="Client" value={`${selected.prenom} ${selected.nom}`} />
              <DetailRow label="Email" value={selected.email} />
              <DetailRow label="Téléphone" value={selected.telephone} />
              <DetailRow label="Départ" value={selected.depart} />
              <DetailRow label="Arrivée" value={selected.arrivee} />
              <DetailRow label="Date souhaitée" value={selected.date_souhaitee ?? "-"} />
              <DetailRow label="Heure" value={selected.heure_souhaitee} />
              <DetailRow label="Véhicule" value={`${selected.marque} ${selected.modele}`.trim() || "-"} />
              <DetailRow label="Immatriculation" value={selected.immatriculation} />
              <DetailRow label="Carburant" value={selected.carburant} />
              <DetailRow label="Options" value={selected.options} />
              <DetailRow label="Message" value={selected.message} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-cream/40 text-xs uppercase tracking-wider">{label}</span>
      <p className="text-cream/80 mt-0.5">{value}</p>
    </div>
  );
}
