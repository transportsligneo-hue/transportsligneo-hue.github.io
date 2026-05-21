import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Star, StarOff, ToggleLeft, ToggleRight } from "lucide-react";
import { AdminSection, AdminField, AdminEmpty } from "@/components/admin/ui";

interface Address {
  id: string;
  client_user_id: string | null;
  client_email: string;
  label: string;
  address: string;
  contact_nom: string | null;
  contact_tel: string | null;
  notes_acces: string | null;
  is_default: boolean;
  active: boolean;
}

interface Props {
  clientUserId: string;
  clientEmail: string;
}

const EMPTY = {
  label: "",
  address: "",
  contact_nom: "",
  contact_tel: "",
  notes_acces: "",
  is_default: false,
};

export function ClientDefaultAddressesBlock({ clientUserId, clientEmail }: Props) {
  const [items, setItems] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const emailLower = clientEmail.toLowerCase();
    const { data } = await supabase
      .from("client_default_addresses" as never)
      .select("*")
      .or(`client_user_id.eq.${clientUserId},client_email.eq.${emailLower}`)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    setItems((data as unknown as Address[]) ?? []);
    setLoading(false);
  }, [clientUserId, clientEmail]);

  useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    if (!form.label.trim() || !form.address.trim()) {
      toast.error("Libellé et adresse requis");
      return;
    }
    setSaving(true);

    // If marking as default, unset others
    if (form.is_default) {
      await supabase.from("client_default_addresses" as never)
        .update({ is_default: false } as never)
        .or(`client_user_id.eq.${clientUserId},client_email.eq.${clientEmail.toLowerCase()}`);
    }

    const { error } = await supabase.from("client_default_addresses" as never).insert({
      client_user_id: clientUserId,
      client_email: clientEmail.toLowerCase(),
      label: form.label.trim(),
      address: form.address.trim(),
      contact_nom: form.contact_nom.trim() || null,
      contact_tel: form.contact_tel.trim() || null,
      notes_acces: form.notes_acces.trim() || null,
      is_default: form.is_default,
      active: true,
    } as never);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Adresse ajoutée");
    setForm(EMPTY);
    setCreating(false);
    load();
  };

  const toggleDefault = async (a: Address) => {
    if (!a.is_default) {
      await supabase.from("client_default_addresses" as never)
        .update({ is_default: false } as never)
        .or(`client_user_id.eq.${clientUserId},client_email.eq.${clientEmail.toLowerCase()}`);
    }
    await supabase.from("client_default_addresses" as never)
      .update({ is_default: !a.is_default } as never).eq("id", a.id);
    load();
  };

  const toggleActive = async (a: Address) => {
    await supabase.from("client_default_addresses" as never)
      .update({ active: !a.active } as never).eq("id", a.id);
    load();
  };

  const remove = async (a: Address) => {
    if (!window.confirm("Supprimer cette adresse ?")) return;
    await supabase.from("client_default_addresses" as never).delete().eq("id", a.id);
    load();
  };

  const inp = "w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--admin-accent)]/30";

  return (
    <AdminSection
      title="Adresses de départ favorites"
      description="Sites/agences récurrents proposés au client dans son formulaire de nouvelle mission."
    >
      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="animate-spin text-slate-400" size={20} /></div>
        ) : items.length === 0 ? (
          <AdminEmpty title="Aucune adresse favorite" description="Ajoutez les sites de départ récurrents du client." />
        ) : (
          <div className="space-y-2">
            {items.map(a => (
              <div key={a.id} className={`rounded-lg border p-3 ${a.is_default ? "border-amber-300 bg-amber-50/50" : "border-slate-200 bg-white"} ${!a.active ? "opacity-50" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{a.label}</span>
                      {a.is_default && <span className="text-[10px] uppercase tracking-wide bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded">Défaut</span>}
                      {!a.active && <span className="text-[10px] uppercase tracking-wide bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">Désactivé</span>}
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{a.address}</p>
                    {(a.contact_nom || a.contact_tel) && (
                      <p className="text-xs text-slate-500 mt-1">{[a.contact_nom, a.contact_tel].filter(Boolean).join(" · ")}</p>
                    )}
                    {a.notes_acces && <p className="text-xs text-slate-500 italic mt-1">{a.notes_acces}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggleDefault(a)} className="admin-btn-ghost" title={a.is_default ? "Retirer le défaut" : "Définir par défaut"}>
                      {a.is_default ? <Star size={14} className="fill-amber-500 text-amber-500" /> : <StarOff size={14} />}
                    </button>
                    <button onClick={() => toggleActive(a)} className="admin-btn-ghost" title={a.active ? "Désactiver" : "Activer"}>
                      {a.active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                    </button>
                    <button onClick={() => remove(a)} className="admin-btn-ghost !text-red-600" title="Supprimer">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!creating ? (
          <button onClick={() => setCreating(true)} className="admin-btn-primary inline-flex items-center gap-1.5 mt-2">
            <Plus size={14} /> Ajouter une adresse favorite
          </button>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
            <AdminField label="Libellé">
              <input className={inp} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="ex: Agence Tours" />
            </AdminField>
            <AdminField label="Adresse complète">
              <input className={inp} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="14 rue Nationale, 37000 Tours" />
            </AdminField>
            <div className="grid grid-cols-2 gap-3">
              <AdminField label="Contact sur place">
                <input className={inp} value={form.contact_nom} onChange={(e) => setForm({ ...form, contact_nom: e.target.value })} />
              </AdminField>
              <AdminField label="Téléphone">
                <input className={inp} value={form.contact_tel} onChange={(e) => setForm({ ...form, contact_tel: e.target.value })} />
              </AdminField>
            </div>
            <AdminField label="Notes d'accès (parking, badge, horaires…)">
              <input className={inp} value={form.notes_acces} onChange={(e) => setForm({ ...form, notes_acces: e.target.value })} />
            </AdminField>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />
              Définir comme adresse par défaut
            </label>
            <div className="flex gap-2">
              <button onClick={submit} disabled={saving} className="admin-btn-primary inline-flex items-center gap-1.5">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Enregistrer
              </button>
              <button onClick={() => { setCreating(false); setForm(EMPTY); }} className="admin-btn-ghost">Annuler</button>
            </div>
          </div>
        )}
      </div>
    </AdminSection>
  );
}
