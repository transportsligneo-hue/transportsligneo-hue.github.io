import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Trash2, Star, StarOff, ToggleLeft, ToggleRight, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { confirmToast } from "@/lib/confirm-toast";

export interface FavoriteAddressRow {
  id: string;
  client_user_id: string | null;
  client_email: string;
  label: string;
  address: string;
  ville: string | null;
  code_postal: string | null;
  pays: string | null;
  address_type: "depart" | "arrivee" | "both";
  contact_nom: string | null;
  contact_tel: string | null;
  contact_email: string | null;
  notes_acces: string | null;
  is_default: boolean;
  active: boolean;
}

interface Props {
  clientUserId: string;
  clientEmail: string;
  /** Optional: render compactly (e.g. inside the client dashboard). */
  variant?: "admin" | "client";
}

interface FormState {
  label: string;
  address: string;
  ville: string;
  code_postal: string;
  pays: string;
  address_type: "depart" | "arrivee" | "both";
  contact_nom: string;
  contact_tel: string;
  contact_email: string;
  notes_acces: string;
  is_default: boolean;
}

const EMPTY: FormState = {
  label: "",
  address: "",
  ville: "",
  code_postal: "",
  pays: "France",
  address_type: "depart",
  contact_nom: "",
  contact_tel: "",
  contact_email: "",
  notes_acces: "",
  is_default: false,
};

const TYPE_LABEL: Record<FavoriteAddressRow["address_type"], string> = {
  depart: "Départ",
  arrivee: "Arrivée",
  both: "Les deux",
};

export function FavoriteAddressesManager({ clientUserId, clientEmail, variant = "admin" }: Props) {
  const [items, setItems] = useState<FavoriteAddressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "depart" | "arrivee">("all");

  const emailLower = clientEmail.toLowerCase();

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("client_default_addresses" as never)
      .select("*")
      .or(`client_user_id.eq.${clientUserId},client_email.eq.${emailLower}`)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    setItems((data as unknown as FavoriteAddressRow[]) ?? []);
    setLoading(false);
  }, [clientUserId, emailLower]);

  useEffect(() => { void load(); }, [load]);

  const resetForm = () => {
    setForm(EMPTY);
    setCreating(false);
    setEditingId(null);
  };

  const startEdit = (a: FavoriteAddressRow) => {
    setEditingId(a.id);
    setCreating(true);
    setForm({
      label: a.label,
      address: a.address,
      ville: a.ville ?? "",
      code_postal: a.code_postal ?? "",
      pays: a.pays ?? "France",
      address_type: a.address_type,
      contact_nom: a.contact_nom ?? "",
      contact_tel: a.contact_tel ?? "",
      contact_email: a.contact_email ?? "",
      notes_acces: a.notes_acces ?? "",
      is_default: a.is_default,
    });
  };

  const submit = async () => {
    if (!form.label.trim() || !form.address.trim()) {
      toast.error("Libellé et adresse requis");
      return;
    }
    setSaving(true);

    // If marking as default, clear other defaults of the SAME address_type for this client
    if (form.is_default) {
      await supabase.from("client_default_addresses" as never)
        .update({ is_default: false } as never)
        .or(`client_user_id.eq.${clientUserId},client_email.eq.${emailLower}`)
        .in("address_type", form.address_type === "both" ? ["depart", "arrivee", "both"] : [form.address_type, "both"]);
    }

    const payload = {
      client_user_id: clientUserId,
      client_email: emailLower,
      label: form.label.trim(),
      address: form.address.trim(),
      ville: form.ville.trim() || null,
      code_postal: form.code_postal.trim() || null,
      pays: form.pays.trim() || "France",
      address_type: form.address_type,
      contact_nom: form.contact_nom.trim() || null,
      contact_tel: form.contact_tel.trim() || null,
      contact_email: form.contact_email.trim() || null,
      notes_acces: form.notes_acces.trim() || null,
      is_default: form.is_default,
      active: true,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from("client_default_addresses" as never)
        .update(payload as never).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("client_default_addresses" as never).insert(payload as never));
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editingId ? "Adresse mise à jour" : "Adresse ajoutée");
    resetForm();
    load();
  };

  const toggleDefault = async (a: FavoriteAddressRow) => {
    if (!a.is_default) {
      await supabase.from("client_default_addresses" as never)
        .update({ is_default: false } as never)
        .or(`client_user_id.eq.${clientUserId},client_email.eq.${emailLower}`)
        .in("address_type", a.address_type === "both" ? ["depart", "arrivee", "both"] : [a.address_type, "both"]);
    }
    await supabase.from("client_default_addresses" as never)
      .update({ is_default: !a.is_default } as never).eq("id", a.id);
    load();
  };

  const toggleActive = async (a: FavoriteAddressRow) => {
    await supabase.from("client_default_addresses" as never)
      .update({ active: !a.active } as never).eq("id", a.id);
    load();
  };

  const remove = async (a: FavoriteAddressRow) => {
    if (!(await confirmToast("Supprimer cette adresse ?"))) return;
    await supabase.from("client_default_addresses" as never).delete().eq("id", a.id);
    load();
  };

  const inp = variant === "admin"
    ? "w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--admin-accent)]/30"
    : "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30";
  const primaryBtn = variant === "admin" ? "admin-btn-primary" : "inline-flex items-center gap-1.5 rounded-lg bg-[#0b1026] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0b1026]/90";
  const ghostBtn = variant === "admin" ? "admin-btn-ghost" : "inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50";

  const filteredItems = items.filter(a => {
    if (filter === "all") return true;
    return a.address_type === filter || a.address_type === "both";
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {(["all", "depart", "arrivee"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 text-xs rounded-md transition ${filter === f ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {f === "all" ? "Toutes" : f === "depart" ? "Départ" : "Arrivée"}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-500">{filteredItems.length} adresse{filteredItems.length > 1 ? "s" : ""}</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="animate-spin text-slate-400" size={20} /></div>
      ) : filteredItems.length === 0 ? (
        <p className="text-sm text-slate-500 italic py-4">Aucune adresse enregistrée pour ce filtre.</p>
      ) : (
        <div className="space-y-2">
          {filteredItems.map(a => (
            <div key={a.id} className={`rounded-lg border p-3 ${a.is_default ? "border-amber-300 bg-amber-50/40" : "border-slate-200 bg-white"} ${!a.active ? "opacity-50" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{a.label}</span>
                    <span className="text-[10px] uppercase tracking-wide bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">{TYPE_LABEL[a.address_type]}</span>
                    {a.is_default && <span className="text-[10px] uppercase tracking-wide bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded">Défaut</span>}
                    {!a.active && <span className="text-[10px] uppercase tracking-wide bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">Désactivé</span>}
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    {a.address}{a.code_postal || a.ville ? `, ${[a.code_postal, a.ville].filter(Boolean).join(" ")}` : ""}{a.pays && a.pays !== "France" ? `, ${a.pays}` : ""}
                  </p>
                  {(a.contact_nom || a.contact_tel || a.contact_email) && (
                    <p className="text-xs text-slate-500 mt-1">{[a.contact_nom, a.contact_tel, a.contact_email].filter(Boolean).join(" · ")}</p>
                  )}
                  {a.notes_acces && <p className="text-xs text-slate-500 italic mt-1">{a.notes_acces}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => toggleDefault(a)} className={ghostBtn} title={a.is_default ? "Retirer le défaut" : "Définir par défaut"}>
                    {a.is_default ? <Star size={14} className="fill-amber-500 text-amber-500" /> : <StarOff size={14} />}
                  </button>
                  <button onClick={() => startEdit(a)} className={ghostBtn} title="Modifier">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => toggleActive(a)} className={ghostBtn} title={a.active ? "Désactiver" : "Activer"}>
                    {a.active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                  </button>
                  <button onClick={() => remove(a)} className={`${ghostBtn} !text-red-600`} title="Supprimer">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!creating ? (
        <button onClick={() => { setCreating(true); setEditingId(null); setForm(EMPTY); }} className={`${primaryBtn} inline-flex items-center gap-1.5 mt-2`}>
          <Plus size={14} /> Ajouter une adresse
        </button>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">{editingId ? "Modifier l'adresse" : "Nouvelle adresse"}</p>
            <button onClick={resetForm} className={ghostBtn} title="Fermer"><X size={14} /></button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Libellé *</label>
              <input className={inp} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="ex: Agence Tours" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Type d'adresse *</label>
              <select className={inp} value={form.address_type} onChange={(e) => setForm({ ...form, address_type: e.target.value as FormState["address_type"] })}>
                <option value="depart">Départ</option>
                <option value="arrivee">Arrivée</option>
                <option value="both">Les deux</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Adresse complète *</label>
            <input className={inp} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="14 rue Nationale" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Code postal</label>
              <input className={inp} value={form.code_postal} onChange={(e) => setForm({ ...form, code_postal: e.target.value })} placeholder="37000" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Ville</label>
              <input className={inp} value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} placeholder="Tours" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Pays</label>
              <input className={inp} value={form.pays} onChange={(e) => setForm({ ...form, pays: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Contact sur place</label>
              <input className={inp} value={form.contact_nom} onChange={(e) => setForm({ ...form, contact_nom: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Téléphone</label>
              <input className={inp} value={form.contact_tel} onChange={(e) => setForm({ ...form, contact_tel: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
              <input type="email" className={inp} value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes d'accès (parking, badge, horaires…)</label>
            <input className={inp} value={form.notes_acces} onChange={(e) => setForm({ ...form, notes_acces: e.target.value })} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />
            Définir comme adresse par défaut pour ce type
          </label>

          <div className="flex gap-2">
            <button onClick={submit} disabled={saving} className={`${primaryBtn} inline-flex items-center gap-1.5`}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {editingId ? "Mettre à jour" : "Enregistrer"}
            </button>
            <button onClick={resetForm} className={ghostBtn}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}
