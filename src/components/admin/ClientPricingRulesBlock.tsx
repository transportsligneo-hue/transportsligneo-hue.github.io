import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, ToggleLeft, ToggleRight, Pencil, X } from "lucide-react";
import { AdminSection, AdminField, AdminEmpty } from "@/components/admin/ui";


interface Rule {
  id: string;
  client_email: string;
  client_user_id: string | null;
  ville_depart: string | null;
  ville_arrivee: string | null;
  departement_depart: string | null;
  departement_arrivee: string | null;
  zone_label: string | null;
  trip_type: "aller" | "aller_retour" | "any";
  prix_ttc: number;
  prix_ht: number | null;
  prix_aller_simple: number | null;
  prix_aller_retour: number | null;
  prix_express: number | null;
  supplements: Record<string, number> | null;
  active: boolean;
  notes: string | null;
  created_at: string;
}

interface Props {
  clientUserId: string;
  clientEmail: string;
}

const EMPTY_FORM = {
  zone_label: "",
  ville_depart: "",
  departement_depart: "",
  ville_arrivee: "",
  departement_arrivee: "",
  prix_aller_simple: "",
  prix_aller_retour: "",
  prix_express: "",
  sup_recharge: "",
  sup_plein: "",
  sup_nettoyage: "",
  sup_express: "",
  notes: "",
};

export function ClientPricingRulesBlock({ clientUserId, clientEmail }: Props) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const emailLower = clientEmail.toLowerCase();
    const { data } = await supabase
      .from("client_pricing_rules" as never)
      .select("*")
      .or(`client_user_id.eq.${clientUserId},client_email.eq.${emailLower}`)
      .order("created_at", { ascending: false });
    setRules((data as unknown as Rule[]) ?? []);
    setLoading(false);
  }, [clientUserId, clientEmail]);

  useEffect(() => { void load(); }, [load]);

  const parseNum = (s: string): number | null => {
    const v = parseFloat(s);
    return isFinite(v) && v >= 0 ? v : null;
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setCreating(false);
    setEditingId(null);
  };

  const startEdit = (r: Rule) => {
    setEditingId(r.id);
    setCreating(true);
    setForm({
      zone_label: r.zone_label ?? "",
      ville_depart: r.ville_depart ?? "",
      departement_depart: r.departement_depart ?? "",
      ville_arrivee: r.ville_arrivee ?? "",
      departement_arrivee: r.departement_arrivee ?? "",
      prix_aller_simple: r.prix_aller_simple != null ? String(r.prix_aller_simple) : "",
      prix_aller_retour: r.prix_aller_retour != null ? String(r.prix_aller_retour) : "",
      prix_express: r.prix_express != null ? String(r.prix_express) : "",
      sup_recharge: r.supplements?.recharge_electrique != null ? String(r.supplements.recharge_electrique) : "",
      sup_plein: r.supplements?.plein_essence != null ? String(r.supplements.plein_essence) : "",
      sup_nettoyage: r.supplements?.nettoyage != null ? String(r.supplements.nettoyage) : "",
      sup_express: r.supplements?.express != null ? String(r.supplements.express) : "",
      notes: r.notes ?? "",
    });
  };

  const submit = async () => {
    const pas = parseNum(form.prix_aller_simple);
    const par = parseNum(form.prix_aller_retour);
    const pex = parseNum(form.prix_express);
    if (pas == null && par == null && pex == null) {
      toast.error("Renseignez au moins un prix (aller simple, retour ou express)");
      return;
    }
    setSaving(true);

    const supplements: Record<string, number> = {};
    const sr = parseNum(form.sup_recharge); if (sr != null && sr > 0) supplements.recharge_electrique = sr;
    const sp = parseNum(form.sup_plein); if (sp != null && sp > 0) supplements.plein_essence = sp;
    const sn = parseNum(form.sup_nettoyage); if (sn != null && sn > 0) supplements.nettoyage = sn;
    const se = parseNum(form.sup_express); if (se != null && se > 0) supplements.express = se;

    const basePrice = pas ?? par ?? pex ?? 0;

    const normDept = (s: string) => {
      const t = s.trim().toUpperCase();
      if (!t) return null;
      if (/^\d{1}$/.test(t)) return "0" + t;
      return t;
    };
    const payload = {
      client_user_id: clientUserId,
      client_email: clientEmail.toLowerCase(),
      zone_label: form.zone_label.trim() || null,
      ville_depart: form.ville_depart.trim() || null,
      ville_arrivee: form.ville_arrivee.trim() || null,
      departement_depart: normDept(form.departement_depart),
      departement_arrivee: normDept(form.departement_arrivee),
      trip_type: "any" as const,
      prix_aller_simple: pas,
      prix_aller_retour: par,
      prix_express: pex,
      supplements,
      prix_ttc: basePrice,
      prix_ht: Math.round((basePrice / 1.2) * 100) / 100,
      notes: form.notes.trim() || null,
      active: true,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from("client_pricing_rules" as never)
        .update(payload as never).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("client_pricing_rules" as never).insert(payload as never));
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editingId ? "Tarif mis à jour" : "Tarif personnalisé créé");
    resetForm();
    load();
  };


  const toggleActive = async (r: Rule) => {
    await supabase.from("client_pricing_rules" as never)
      .update({ active: !r.active } as never).eq("id", r.id);
    load();
  };

  const remove = async (r: Rule) => {
    if (!(await confirmToast("Supprimer ce tarif personnalisé ?"))) return;
    await supabase.from("client_pricing_rules" as never).delete().eq("id", r.id);
    load();
  };

  const inp = "w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--admin-accent)]/30";
  const supplementsList = (sup: Record<string, number> | null) => {
    if (!sup) return null;
    const entries = Object.entries(sup).filter(([, v]) => Number(v) > 0);
    if (entries.length === 0) return null;
    const labels: Record<string, string> = {
      recharge_electrique: "Recharge",
      plein_essence: "Plein",
      nettoyage: "Nettoyage",
      express: "Express",
    };
    return entries.map(([k, v]) => `${labels[k] ?? k} +${v}€`).join(" · ");
  };

  return (
    <AdminSection
      title="Tarifs personnalisés"
      description="Prix par trajet (aller simple / retour / express) + suppléments options. Appliqués automatiquement dans le formulaire « Nouvelle mission » du client."
    >
      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="animate-spin text-slate-400" size={20} /></div>
        ) : rules.length === 0 ? (
          <AdminEmpty title="Aucun tarif personnalisé" description="Le calcul standard s'applique pour ce client." />
        ) : (
          <div className="space-y-2">
            {rules.map(r => (
              <div key={r.id} className={`rounded-lg border border-slate-200 p-3 bg-white ${!r.active ? "opacity-50" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">
                      {r.zone_label || [
                        r.ville_depart || (r.departement_depart ? `Dépt ${r.departement_depart}` : null),
                        r.ville_arrivee || (r.departement_arrivee ? `Dépt ${r.departement_arrivee}` : null),
                      ].filter(Boolean).join(" → ") || "Toutes zones"}
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600 mt-1">
                      {r.prix_aller_simple != null && <span><b>Aller :</b> {Number(r.prix_aller_simple).toFixed(2)} €</span>}
                      {r.prix_aller_retour != null && <span><b>A/R :</b> {Number(r.prix_aller_retour).toFixed(2)} €</span>}
                      {r.prix_express != null && <span><b>Express :</b> {Number(r.prix_express).toFixed(2)} €</span>}
                      {r.prix_aller_simple == null && r.prix_aller_retour == null && r.prix_express == null && r.prix_ttc > 0 && (
                        <span><b>Prix :</b> {Number(r.prix_ttc).toFixed(2)} €</span>
                      )}
                    </div>
                    {supplementsList(r.supplements) && (
                      <p className="text-xs text-emerald-700 mt-1">{supplementsList(r.supplements)}</p>
                    )}
                    {r.notes && <p className="text-xs text-slate-500 italic mt-1">{r.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => startEdit(r)} className="admin-btn-ghost" title="Modifier">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => toggleActive(r)} className="admin-btn-ghost" title={r.active ? "Désactiver" : "Activer"}>
                      {r.active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                    </button>
                    <button onClick={() => remove(r)} className="admin-btn-ghost !text-red-600" title="Supprimer">
                      <Trash2 size={14} />
                    </button>
                  </div>

                </div>
              </div>
            ))}
          </div>
        )}

        {!creating ? (
          <button onClick={() => { setCreating(true); setEditingId(null); setForm(EMPTY_FORM); }} className="admin-btn-primary inline-flex items-center gap-1.5 mt-2">
            <Plus size={14} /> Ajouter un tarif
          </button>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">{editingId ? "Modifier le tarif" : "Nouveau tarif"}</p>
              <button onClick={resetForm} className="admin-btn-ghost" title="Fermer"><X size={14} /></button>
            </div>
            <AdminField label="Libellé zone (ex: Tours, Le Mans)">
              <input className={inp} value={form.zone_label} onChange={(e) => setForm({ ...form, zone_label: e.target.value })} placeholder="Tours" />
            </AdminField>

            <div className="grid grid-cols-2 gap-3">
              <AdminField label="Ville départ (optionnel)">
                <input className={inp} value={form.ville_depart} onChange={(e) => setForm({ ...form, ville_depart: e.target.value })} placeholder="ex: Tours" />
              </AdminField>
              <AdminField label="Ville arrivée (optionnel)">
                <input className={inp} value={form.ville_arrivee} onChange={(e) => setForm({ ...form, ville_arrivee: e.target.value })} placeholder="ex: Blois" />
              </AdminField>
              <AdminField label="Département départ (ex: 37)">
                <input className={inp} value={form.departement_depart} onChange={(e) => setForm({ ...form, departement_depart: e.target.value })} placeholder="ex: 37" maxLength={3} />
              </AdminField>
              <AdminField label="Département arrivée (ex: 41, 72, 2A)">
                <input className={inp} value={form.departement_arrivee} onChange={(e) => setForm({ ...form, departement_arrivee: e.target.value })} placeholder="ex: 41" maxLength={3} />
              </AdminField>
            </div>
            <p className="text-xs text-slate-500 -mt-1">
              Remplis ville <b>OU</b> département (ou les deux). Les 4 combinaisons sont supportées : ville→ville, ville→département, département→ville, département→département. Détection automatique du département depuis le code postal de l'adresse client.
            </p>
            <div className="grid grid-cols-3 gap-3">
              <AdminField label="Prix aller simple (€)">
                <input type="number" step="0.01" className={inp} value={form.prix_aller_simple} onChange={(e) => setForm({ ...form, prix_aller_simple: e.target.value })} placeholder="70" />
              </AdminField>
              <AdminField label="Prix aller-retour (€)">
                <input type="number" step="0.01" className={inp} value={form.prix_aller_retour} onChange={(e) => setForm({ ...form, prix_aller_retour: e.target.value })} placeholder="120" />
              </AdminField>
              <AdminField label="Prix express (€)">
                <input type="number" step="0.01" className={inp} value={form.prix_express} onChange={(e) => setForm({ ...form, prix_express: e.target.value })} placeholder="optionnel" />
              </AdminField>
            </div>

            <div className="pt-2 border-t border-slate-200">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Suppléments options (€, optionnels)</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <AdminField label="Recharge électrique">
                  <input type="number" step="0.01" className={inp} value={form.sup_recharge} onChange={(e) => setForm({ ...form, sup_recharge: e.target.value })} placeholder="15" />
                </AdminField>
                <AdminField label="Plein d'essence">
                  <input type="number" step="0.01" className={inp} value={form.sup_plein} onChange={(e) => setForm({ ...form, sup_plein: e.target.value })} placeholder="10" />
                </AdminField>
                <AdminField label="Nettoyage">
                  <input type="number" step="0.01" className={inp} value={form.sup_nettoyage} onChange={(e) => setForm({ ...form, sup_nettoyage: e.target.value })} placeholder="25" />
                </AdminField>
                <AdminField label="Express">
                  <input type="number" step="0.01" className={inp} value={form.sup_express} onChange={(e) => setForm({ ...form, sup_express: e.target.value })} placeholder="50" />
                </AdminField>
              </div>
            </div>

            <AdminField label="Notes internes (optionnel)">
              <input className={inp} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </AdminField>
            <div className="flex gap-2">
              <button onClick={submit} disabled={saving} className="admin-btn-primary inline-flex items-center gap-1.5">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {editingId ? "Mettre à jour" : "Enregistrer"}
              </button>
              <button onClick={resetForm} className="admin-btn-ghost">Annuler</button>
            </div>

          </div>
        )}
      </div>
    </AdminSection>
  );
}
