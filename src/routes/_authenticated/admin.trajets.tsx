import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Plus, Eye, X, Edit2, Save } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/trajets")({
  component: AdminTrajets,
});

interface Trajet {
  id: string;
  depart: string;
  arrivee: string;
  date_trajet: string | null;
  heure_trajet: string | null;
  marque: string | null;
  modele: string | null;
  immatriculation: string | null;
  client_nom: string | null;
  client_email: string | null;
  client_telephone: string | null;
  prix: number | null;
  statut: string;
  notes_internes: string | null;
  demande_id: string | null;
  created_at: string;
}

const statuts = ["en_attente", "attribue", "accepte", "en_cours", "termine", "annule"];
const statutLabels: Record<string, string> = {
  en_attente: "En attente",
  attribue: "Attribué",
  accepte: "Accepté",
  en_cours: "En cours",
  termine: "Terminé",
  annule: "Annulé",
};
const statutColors: Record<string, string> = {
  en_attente: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  attribue: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  accepte: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  en_cours: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  termine: "bg-green-500/20 text-green-300 border-green-500/30",
  annule: "bg-red-500/20 text-red-300 border-red-500/30",
};

const emptyTrajet = {
  depart: "", arrivee: "", date_trajet: "", heure_trajet: "",
  marque: "", modele: "", immatriculation: "",
  client_nom: "", client_email: "", client_telephone: "",
  prix: "", notes_internes: "",
};

function AdminTrajets() {
  const [trajets, setTrajets] = useState<Trajet[]>([]);
  const [filterStatut, setFilterStatut] = useState("all");
  const [selected, setSelected] = useState<Trajet | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyTrajet);
  const [editing, setEditing] = useState(false);

  const fetchTrajets = useCallback(async () => {
    let query = supabase.from("trajets").select("*").order("created_at", { ascending: false });
    if (filterStatut !== "all") query = query.eq("statut", filterStatut);
    const { data } = await query;
    if (data) setTrajets(data as Trajet[]);
  }, [filterStatut]);

  useEffect(() => { fetchTrajets(); }, [fetchTrajets]);

  const createTrajet = async () => {
    if (!form.depart || !form.arrivee) return;
    await supabase.from("trajets").insert({
      depart: form.depart,
      arrivee: form.arrivee,
      date_trajet: form.date_trajet || null,
      heure_trajet: form.heure_trajet || "",
      marque: form.marque || "",
      modele: form.modele || "",
      immatriculation: form.immatriculation || "",
      client_nom: form.client_nom || "",
      client_email: form.client_email || "",
      client_telephone: form.client_telephone || "",
      prix: form.prix ? parseFloat(form.prix) : null,
      notes_internes: form.notes_internes || "",
    });
    setForm(emptyTrajet);
    setShowCreate(false);
    fetchTrajets();
  };

  const updateTrajet = async () => {
    if (!selected) return;
    await supabase.from("trajets").update({
      depart: form.depart,
      arrivee: form.arrivee,
      date_trajet: form.date_trajet || null,
      heure_trajet: form.heure_trajet || "",
      marque: form.marque || "",
      modele: form.modele || "",
      immatriculation: form.immatriculation || "",
      client_nom: form.client_nom || "",
      client_email: form.client_email || "",
      client_telephone: form.client_telephone || "",
      prix: form.prix ? parseFloat(form.prix) : null,
      notes_internes: form.notes_internes || "",
    }).eq("id", selected.id);
    setEditing(false);
    setSelected(null);
    fetchTrajets();
  };

  const updateStatut = async (id: string, statut: string) => {
    await supabase.from("trajets").update({ statut }).eq("id", id);
    fetchTrajets();
  };

  const openEdit = (t: Trajet) => {
    setForm({
      depart: t.depart, arrivee: t.arrivee,
      date_trajet: t.date_trajet ?? "", heure_trajet: t.heure_trajet ?? "",
      marque: t.marque ?? "", modele: t.modele ?? "",
      immatriculation: t.immatriculation ?? "",
      client_nom: t.client_nom ?? "", client_email: t.client_email ?? "",
      client_telephone: t.client_telephone ?? "",
      prix: t.prix?.toString() ?? "", notes_internes: t.notes_internes ?? "",
    });
    setEditing(true);
    setSelected(t);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-heading text-2xl text-primary tracking-[0.1em] uppercase">Trajets</h1>
          <p className="text-cream/50 text-sm mt-1">{trajets.length} trajet{trajets.length > 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={filterStatut} onChange={(e) => setFilterStatut(e.target.value)}
            className="bg-navy/60 border border-primary/20 rounded px-3 py-2 text-cream text-sm focus:border-primary/60 focus:outline-none appearance-none">
            <option value="all">Tous</option>
            {statuts.map((s) => <option key={s} value={s}>{statutLabels[s]}</option>)}
          </select>
          <button onClick={() => { setForm(emptyTrajet); setShowCreate(true); }} className="inline-flex items-center gap-2 px-3 py-2 bg-primary/10 text-primary border border-primary/20 rounded text-sm hover:bg-primary/20 transition-colors">
            <Plus size={16} /> Nouveau
          </button>
          <button onClick={fetchTrajets} className="p-2 text-cream/50 hover:text-primary transition-colors"><RefreshCw size={16} /></button>
        </div>
      </div>

      {trajets.length === 0 ? (
        <div className="card-premium p-8 rounded text-center text-cream/40">Aucun trajet trouvé.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm card-premium rounded">
            <thead>
              <tr className="text-cream/50 text-xs uppercase tracking-wider border-b border-primary/10">
                <th className="text-left py-3 px-4">Trajet</th>
                <th className="text-left py-3 px-4 hidden sm:table-cell">Client</th>
                <th className="text-left py-3 px-4 hidden md:table-cell">Date</th>
                <th className="text-left py-3 px-4 hidden md:table-cell">Prix</th>
                <th className="text-left py-3 px-4">Statut</th>
                <th className="text-left py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {trajets.map((t) => (
                <tr key={t.id} className="border-b border-primary/5 text-cream/80 hover:bg-primary/5 transition-colors">
                  <td className="py-3 px-4">
                    <div>{t.depart} → {t.arrivee}</div>
                    {t.marque && <div className="text-cream/40 text-xs">{t.marque} {t.modele}</div>}
                  </td>
                  <td className="py-3 px-4 text-cream/60 hidden sm:table-cell">{t.client_nom || "-"}</td>
                  <td className="py-3 px-4 text-cream/40 hidden md:table-cell">{t.date_trajet ? new Date(t.date_trajet).toLocaleDateString("fr-FR") : "-"}</td>
                  <td className="py-3 px-4 text-cream/60 hidden md:table-cell">{t.prix ? `${t.prix} €` : "-"}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs border ${statutColors[t.statut] ?? "bg-primary/10 text-primary border-primary/20"}`}>
                      {statutLabels[t.statut] ?? t.statut}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <button onClick={() => { setSelected(t); setEditing(false); }} className="text-cream/50 hover:text-primary transition-colors"><Eye size={16} /></button>
                      <button onClick={() => openEdit(t)} className="text-cream/50 hover:text-primary transition-colors"><Edit2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit modal */}
      {(showCreate || (selected && editing)) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => { setShowCreate(false); setEditing(false); setSelected(null); }}>
          <div className="card-premium rounded-lg p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-lg text-primary">{editing ? "Modifier trajet" : "Nouveau trajet"}</h3>
              <button onClick={() => { setShowCreate(false); setEditing(false); setSelected(null); }} className="text-cream/50 hover:text-cream"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FormInput label="Départ *" value={form.depart} onChange={(v) => setForm({ ...form, depart: v })} />
                <FormInput label="Arrivée *" value={form.arrivee} onChange={(v) => setForm({ ...form, arrivee: v })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormInput label="Date" value={form.date_trajet} onChange={(v) => setForm({ ...form, date_trajet: v })} type="date" />
                <FormInput label="Heure" value={form.heure_trajet} onChange={(v) => setForm({ ...form, heure_trajet: v })} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <FormInput label="Marque" value={form.marque} onChange={(v) => setForm({ ...form, marque: v })} />
                <FormInput label="Modèle" value={form.modele} onChange={(v) => setForm({ ...form, modele: v })} />
                <FormInput label="Immat." value={form.immatriculation} onChange={(v) => setForm({ ...form, immatriculation: v })} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <FormInput label="Client" value={form.client_nom} onChange={(v) => setForm({ ...form, client_nom: v })} />
                <FormInput label="Email" value={form.client_email} onChange={(v) => setForm({ ...form, client_email: v })} />
                <FormInput label="Tél." value={form.client_telephone} onChange={(v) => setForm({ ...form, client_telephone: v })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormInput label="Prix (€)" value={form.prix} onChange={(v) => setForm({ ...form, prix: v })} type="number" />
                <FormInput label="Notes internes" value={form.notes_internes} onChange={(v) => setForm({ ...form, notes_internes: v })} />
              </div>
              <button onClick={editing ? updateTrajet : createTrajet}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground font-heading text-sm tracking-[0.1em] uppercase hover:bg-gold-light transition-colors">
                <Save size={16} /> {editing ? "Enregistrer" : "Créer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View modal */}
      {selected && !editing && !showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setSelected(null)}>
          <div className="card-premium rounded-lg p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-lg text-primary">Détail trajet</h3>
              <button onClick={() => setSelected(null)} className="text-cream/50 hover:text-cream"><X size={18} /></button>
            </div>
            <div className="space-y-3 text-sm">
              <DetailRow label="Départ" value={selected.depart} />
              <DetailRow label="Arrivée" value={selected.arrivee} />
              <DetailRow label="Date" value={selected.date_trajet} />
              <DetailRow label="Heure" value={selected.heure_trajet} />
              <DetailRow label="Véhicule" value={[selected.marque, selected.modele].filter(Boolean).join(" ") || null} />
              <DetailRow label="Immatriculation" value={selected.immatriculation} />
              <DetailRow label="Client" value={selected.client_nom} />
              <DetailRow label="Email" value={selected.client_email} />
              <DetailRow label="Téléphone" value={selected.client_telephone} />
              <DetailRow label="Prix" value={selected.prix ? `${selected.prix} €` : null} />
              <DetailRow label="Notes" value={selected.notes_internes} />
            </div>
            <div className="mt-4 border-t border-primary/10 pt-4 flex items-center gap-2">
              <span className="text-cream/40 text-xs uppercase tracking-wider">Statut</span>
              <select value={selected.statut} onChange={(e) => { updateStatut(selected.id, e.target.value); setSelected({ ...selected, statut: e.target.value }); }}
                className="bg-navy/60 border border-primary/20 rounded px-2 py-1 text-xs text-primary focus:outline-none appearance-none ml-auto">
                {statuts.map((s) => <option key={s} value={s}>{statutLabels[s]}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FormInput({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full bg-navy/60 border border-primary/20 rounded px-3 py-2 text-cream text-sm focus:border-primary/60 focus:outline-none transition-colors" />
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
