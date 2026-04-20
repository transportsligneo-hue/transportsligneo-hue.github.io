import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Eye, X, CheckCircle, XCircle, Plus, UserPlus } from "lucide-react";
import { sendTransactionalEmail } from "@/lib/email/send";

export const Route = createFileRoute("/_authenticated/admin/convoyeurs")({
  component: AdminConvoyeurs,
});

interface Convoyeur {
  id: string;
  user_id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  ville: string | null;
  disponibilite: string | null;
  permis: string | null;
  message: string | null;
  statut: string;
  type_convoyeur: string;
  created_at: string;
}

const statuts = ["en_attente", "valide", "refuse", "suspendu"];
const statutLabels: Record<string, string> = {
  en_attente: "En attente",
  valide: "Validé",
  refuse: "Refusé",
  suspendu: "Suspendu",
};
const statutColors: Record<string, string> = {
  en_attente: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  valide: "bg-green-500/20 text-green-300 border-green-500/30",
  refuse: "bg-red-500/20 text-red-300 border-red-500/30",
  suspendu: "bg-gray-500/20 text-gray-300 border-gray-500/30",
};
const dispoLabels: Record<string, string> = {
  temps_plein: "Temps plein",
  temps_partiel: "Temps partiel",
  weekend: "Weekends",
  ponctuel: "Ponctuel",
};

interface MissionHistorique {
  id: string;
  statut: string;
  created_at: string;
  trajet?: { depart: string; arrivee: string; date_trajet: string | null; tarif_convoyeur: number | null } | null;
}

function AdminConvoyeurs() {
  const [convoyeurs, setConvoyeurs] = useState<Convoyeur[]>([]);
  const [filterStatut, setFilterStatut] = useState("all");
  const [selected, setSelected] = useState<Convoyeur | null>(null);
  const [historique, setHistorique] = useState<MissionHistorique[]>([]);
  const [loadingHisto, setLoadingHisto] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ nom: "", prenom: "", email: "", telephone: "", password: "" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const fetchConvoyeurs = useCallback(async () => {
    let query = supabase.from("convoyeurs").select("*").order("created_at", { ascending: false });
    if (filterStatut !== "all") query = query.eq("statut", filterStatut);
    const { data } = await query;
    if (data) setConvoyeurs(data as Convoyeur[]);
  }, [filterStatut]);

  useEffect(() => { fetchConvoyeurs(); }, [fetchConvoyeurs]);

  useEffect(() => {
    if (!selected) { setHistorique([]); return; }
    let cancelled = false;
    const loadHisto = async () => {
      setLoadingHisto(true);
      const { data } = await supabase
        .from("attributions")
        .select("id, statut, created_at, trajet:trajets(depart, arrivee, date_trajet, tarif_convoyeur)")
        .eq("convoyeur_id", selected.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (!cancelled && data) setHistorique(data as unknown as MissionHistorique[]);
      if (!cancelled) setLoadingHisto(false);
    };
    loadHisto();
    return () => { cancelled = true; };
  }, [selected]);

  const updateStatut = async (id: string, statut: string) => {
    // Blocage : un indépendant ne peut être validé sans tous les docs approuvés
    if (statut === "valide") {
      const target = convoyeurs.find(c => c.id === id) || (selected?.id === id ? selected : null);
      if (target?.type_convoyeur === "independant") {
        const { data: docs } = await supabase
          .from("documents_convoyeurs")
          .select("type_document, statut_validation" as never)
          .eq("convoyeur_id", id);
        const required = ["permis", "identite", "domicile", "rib", "kbis", "assurance"];
        const labels: Record<string, string> = { permis: "Permis", identite: "CNI", domicile: "Domicile", rib: "RIB", kbis: "KBIS", assurance: "Assurance" };
        const issues: string[] = [];
        for (const r of required) {
          const d = (docs as Array<{ type_document: string; statut_validation?: string }> | null)?.find(x => x.type_document === r);
          if (!d) issues.push(`${labels[r]} manquant`);
          else if (d.statut_validation !== "approuve") issues.push(`${labels[r]} non approuvé`);
        }
        if (issues.length > 0) {
          window.alert(`Activation impossible — ce convoyeur indépendant doit avoir tous ses documents approuvés.\n\n• ${issues.join("\n• ")}`);
          return;
        }
      }
    }
    // Détecter le passage à "valide" pour notifier
    const previous = convoyeurs.find((c) => c.id === id) || (selected?.id === id ? selected : null);
    const wasNotValid = previous?.statut !== "valide";

    await supabase.from("convoyeurs").update({ statut }).eq("id", id);

    // Email auto si validation
    if (statut === "valide" && wasNotValid && previous) {
      try {
        await sendTransactionalEmail({
          templateName: "convoyeur-validation",
          recipientEmail: previous.email,
          idempotencyKey: `convoyeur-validation-${previous.id}`,
          templateData: { prenom: previous.prenom, nom: previous.nom },
        });
      } catch (err) {
        console.error("[admin.convoyeurs] envoi email validation échoué", err);
      }
    }

    fetchConvoyeurs();
    if (selected?.id === id) setSelected((prev) => prev ? { ...prev, statut } : null);
  };

  const createConvoyeur = async () => {
    if (!form.nom || !form.prenom || !form.email || !form.password) {
      setCreateError("Remplissez tous les champs obligatoires.");
      return;
    }
    setCreating(true);
    setCreateError("");
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      });
      if (authError || !authData.user) {
        setCreateError(authError?.message ?? "Erreur création compte");
        return;
      }
      const { error: convError } = await supabase.from("convoyeurs").insert({
        user_id: authData.user.id,
        nom: form.nom,
        prenom: form.prenom,
        email: form.email,
        telephone: form.telephone,
        statut: "valide",
      });
      if (convError) { setCreateError(convError.message); return; }
      const { error: roleError } = await supabase.from("user_roles").insert({
        user_id: authData.user.id,
        role: "convoyeur" as const,
      });
      if (roleError) { setCreateError(roleError.message); return; }
      setForm({ nom: "", prenom: "", email: "", telephone: "", password: "" });
      setShowCreate(false);
      fetchConvoyeurs();
    } finally {
      setCreating(false);
    }
  };

  const pendingCount = convoyeurs.filter(c => c.statut === "en_attente").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-heading text-2xl text-primary tracking-[0.1em] uppercase">Convoyeurs</h1>
          <p className="text-cream/50 text-sm mt-1">
            {convoyeurs.length} convoyeur{convoyeurs.length > 1 ? "s" : ""}
            {pendingCount > 0 && filterStatut === "all" && (
              <span className="ml-2 text-amber-400">· {pendingCount} en attente</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select value={filterStatut} onChange={(e) => setFilterStatut(e.target.value)}
            className="bg-navy/60 border border-primary/20 rounded px-3 py-2 text-cream text-sm focus:border-primary/60 focus:outline-none appearance-none">
            <option value="all">Tous</option>
            {statuts.map((s) => <option key={s} value={s}>{statutLabels[s]}</option>)}
          </select>
          <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-3 py-2 bg-primary/10 text-primary border border-primary/20 rounded text-sm hover:bg-primary/20 transition-colors">
            <UserPlus size={16} /> Ajouter
          </button>
          <button onClick={fetchConvoyeurs} className="p-2 text-cream/50 hover:text-primary transition-colors"><RefreshCw size={16} /></button>
        </div>
      </div>

      {convoyeurs.length === 0 ? (
        <div className="card-premium p-8 rounded text-center text-cream/40">Aucun convoyeur trouvé.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm card-premium rounded">
            <thead>
              <tr className="text-cream/50 text-xs uppercase tracking-wider border-b border-primary/10">
                <th className="text-left py-3 px-4">Convoyeur</th>
                <th className="text-left py-3 px-4 hidden sm:table-cell">Contact</th>
                <th className="text-left py-3 px-4 hidden md:table-cell">Type</th>
                <th className="text-left py-3 px-4 hidden md:table-cell">Ville</th>
                <th className="text-left py-3 px-4">Statut</th>
                <th className="text-left py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {convoyeurs.map((c) => (
                <tr key={c.id} className="border-b border-primary/5 text-cream/80 hover:bg-primary/5 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-medium">{c.prenom} {c.nom}</div>
                    <div className="text-cream/40 text-xs sm:hidden">{c.email}</div>
                  </td>
                  <td className="py-3 px-4 text-cream/60 hidden sm:table-cell">
                    <div>{c.email}</div>
                    {c.telephone && <div className="text-xs text-cream/40">{c.telephone}</div>}
                  </td>
                  <td className="py-3 px-4 text-cream/60 hidden md:table-cell">
                    <span className={`text-xs px-2 py-0.5 rounded border ${c.type_convoyeur === "independant" ? "bg-purple-500/20 text-purple-300 border-purple-500/30" : "bg-blue-500/20 text-blue-300 border-blue-500/30"}`}>
                      {c.type_convoyeur === "independant" ? "Indépendant" : "Salarié"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-cream/60 hidden md:table-cell">{c.ville || "—"}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs border ${statutColors[c.statut] ?? "bg-primary/10 text-primary border-primary/20"}`}>
                      {statutLabels[c.statut] ?? c.statut}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <button onClick={() => setSelected(c)} className="text-cream/50 hover:text-primary transition-colors"><Eye size={16} /></button>
                      {c.statut === "en_attente" && (
                        <>
                          <button onClick={() => updateStatut(c.id, "valide")} className="text-cream/50 hover:text-green-400 transition-colors" title="Valider"><CheckCircle size={16} /></button>
                          <button onClick={() => updateStatut(c.id, "refuse")} className="text-cream/50 hover:text-red-400 transition-colors" title="Refuser"><XCircle size={16} /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail modal — enriched */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setSelected(null)}>
          <div className="card-premium rounded-lg p-6 max-w-md w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-lg text-primary">{selected.prenom} {selected.nom}</h3>
              <button onClick={() => setSelected(null)} className="text-cream/50 hover:text-cream"><X size={18} /></button>
            </div>
            <div className="space-y-3 text-sm">
              <DetailRow label="Email" value={selected.email} />
              <DetailRow label="Téléphone" value={selected.telephone} />
              <DetailRow label="Ville" value={selected.ville} />
              <DetailRow label="Type" value={selected.type_convoyeur === "independant" ? "Indépendant" : "Salarié"} />
              <DetailRow label="Permis / Infos" value={selected.permis} />
              <DetailRow label="Disponibilité" value={selected.disponibilite ? (dispoLabels[selected.disponibilite] ?? selected.disponibilite) : null} />
              <DetailRow label="Message" value={selected.message} />
              <DetailRow label="Inscrit le" value={new Date(selected.created_at).toLocaleDateString("fr-FR")} />
            </div>
            {/* Type convoyeur selector */}
            <div className="mt-3 flex items-center gap-2">
              <span className="text-cream/40 text-xs uppercase tracking-wider">Type</span>
              <select
                value={selected.type_convoyeur}
                onChange={async (e) => {
                  const newType = e.target.value;
                  await supabase.from("convoyeurs").update({ type_convoyeur: newType } as any).eq("id", selected.id);
                  setSelected((prev) => prev ? { ...prev, type_convoyeur: newType } : null);
                  fetchConvoyeurs();
                }}
                className="bg-navy/60 border border-primary/20 rounded px-2 py-1 text-xs text-primary focus:outline-none appearance-none ml-auto"
              >
                <option value="salarie">Salarié</option>
                <option value="independant">Indépendant</option>
              </select>
            </div>
            <div className="mt-4 border-t border-primary/10 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-cream/40 text-xs uppercase tracking-wider">Statut</span>
                <select value={selected.statut} onChange={(e) => updateStatut(selected.id, e.target.value)}
                  className="bg-navy/60 border border-primary/20 rounded px-2 py-1 text-xs text-primary focus:outline-none appearance-none ml-auto">
                  {statuts.map((s) => <option key={s} value={s}>{statutLabels[s]}</option>)}
                </select>
              </div>
              {selected.statut === "en_attente" && (
                <div className="flex gap-2">
                  <button onClick={() => updateStatut(selected.id, "valide")}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-600/20 text-green-300 border border-green-500/30 rounded text-xs uppercase tracking-wider hover:bg-green-600/30 transition-colors">
                    <CheckCircle size={14} /> Approuver
                  </button>
                  <button onClick={() => updateStatut(selected.id, "refuse")}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600/20 text-red-300 border border-red-500/30 rounded text-xs uppercase tracking-wider hover:bg-red-600/30 transition-colors">
                    <XCircle size={14} /> Refuser
                  </button>
                </div>
              )}
            </div>

            {/* Historique missions */}
            <div className="mt-4 border-t border-primary/10 pt-4">
              <h4 className="text-cream/40 text-xs uppercase tracking-wider mb-2">
                Historique missions {historique.length > 0 && <span className="text-cream/30">({historique.length})</span>}
              </h4>
              {loadingHisto ? (
                <p className="text-cream/40 text-xs">Chargement…</p>
              ) : historique.length === 0 ? (
                <p className="text-cream/40 text-xs">Aucune mission attribuée.</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {historique.map((h) => (
                    <div key={h.id} className="flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded bg-card/40 border border-primary/10">
                      <div className="flex-1 min-w-0">
                        <div className="text-cream truncate">
                          {h.trajet ? `${h.trajet.depart} → ${h.trajet.arrivee}` : "Trajet supprimé"}
                        </div>
                        <div className="text-cream/40 text-[10px]">
                          {h.trajet?.date_trajet ? new Date(h.trajet.date_trajet).toLocaleDateString("fr-FR") : new Date(h.created_at).toLocaleDateString("fr-FR")}
                          {selected.type_convoyeur === "independant" && h.trajet?.tarif_convoyeur != null && ` · ${h.trajet.tarif_convoyeur} €`}
                        </div>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 shrink-0">
                        {h.statut}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setShowCreate(false)}>
          <div className="card-premium rounded-lg p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-lg text-primary">Nouveau convoyeur</h3>
              <button onClick={() => setShowCreate(false)} className="text-cream/50 hover:text-cream"><X size={18} /></button>
            </div>
            {createError && (
              <div className="p-3 rounded bg-destructive/20 border border-destructive/30 text-destructive text-sm mb-3">{createError}</div>
            )}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FormInput label="Prénom *" value={form.prenom} onChange={(v) => setForm({ ...form, prenom: v })} />
                <FormInput label="Nom *" value={form.nom} onChange={(v) => setForm({ ...form, nom: v })} />
              </div>
              <FormInput label="Email *" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" />
              <FormInput label="Téléphone" value={form.telephone} onChange={(v) => setForm({ ...form, telephone: v })} />
              <FormInput label="Mot de passe *" value={form.password} onChange={(v) => setForm({ ...form, password: v })} type="password" />
              <button onClick={createConvoyeur} disabled={creating}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground font-heading text-sm tracking-[0.1em] uppercase hover:bg-gold-light transition-colors disabled:opacity-50">
                <Plus size={16} /> {creating ? "Création..." : "Créer le convoyeur"}
              </button>
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
