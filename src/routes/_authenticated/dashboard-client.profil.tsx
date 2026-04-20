import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { User, Mail, Phone, Lock, Loader2, CheckCircle, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard-client/profil")({
  component: ClientProfil,
});

function ClientProfil() {
  const { user } = useAuth();
  const [form, setForm] = useState({ prenom: "", nom: "", email: "", telephone: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("prenom, nom, email, telephone")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) {
          setForm({
            prenom: data.prenom ?? "",
            nom: data.nom ?? "",
            email: data.email ?? user.email ?? "",
            telephone: data.telephone ?? "",
          });
        }
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user]);

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setSavedMsg("");
    const { error } = await supabase
      .from("profiles")
      .upsert({
        user_id: user.id,
        prenom: form.prenom,
        nom: form.nom,
        email: form.email,
        telephone: form.telephone,
      }, { onConflict: "user_id" });
    setSaving(false);
    setSavedMsg(error ? `Erreur : ${error.message}` : "Profil mis à jour ✓");
    setTimeout(() => setSavedMsg(""), 3000);
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwdMsg(null);
    if (pwd.next.length < 8) {
      setPwdMsg({ type: "err", text: "Le nouveau mot de passe doit contenir au moins 8 caractères." });
      return;
    }
    if (pwd.next !== pwd.confirm) {
      setPwdMsg({ type: "err", text: "Les mots de passe ne correspondent pas." });
      return;
    }
    setPwdSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pwd.next });
    setPwdSaving(false);
    if (error) {
      setPwdMsg({ type: "err", text: error.message });
    } else {
      setPwd({ current: "", next: "", confirm: "" });
      setPwdMsg({ type: "ok", text: "Mot de passe modifié avec succès." });
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>;

  const inputClass = "w-full bg-navy/60 border border-primary/20 rounded px-3 py-2.5 text-cream text-sm focus:border-primary/60 focus:outline-none transition-colors";

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-heading text-2xl text-primary tracking-[0.1em] uppercase">Mon profil</h1>
        <p className="text-cream/50 text-sm mt-1">Gérez vos informations personnelles et votre mot de passe</p>
      </div>

      {/* Profile */}
      <form onSubmit={saveProfile} className="card-premium p-6 rounded space-y-5">
        <h2 className="font-heading text-base text-cream tracking-wider flex items-center gap-2">
          <User size={16} className="text-primary" /> Informations personnelles
        </h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-cream/50 mb-1">Prénom</label>
            <input type="text" value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} className={inputClass} required />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-cream/50 mb-1">Nom</label>
            <input type="text" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} className={inputClass} required />
          </div>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wider text-cream/50 mb-1"><Mail size={11} className="inline mr-1" />Email</label>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} disabled />
          <p className="text-cream/30 text-xs mt-1">L'email ne peut pas être modifié depuis cette page.</p>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wider text-cream/50 mb-1"><Phone size={11} className="inline mr-1" />Téléphone</label>
          <input type="tel" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} className={inputClass} />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-primary/10">
          {savedMsg && (
            <span className={`text-xs ${savedMsg.startsWith("Erreur") ? "text-destructive" : "text-green-400"}`}>{savedMsg}</span>
          )}
          <button type="submit" disabled={saving} className="ml-auto inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-navy text-xs uppercase tracking-wider font-heading hover:bg-gold-light transition-colors disabled:opacity-60">
            {saving && <Loader2 size={12} className="animate-spin" />} Enregistrer
          </button>
        </div>
      </form>

      {/* Password */}
      <form onSubmit={changePassword} className="card-premium p-6 rounded space-y-5">
        <h2 className="font-heading text-base text-cream tracking-wider flex items-center gap-2">
          <Lock size={16} className="text-primary" /> Changer mon mot de passe
        </h2>

        <div>
          <label className="block text-xs uppercase tracking-wider text-cream/50 mb-1">Nouveau mot de passe</label>
          <input type="password" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} className={inputClass} minLength={8} placeholder="Minimum 8 caractères" />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-cream/50 mb-1">Confirmer</label>
          <input type="password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} className={inputClass} minLength={8} />
        </div>

        {pwdMsg && (
          <div className={`flex items-center gap-2 text-xs ${pwdMsg.type === "ok" ? "text-green-400" : "text-destructive"}`}>
            {pwdMsg.type === "ok" ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
            {pwdMsg.text}
          </div>
        )}

        <div className="flex items-center justify-end pt-2 border-t border-primary/10">
          <button type="submit" disabled={pwdSaving || !pwd.next} className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-navy text-xs uppercase tracking-wider font-heading hover:bg-gold-light transition-colors disabled:opacity-60">
            {pwdSaving && <Loader2 size={12} className="animate-spin" />} Modifier le mot de passe
          </button>
        </div>
      </form>
    </div>
  );
}
