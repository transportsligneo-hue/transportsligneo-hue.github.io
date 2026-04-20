import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, type FormEvent } from "react";
import {
  User, Mail, Phone, MapPin, IdCard, Calendar, Lock, Loader2, CheckCircle, AlertCircle,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/convoyeur/profil")({
  component: ConvoyeurProfil,
});

function ConvoyeurProfil() {
  const { user } = useAuth();
  const [convoyeurId, setConvoyeurId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [statut, setStatut] = useState<string>("en_attente");
  const [typeConv, setTypeConv] = useState<string>("salarie");

  const [form, setForm] = useState({
    prenom: "", nom: "", email: "", telephone: "", ville: "", permis: "", annees_experience: "",
  });

  const [pwd, setPwd] = useState({ next: "", confirm: "" });
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("convoyeurs")
        .select("id, prenom, nom, email, telephone, ville, permis, annees_experience, statut, type_convoyeur")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setConvoyeurId(data.id);
        setStatut(data.statut ?? "en_attente");
        setTypeConv(data.type_convoyeur ?? "salarie");
        setForm({
          prenom: data.prenom ?? "", nom: data.nom ?? "", email: data.email ?? user.email ?? "",
          telephone: data.telephone ?? "", ville: data.ville ?? "", permis: data.permis ?? "",
          annees_experience: data.annees_experience != null ? String(data.annees_experience) : "",
        });
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!convoyeurId) return;
    setSaving(true);
    setSavedMsg("");
    const { error } = await supabase
      .from("convoyeurs")
      .update({
        prenom: form.prenom, nom: form.nom, telephone: form.telephone,
        ville: form.ville, permis: form.permis,
        annees_experience: form.annees_experience ? parseInt(form.annees_experience, 10) : null,
      })
      .eq("id", convoyeurId);
    setSaving(false);
    setSavedMsg(error ? `Erreur : ${error.message}` : "Profil mis à jour ✓");
    setTimeout(() => setSavedMsg(""), 3000);
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwdMsg(null);
    if (pwd.next.length < 8) { setPwdMsg({ type: "err", text: "Minimum 8 caractères." }); return; }
    if (pwd.next !== pwd.confirm) { setPwdMsg({ type: "err", text: "Les mots de passe ne correspondent pas." }); return; }
    setPwdSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pwd.next });
    setPwdSaving(false);
    if (error) setPwdMsg({ type: "err", text: error.message });
    else { setPwd({ next: "", confirm: "" }); setPwdMsg({ type: "ok", text: "Mot de passe modifié avec succès." }); }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-emerald-600" size={24} /></div>;

  const inputClass = "w-full bg-white border border-pro-border rounded-lg px-3 py-2.5 text-pro-text text-sm focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 focus:outline-none transition-colors";

  const statutLabel: Record<string, string> = {
    valide: "Compte validé", en_attente: "En attente de validation", refuse: "Compte refusé", suspendu: "Compte suspendu",
  };
  const statutStyle: Record<string, string> = {
    valide: "bg-emerald-50 text-emerald-700 border-emerald-200",
    en_attente: "bg-amber-50 text-amber-700 border-amber-200",
    refuse: "bg-red-50 text-red-700 border-red-200",
    suspendu: "bg-gray-100 text-gray-600 border-gray-200",
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-pro-text">Mon profil</h1>
          <p className="text-pro-text-soft text-sm mt-1">Vos informations personnelles et professionnelles</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${statutStyle[statut] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
            {statutLabel[statut] ?? statut}
          </span>
          <span className="text-pro-muted text-[10px] uppercase tracking-wider font-medium">
            {typeConv === "independant" ? "Indépendant" : "Salarié"}
          </span>
        </div>
      </div>

      {/* Profile form */}
      <form onSubmit={saveProfile} className="bg-white rounded-xl border border-pro-border p-5 sm:p-6 space-y-5 shadow-sm">
        <h2 className="font-semibold text-sm text-pro-text flex items-center gap-2">
          <User size={16} className="text-emerald-600" /> Informations personnelles
        </h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-pro-text-soft mb-1">Prénom</label>
            <input type="text" value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} className={inputClass} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-pro-text-soft mb-1">Nom</label>
            <input type="text" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} className={inputClass} required />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-pro-text-soft mb-1"><Mail size={11} className="inline mr-1" />Email</label>
            <input type="email" value={form.email} className={inputClass + " bg-pro-bg-soft"} disabled />
            <p className="text-pro-muted text-xs mt-1">L'email ne peut pas être modifié.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-pro-text-soft mb-1"><Phone size={11} className="inline mr-1" />Téléphone</label>
            <input type="tel" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} className={inputClass} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-pro-text-soft mb-1"><MapPin size={11} className="inline mr-1" />Ville</label>
          <input type="text" value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} className={inputClass} />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-pro-text-soft mb-1"><IdCard size={11} className="inline mr-1" />Permis</label>
            <input type="text" value={form.permis} onChange={(e) => setForm({ ...form, permis: e.target.value })} placeholder="Catégorie / numéro" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-pro-text-soft mb-1"><Calendar size={11} className="inline mr-1" />Années d'expérience</label>
            <input type="number" min="0" value={form.annees_experience} onChange={(e) => setForm({ ...form, annees_experience: e.target.value })} className={inputClass} />
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-pro-border">
          {savedMsg && (
            <span className={`text-xs ${savedMsg.startsWith("Erreur") ? "text-red-600" : "text-emerald-600"}`}>{savedMsg}</span>
          )}
          <button type="submit" disabled={saving} className="ml-auto inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60">
            {saving && <Loader2 size={12} className="animate-spin" />} Enregistrer
          </button>
        </div>
      </form>

      {/* Password */}
      <form onSubmit={changePassword} className="bg-white rounded-xl border border-pro-border p-5 sm:p-6 space-y-5 shadow-sm">
        <h2 className="font-semibold text-sm text-pro-text flex items-center gap-2">
          <Lock size={16} className="text-emerald-600" /> Changer mon mot de passe
        </h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-pro-text-soft mb-1">Nouveau mot de passe</label>
            <input type="password" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} className={inputClass} minLength={8} placeholder="Minimum 8 caractères" />
          </div>
          <div>
            <label className="block text-xs font-medium text-pro-text-soft mb-1">Confirmer</label>
            <input type="password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} className={inputClass} minLength={8} />
          </div>
        </div>

        {pwdMsg && (
          <div className={`flex items-center gap-2 text-xs ${pwdMsg.type === "ok" ? "text-emerald-600" : "text-red-600"}`}>
            {pwdMsg.type === "ok" ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
            {pwdMsg.text}
          </div>
        )}

        <div className="flex items-center justify-end pt-3 border-t border-pro-border">
          <button type="submit" disabled={pwdSaving || !pwd.next} className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60">
            {pwdSaving && <Loader2 size={12} className="animate-spin" />} Modifier le mot de passe
          </button>
        </div>
      </form>
    </div>
  );
}
