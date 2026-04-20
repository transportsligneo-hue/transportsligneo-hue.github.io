import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Save, Loader2, CheckCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard-pro/societe")({
  component: ProSociete,
});

function ProSociete() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    societe: "", siret: "", prenom: "", nom: "", telephone: "", email: "",
  });

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("societe, siret, prenom, nom, telephone, email" as never)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const row = data as Partial<typeof form> | null;
        if (row) {
          setForm({
            societe: row.societe ?? "",
            siret: row.siret ?? "",
            prenom: row.prenom ?? "",
            nom: row.nom ?? "",
            telephone: row.telephone ?? "",
            email: row.email ?? user.email ?? "",
          });
        }
        setLoading(false);
      });
  }, [user]);

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setSaved(false);
    await supabase
      .from("profiles")
      .update({
        societe: form.societe,
        siret: form.siret,
        prenom: form.prenom,
        nom: form.nom,
        telephone: form.telephone,
      } as never)
      .eq("user_id", user.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-pro-accent" size={28} /></div>;
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-pro-text">Ma société</h1>
        <p className="text-pro-muted text-sm mt-0.5">Informations de facturation et de contact</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-pro-border p-6 space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-pro-border">
          <div className="w-10 h-10 rounded-lg bg-pro-accent/10 text-pro-accent flex items-center justify-center">
            <Building2 size={18} />
          </div>
          <div>
            <p className="font-semibold text-pro-text">Identité de l'entreprise</p>
            <p className="text-pro-muted text-xs">Visible sur vos factures</p>
          </div>
        </div>

        <Field label="Raison sociale" required>
          <input value={form.societe} onChange={update("societe")} required className={inputCls} />
        </Field>

        <Field label="SIRET">
          <input value={form.siret} onChange={update("siret")} placeholder="14 chiffres" className={inputCls} />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Prénom contact">
            <input value={form.prenom} onChange={update("prenom")} className={inputCls} />
          </Field>
          <Field label="Nom contact">
            <input value={form.nom} onChange={update("nom")} className={inputCls} />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Téléphone">
            <input value={form.telephone} onChange={update("telephone")} type="tel" className={inputCls} />
          </Field>
          <Field label="Email">
            <input value={form.email} disabled className={`${inputCls} opacity-60 cursor-not-allowed`} />
          </Field>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-pro-accent text-white text-sm font-medium hover:bg-pro-accent-hover disabled:opacity-60 shadow-sm"
          >
            {saving ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />}
            Enregistrer
          </button>
          {saved && (
            <span className="inline-flex items-center gap-1.5 text-emerald-600 text-sm">
              <CheckCircle size={15} /> Modifications enregistrées
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2 text-sm bg-white border border-pro-border focus:border-pro-accent focus:ring-2 focus:ring-pro-accent/20 rounded-md outline-none transition-colors text-pro-text";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-pro-text-soft uppercase tracking-wide mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}
