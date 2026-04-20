import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, type FormEvent } from "react";
import {
  User, Mail, Phone, MapPin, IdCard, Calendar, Lock, Loader2, CheckCircle, AlertCircle,
} from "lucide-react";
import { StatusBadge } from "@/components/dashboard/StatusBadge";

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
    prenom: "",
    nom: "",
    email: "",
    telephone: "",
    ville: "",
    permis: "",
    annees_experience: "",
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
          prenom: data.prenom ?? "",
          nom: data.nom ?? "",
          email: data.email ?? user.email ?? "",
          telephone: data.telephone ?? "",
          ville: data.ville ?? "",
          permis: data.permis ?? "",
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
        prenom: form.prenom,
        nom: form.nom,
        telephone: form.telephone,
        ville: form.ville,
        permis: form.permis,
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
    if (pwd.next.length < 8) {
      setPwdMsg({ type: "err", text: "Le mot de passe doit contenir au moins 8 caractères." });
      return;
    }
    if (pwd.next !== pwd.confirm) {
      setPwdMsg({ type: "err", text: "Les mots de passe ne correspondent pas." });
      return;
    }
    setPwdSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pwd.next });
    setPwdSaving(false);
    if (error) setPwdMsg({ type: "err", text: error.message });
    else {
      setPwd({ next: "", confirm: "" });
      setPwdMsg({ type: "ok", text: "Mot de passe modifié avec succès." });
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>;

  const inputClass = "w-full bg-navy/60 border border-primary/20 rounded px-3 py-2.5 text-cream text-sm focus:border-primary/60 focus:outline-none transition-colors";
  const statutKind = statut === "valide" ? "success" : statut === "en_attente" ? "warning" : statut === "refuse" ? "danger" : "neutral";
  const statutLabel: Record<string, string> = {
    valide: "Compte validé",
    en_attente: "En attente de validation",
    refuse: "Compte refusé",
    suspendu: "Compte suspendu",
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl text-primary tracking-[0.1em] uppercase">Mon profil</h1>
          <p className="text-cream/50 text-sm mt-1">Vos informations personnelles et professionnelles</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <StatusBadge kind={statutKind} size="md">
            {statutLabel[statut] ?? statut}
          </StatusBadge>
          <span className="text-cream/40 text-[10px] uppercase tracking-wider">
            Type : {typeConv === "independant" ? "Indépendant" : "Salarié"}
          </span>
        </div>
      </div>

      {/* Profil */}
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

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-cream/50 mb-1"><Mail size={11} className="inline mr-1" />Email</label>
            <input type="email" value={form.email} className={inputClass} disabled />
            <p className="text-cream/30 text-xs mt-1">L'email ne peut pas être modifié.</p>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-cream/50 mb-1"><Phone size={11} className="inline mr-1" />Téléphone</label>
            <input type="tel" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} className={inputClass} />
          </div>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wider text-cream/50 mb-1"><MapPin size={11} className="inline mr-1" />Ville</label>
          <input type="text" value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} className={inputClass} />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-cream/50 mb-1"><IdCard size={11} className="inline mr-1" />Permis</label>
            <input type="text" value={form.permis} onChange={(e) => setForm({ ...form, permis: e.target.value })} placeholder="Catégorie / numéro" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-cream/50 mb-1"><Calendar size={11} className="inline mr-1" />Années d'expérience</label>
            <input type="number" min="0" value={form.annees_experience} onChange={(e) => setForm({ ...form, annees_experience: e.target.value })} className={inputClass} />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-primary/10">
          {savedMsg && (
            <span className={`text-xs ${savedMsg.startsWith("Erreur") ? "text-destructive" : "text-green-400"}`}>{savedMsg}</span>
          )}
          <button type="submit" disabled={saving} className="ml-auto inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-navy text-xs uppercase tracking-wider font-heading hover:bg-gold-light transition-colors disabled:opacity-60 rounded">
            {saving && <Loader2 size={12} className="animate-spin" />} Enregistrer
          </button>
        </div>
      </form>

      {/* Mot de passe */}
      <form onSubmit={changePassword} className="card-premium p-6 rounded space-y-5">
        <h2 className="font-heading text-base text-cream tracking-wider flex items-center gap-2">
          <Lock size={16} className="text-primary" /> Changer mon mot de passe
        </h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-cream/50 mb-1">Nouveau mot de passe</label>
            <input type="password" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} className={inputClass} minLength={8} placeholder="Minimum 8 caractères" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-cream/50 mb-1">Confirmer</label>
            <input type="password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} className={inputClass} minLength={8} />
          </div>
        </div>

        {pwdMsg && (
          <div className={`flex items-center gap-2 text-xs ${pwdMsg.type === "ok" ? "text-green-400" : "text-destructive"}`}>
            {pwdMsg.type === "ok" ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
            {pwdMsg.text}
          </div>
        )}

        <div className="flex items-center justify-end pt-2 border-t border-primary/10">
          <button type="submit" disabled={pwdSaving || !pwd.next} className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-navy text-xs uppercase tracking-wider font-heading hover:bg-gold-light transition-colors disabled:opacity-60 rounded">
            {pwdSaving && <Loader2 size={12} className="animate-spin" />} Modifier le mot de passe
          </button>
        </div>
      </form>
    </div>
  );
}
