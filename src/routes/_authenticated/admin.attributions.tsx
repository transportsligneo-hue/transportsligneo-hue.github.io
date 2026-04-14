import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Plus, X, Send } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/attributions")({
  component: AdminAttributions,
});

interface Attribution {
  id: string;
  trajet_id: string;
  convoyeur_id: string;
  statut: string;
  created_at: string;
  trajet?: { depart: string; arrivee: string; date_trajet: string | null; statut: string };
  convoyeur?: { nom: string; prenom: string };
}

interface Trajet {
  id: string;
  depart: string;
  arrivee: string;
  date_trajet: string | null;
  statut: string;
}

interface Convoyeur {
  id: string;
  nom: string;
  prenom: string;
  statut: string;
}

const statutLabels: Record<string, string> = {
  propose: "Proposé",
  accepte: "Accepté",
  refuse: "Refusé",
  en_cours: "En cours",
  termine: "Terminé",
  annule: "Annulé",
};
const statutColors: Record<string, string> = {
  propose: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  accepte: "bg-green-500/20 text-green-300 border-green-500/30",
  refuse: "bg-red-500/20 text-red-300 border-red-500/30",
  en_cours: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  termine: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  annule: "bg-gray-500/20 text-gray-300 border-gray-500/30",
};

function AdminAttributions() {
  const [attributions, setAttributions] = useState<Attribution[]>([]);
  const [trajetsDisponibles, setTrajetsDisponibles] = useState<Trajet[]>([]);
  const [convoyeursValides, setConvoyeursValides] = useState<Convoyeur[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTrajet, setSelectedTrajet] = useState("");
  const [selectedConvoyeur, setSelectedConvoyeur] = useState("");

  const fetchAttributions = useCallback(async () => {
    const { data } = await supabase
      .from("attributions")
      .select("*, trajet:trajets(depart, arrivee, date_trajet, statut), convoyeur:convoyeurs(nom, prenom)")
      .order("created_at", { ascending: false });
    if (data) setAttributions(data as unknown as Attribution[]);
  }, []);

  const fetchOptions = useCallback(async () => {
    const [trajets, convoyeurs] = await Promise.all([
      supabase.from("trajets").select("id, depart, arrivee, date_trajet, statut").in("statut", ["en_attente", "attribue"]),
      supabase.from("convoyeurs").select("id, nom, prenom, statut").eq("statut", "valide"),
    ]);
    if (trajets.data) setTrajetsDisponibles(trajets.data as Trajet[]);
    if (convoyeurs.data) setConvoyeursValides(convoyeurs.data as Convoyeur[]);
  }, []);

  useEffect(() => { fetchAttributions(); fetchOptions(); }, [fetchAttributions, fetchOptions]);

  const createAttribution = async () => {
    if (!selectedTrajet || !selectedConvoyeur) return;
    await supabase.from("attributions").insert({
      trajet_id: selectedTrajet,
      convoyeur_id: selectedConvoyeur,
      statut: "propose",
    });
    // Update trajet status
    await supabase.from("trajets").update({ statut: "attribue" }).eq("id", selectedTrajet);
    setShowCreate(false);
    setSelectedTrajet("");
    setSelectedConvoyeur("");
    fetchAttributions();
    fetchOptions();
  };

  const updateStatut = async (id: string, statut: string) => {
    await supabase.from("attributions").update({ statut }).eq("id", id);
    fetchAttributions();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-heading text-2xl text-primary tracking-[0.1em] uppercase">Attributions</h1>
          <p className="text-cream/50 text-sm mt-1">{attributions.length} attribution{attributions.length > 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { fetchOptions(); setShowCreate(true); }} className="inline-flex items-center gap-2 px-3 py-2 bg-primary/10 text-primary border border-primary/20 rounded text-sm hover:bg-primary/20 transition-colors">
            <Send size={16} /> Attribuer
          </button>
          <button onClick={fetchAttributions} className="p-2 text-cream/50 hover:text-primary transition-colors"><RefreshCw size={16} /></button>
        </div>
      </div>

      {attributions.length === 0 ? (
        <div className="card-premium p-8 rounded text-center text-cream/40">Aucune attribution pour le moment.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm card-premium rounded">
            <thead>
              <tr className="text-cream/50 text-xs uppercase tracking-wider border-b border-primary/10">
                <th className="text-left py-3 px-4">Trajet</th>
                <th className="text-left py-3 px-4">Convoyeur</th>
                <th className="text-left py-3 px-4 hidden md:table-cell">Date</th>
                <th className="text-left py-3 px-4">Statut</th>
              </tr>
            </thead>
            <tbody>
              {attributions.map((a) => (
                <tr key={a.id} className="border-b border-primary/5 text-cream/80 hover:bg-primary/5 transition-colors">
                  <td className="py-3 px-4">
                    {a.trajet ? `${a.trajet.depart} → ${a.trajet.arrivee}` : a.trajet_id.slice(0, 8)}
                  </td>
                  <td className="py-3 px-4">
                    {a.convoyeur ? `${a.convoyeur.prenom} ${a.convoyeur.nom}` : a.convoyeur_id.slice(0, 8)}
                  </td>
                  <td className="py-3 px-4 text-cream/40 hidden md:table-cell">
                    {a.trajet?.date_trajet ? new Date(a.trajet.date_trajet).toLocaleDateString("fr-FR") : "-"}
                  </td>
                  <td className="py-3 px-4">
                    <select value={a.statut} onChange={(e) => updateStatut(a.id, e.target.value)}
                      className={`px-2 py-0.5 rounded text-xs border focus:outline-none appearance-none ${statutColors[a.statut] ?? "bg-primary/10 text-primary border-primary/20"}`}>
                      {Object.entries(statutLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create attribution modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setShowCreate(false)}>
          <div className="card-premium rounded-lg p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-lg text-primary">Attribuer un trajet</h3>
              <button onClick={() => setShowCreate(false)} className="text-cream/50 hover:text-cream"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">Trajet *</label>
                <select value={selectedTrajet} onChange={(e) => setSelectedTrajet(e.target.value)}
                  className="w-full bg-navy/60 border border-primary/20 rounded px-3 py-2 text-cream text-sm focus:border-primary/60 focus:outline-none appearance-none">
                  <option value="">Sélectionner un trajet</option>
                  {trajetsDisponibles.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.depart} → {t.arrivee} {t.date_trajet ? `(${new Date(t.date_trajet).toLocaleDateString("fr-FR")})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">Convoyeur *</label>
                <select value={selectedConvoyeur} onChange={(e) => setSelectedConvoyeur(e.target.value)}
                  className="w-full bg-navy/60 border border-primary/20 rounded px-3 py-2 text-cream text-sm focus:border-primary/60 focus:outline-none appearance-none">
                  <option value="">Sélectionner un convoyeur</option>
                  {convoyeursValides.map((c) => (
                    <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
                  ))}
                </select>
              </div>
              <button onClick={createAttribution} disabled={!selectedTrajet || !selectedConvoyeur}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground font-heading text-sm tracking-[0.1em] uppercase hover:bg-gold-light transition-colors disabled:opacity-50">
                <Send size={16} /> Attribuer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
