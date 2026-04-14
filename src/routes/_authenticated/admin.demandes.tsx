import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Eye, X, RefreshCw, ArrowRightCircle, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/demandes")({
  component: AdminDemandes,
});

interface Demande {
  id: string;
  nom: string;
  prenom: string;
  telephone: string | null;
  email: string;
  depart: string;
  arrivee: string;
  date_souhaitee: string | null;
  heure_souhaitee: string | null;
  marque: string | null;
  modele: string | null;
  immatriculation: string | null;
  carburant: string | null;
  options: string | null;
  message: string | null;
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

const statutColors: Record<string, string> = {
  nouvelle: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  a_traiter: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  convertie: "bg-green-500/20 text-green-300 border-green-500/30",
  attribuee: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  terminee: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  annulee: "bg-red-500/20 text-red-300 border-red-500/30",
};

function AdminDemandes() {
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [selected, setSelected] = useState<Demande | null>(null);
  const [filterStatut, setFilterStatut] = useState<string>("all");
  const [converting, setConverting] = useState<string | null>(null);

  const fetchDemandes = useCallback(async () => {
    let query = supabase.from("demandes_convoyage").select("*").order("created_at", { ascending: false });
    if (filterStatut !== "all") query = query.eq("statut", filterStatut);
    const { data } = await query;
    if (data) setDemandes(data as Demande[]);
  }, [filterStatut]);

  useEffect(() => { fetchDemandes(); }, [fetchDemandes]);

  const updateStatut = async (id: string, statut: string) => {
    await supabase.from("demandes_convoyage").update({ statut }).eq("id", id);
    fetchDemandes();
    if (selected?.id === id) setSelected((prev) => prev ? { ...prev, statut } : null);
  };

  const convertToTrajet = async (d: Demande) => {
    setConverting(d.id);
    try {
      const { error } = await supabase.from("trajets").insert({
        demande_id: d.id,
        depart: d.depart,
        arrivee: d.arrivee,
        date_trajet: d.date_souhaitee,
        heure_trajet: d.heure_souhaitee ?? "",
        marque: d.marque ?? "",
        modele: d.modele ?? "",
        immatriculation: d.immatriculation ?? "",
        client_nom: `${d.prenom} ${d.nom}`,
        client_email: d.email,
        client_telephone: d.telephone ?? "",
        statut: "en_attente",
      });
      if (!error) {
        await updateStatut(d.id, "convertie");
        setSelected(null);
      }
    } finally {
      setConverting(null);
    }
  };

  const deleteDemande = async (id: string) => {
    if (!confirm("Supprimer cette demande ?")) return;
    await supabase.from("demandes_convoyage").delete().eq("id", id);
    setSelected(null);
    fetchDemandes();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-heading text-2xl text-primary tracking-[0.1em] uppercase">Demandes</h1>
          <p className="text-cream/50 text-sm mt-1">{demandes.length} demande{demandes.length > 1 ? "s" : ""}</p>
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
                <th className="text-left py-3 px-4 hidden sm:table-cell">Trajet</th>
                <th className="text-left py-3 px-4 hidden md:table-cell">Date</th>
                <th className="text-left py-3 px-4">Statut</th>
                <th className="text-left py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {demandes.map((d) => (
                <tr key={d.id} className="border-b border-primary/5 text-cream/80 hover:bg-primary/5 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-medium">{d.prenom} {d.nom}</div>
                    <div className="text-cream/40 text-xs sm:hidden">{d.depart} → {d.arrivee}</div>
                  </td>
                  <td className="py-3 px-4 text-cream/60 hidden sm:table-cell">{d.depart} → {d.arrivee}</td>
                  <td className="py-3 px-4 text-cream/40 hidden md:table-cell">{new Date(d.created_at).toLocaleDateString("fr-FR")}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs border ${statutColors[d.statut] ?? "bg-primary/10 text-primary border-primary/20"}`}>
                      {statutLabels[d.statut] ?? d.statut}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setSelected(d)} className="text-cream/50 hover:text-primary transition-colors" title="Voir">
                        <Eye size={16} />
                      </button>
                      {d.statut !== "convertie" && d.statut !== "terminee" && (
                        <button onClick={() => convertToTrajet(d)} disabled={converting === d.id} className="text-cream/50 hover:text-green-400 transition-colors" title="Convertir en trajet">
                          <ArrowRightCircle size={16} />
                        </button>
                      )}
                    </div>
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
              <button onClick={() => setSelected(null)} className="text-cream/50 hover:text-cream"><X size={18} /></button>
            </div>

            <div className="space-y-3 text-sm">
              <DetailRow label="Client" value={`${selected.prenom} ${selected.nom}`} />
              <DetailRow label="Email" value={selected.email} />
              <DetailRow label="Téléphone" value={selected.telephone} />
              <DetailRow label="Départ" value={selected.depart} />
              <DetailRow label="Arrivée" value={selected.arrivee} />
              <DetailRow label="Date souhaitée" value={selected.date_souhaitee} />
              <DetailRow label="Heure" value={selected.heure_souhaitee} />
              <DetailRow label="Véhicule" value={[selected.marque, selected.modele].filter(Boolean).join(" ") || null} />
              <DetailRow label="Immatriculation" value={selected.immatriculation} />
              <DetailRow label="Carburant" value={selected.carburant} />
              <DetailRow label="Options" value={selected.options} />
              <DetailRow label="Message" value={selected.message} />
            </div>

            <div className="mt-4 border-t border-primary/10 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-cream/40 text-xs uppercase tracking-wider">Statut</span>
                <select
                  value={selected.statut}
                  onChange={(e) => updateStatut(selected.id, e.target.value)}
                  className="bg-navy/60 border border-primary/20 rounded px-2 py-1 text-xs text-primary focus:outline-none appearance-none ml-auto"
                >
                  {statuts.map((s) => (
                    <option key={s} value={s}>{statutLabels[s]}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                {selected.statut !== "convertie" && selected.statut !== "terminee" && (
                  <button
                    onClick={() => convertToTrajet(selected)}
                    disabled={converting === selected.id}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-600/20 text-green-300 border border-green-500/30 rounded text-xs uppercase tracking-wider hover:bg-green-600/30 transition-colors disabled:opacity-50"
                  >
                    <ArrowRightCircle size={14} />
                    Convertir en trajet
                  </button>
                )}
                <button
                  onClick={() => deleteDemande(selected.id)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600/20 text-red-300 border border-red-500/30 rounded text-xs uppercase tracking-wider hover:bg-red-600/30 transition-colors"
                >
                  <Trash2 size={14} />
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-cream/40 text-xs uppercase tracking-wider">{label}</span>
      <p className="text-cream/80 mt-0.5">{value}</p>
    </div>
  );
}
