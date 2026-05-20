import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { AdminSection, AdminField, AdminEmpty } from "@/components/admin/ui";

interface Rule {
  id: string;
  client_email: string;
  client_user_id: string | null;
  ville_depart: string | null;
  ville_arrivee: string | null;
  zone_label: string | null;
  trip_type: "aller" | "aller_retour" | "any";
  prix_ttc: number;
  prix_ht: number | null;
  active: boolean;
  notes: string | null;
  created_at: string;
}

interface Props {
  clientUserId: string;
  clientEmail: string;
}

const TRIP_LABELS: Record<Rule["trip_type"], string> = {
  aller: "Aller simple",
  aller_retour: "Aller-retour",
  any: "Tous trajets",
};

const EMPTY_FORM = {
  ville_depart: "",
  ville_arrivee: "",
  zone_label: "",
  trip_type: "aller" as Rule["trip_type"],
  prix_ttc: "",
  notes: "",
};

export function ClientPricingRulesBlock({ clientUserId, clientEmail }: Props) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
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

  const submit = async () => {
    const prix = parseFloat(form.prix_ttc);
    if (!isFinite(prix) || prix <= 0) {
      toast.error("Saisissez un prix TTC valide");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("client_pricing_rules" as never).insert({
      client_user_id: clientUserId,
      client_email: clientEmail.toLowerCase(),
      ville_depart: form.ville_depart.trim() || null,
      ville_arrivee: form.ville_arrivee.trim() || null,
      zone_label: form.zone_label.trim() || null,
      trip_type: form.trip_type,
      prix_ttc: prix,
      prix_ht: Math.round((prix / 1.2) * 100) / 100,
      notes: form.notes.trim() || null,
      active: true,
    } as never);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Tarif personnalisé créé");
    setForm(EMPTY_FORM);
    setCreating(false);
    load();
  };

  const toggleActive = async (r: Rule) => {
    await supabase.from("client_pricing_rules" as never)
      .update({ active: !r.active } as never).eq("id", r.id);
    load();
  };

  const remove = async (r: Rule) => {
    if (!window.confirm("Supprimer ce tarif personnalisé ?")) return;
    await supabase.from("client_pricing_rules" as never).delete().eq("id", r.id);
    load();
  };

  const inp = "w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--admin-accent)]/30";

  return (
    <AdminSection
      title="Tarifs personnalisés"
      description="Prix fixes appliqués automatiquement aux devis de ce client."
    >
      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="animate-spin text-slate-400" size={20} /></div>
        ) : rules.length === 0 ? (
          <AdminEmpty title="Aucun tarif personnalisé" description="Le calcul standard s'applique pour ce client." />
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table text-sm">
              <thead>
                <tr>
                  <th>Départ</th>
                  <th>Arrivée</th>
                  <th>Type</th>
                  <th>Prix TTC</th>
                  <th>État</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rules.map(r => (
                  <tr key={r.id} className={r.active ? "" : "opacity-50"}>
                    <td>{r.ville_depart || <span className="text-slate-400">— toutes —</span>}</td>
                    <td>{r.ville_arrivee || <span className="text-slate-400">— toutes —</span>}</td>
                    <td>{TRIP_LABELS[r.trip_type]}</td>
                    <td className="font-semibold">{Number(r.prix_ttc).toFixed(2)} €</td>
                    <td>{r.active ? "Actif" : "Désactivé"}</td>
                    <td className="text-right whitespace-nowrap">
                      <button onClick={() => toggleActive(r)} className="admin-btn-ghost inline-flex items-center gap-1 mr-1" title={r.active ? "Désactiver" : "Activer"}>
                        {r.active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                      </button>
                      <button onClick={() => remove(r)} className="admin-btn-ghost inline-flex items-center gap-1 !text-red-600" title="Supprimer">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!creating ? (
          <button onClick={() => setCreating(true)} className="admin-btn-primary inline-flex items-center gap-1.5 mt-2">
            <Plus size={14} /> Ajouter un tarif
          </button>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <AdminField label="Ville de départ (vide = toutes)">
                <input className={inp} value={form.ville_depart}
                  onChange={(e) => setForm({ ...form, ville_depart: e.target.value })}
                  placeholder="ex: Tours" />
              </AdminField>
              <AdminField label="Ville d'arrivée (vide = toutes)">
                <input className={inp} value={form.ville_arrivee}
                  onChange={(e) => setForm({ ...form, ville_arrivee: e.target.value })}
                  placeholder="ex: Le Mans" />
              </AdminField>
              <AdminField label="Type de trajet">
                <select className={inp} value={form.trip_type}
                  onChange={(e) => setForm({ ...form, trip_type: e.target.value as Rule["trip_type"] })}>
                  <option value="aller">Aller simple</option>
                  <option value="aller_retour">Aller-retour</option>
                  <option value="any">Tous</option>
                </select>
              </AdminField>
              <AdminField label="Prix TTC (€)">
                <input type="number" step="0.01" className={inp} value={form.prix_ttc}
                  onChange={(e) => setForm({ ...form, prix_ttc: e.target.value })}
                  placeholder="ex: 70" />
              </AdminField>
            </div>
            <AdminField label="Notes (optionnel)">
              <input className={inp} value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </AdminField>
            <div className="flex gap-2">
              <button onClick={submit} disabled={saving} className="admin-btn-primary inline-flex items-center gap-1.5">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Enregistrer
              </button>
              <button onClick={() => { setCreating(false); setForm(EMPTY_FORM); }} className="admin-btn-ghost">Annuler</button>
            </div>
          </div>
        )}
      </div>
    </AdminSection>
  );
}
