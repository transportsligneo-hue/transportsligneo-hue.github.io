import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, User, Mail, Phone, Lock, CheckCircle, Building2, Hash } from "lucide-react";

export const Route = createFileRoute("/inscription-pro")({
  component: InscriptionPro,
  head: () => ({
    meta: [
      { title: "Inscription professionnelle — Transports Ligneo" },
      { name: "description", content: "Créez votre compte professionnel B2B pour gérer vos missions de convoyage." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function InscriptionPro() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    societe: "", siret: "", prenom: "", nom: "", email: "", telephone: "", password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.societe || !form.prenom || !form.nom || !form.email || !form.telephone || !form.password) {
      setError("Veuillez remplir tous les champs obligatoires.");
      return;
    }
    if (form.password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    setLoading(true);
    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: {
            role: "client",
            nom: form.nom,
            prenom: form.prenom,
            telephone: form.telephone,
            societe: form.societe,
            siret: form.siret,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message.includes("already registered")
          ? "Cette adresse email est déjà utilisée."
          : signUpError.message);
        setLoading(false);
        return;
      }

      if (authData.user) {
        if (authData.session) {
          await supabase.from("profiles").update({
            telephone: form.telephone,
            nom: form.nom,
            prenom: form.prenom,
            societe: form.societe,
            siret: form.siret,
          } as never).eq("user_id", authData.user.id);
        }

        setSuccess(true);
        if (authData.session) {
          setTimeout(() => navigate({ to: "/dashboard-pro" }), 1500);
        }
      }
    } catch {
      setError("Une erreur est survenue. Veuillez réessayer.");
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen section-bg flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="gold-divider-short mx-auto" />
          <CheckCircle className="mx-auto text-primary" size={48} />
          <h1 className="font-heading text-2xl text-primary tracking-[0.1em] uppercase">
            Compte pro créé !
          </h1>
          <p className="text-cream/70 text-sm">
            Vérifiez votre boîte mail pour confirmer votre adresse, puis connectez-vous.
          </p>
          <Link to="/login" className="inline-block text-primary text-sm hover:text-gold-light transition-colors uppercase tracking-[0.15em]">
            Se connecter →
          </Link>
        </div>
      </div>
    );
  }

  const inputClass = "w-full bg-navy/60 border border-primary/20 rounded px-3 py-2.5 text-cream text-sm focus:border-primary/60 focus:outline-none transition-colors";

  return (
    <div className="min-h-screen section-bg flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="gold-divider-short mx-auto mb-4" />
          <h1 className="font-heading text-2xl md:text-3xl text-primary tracking-[0.1em] uppercase">
            Inscription pro
          </h1>
          <p className="text-cream/50 text-sm mt-2">Espace B2B — concessionnaires, loueurs, assurances</p>
        </div>

        <form onSubmit={handleSubmit} className="card-premium p-6 md:p-8 rounded space-y-5">
          <div className="space-y-4 pb-4 border-b border-primary/10">
            <div>
              <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
                <Building2 size={12} className="inline mr-1" /> Raison sociale *
              </label>
              <input type="text" value={form.societe} onChange={update("societe")} className={inputClass} required />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
                <Hash size={12} className="inline mr-1" /> SIRET
              </label>
              <input type="text" value={form.siret} onChange={update("siret")} className={inputClass} placeholder="14 chiffres" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
                <User size={12} className="inline mr-1" /> Prénom *
              </label>
              <input type="text" value={form.prenom} onChange={update("prenom")} className={inputClass} required />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
                <User size={12} className="inline mr-1" /> Nom *
              </label>
              <input type="text" value={form.nom} onChange={update("nom")} className={inputClass} required />
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
              <Mail size={12} className="inline mr-1" /> Email pro *
            </label>
            <input type="email" value={form.email} onChange={update("email")} className={inputClass} required />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
              <Phone size={12} className="inline mr-1" /> Téléphone *
            </label>
            <input type="tel" value={form.telephone} onChange={update("telephone")} className={inputClass} required />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
              <Lock size={12} className="inline mr-1" /> Mot de passe *
            </label>
            <input type="password" value={form.password} onChange={update("password")} className={inputClass} required minLength={8} placeholder="Minimum 8 caractères" />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-heading text-sm tracking-[0.1em] uppercase hover:bg-gold-light transition-colors disabled:opacity-50">
            {loading && <Loader2 className="animate-spin" size={16} />}
            {loading ? "Création..." : "Créer mon compte pro"}
          </button>
        </form>

        <div className="text-center mt-6 space-y-2">
          <Link to="/login" className="block text-primary text-xs hover:text-gold-light transition-colors uppercase tracking-[0.15em]">
            Déjà inscrit ? Se connecter
          </Link>
          <Link to="/choisir-compte" className="block text-cream/40 text-xs hover:text-primary transition-colors">
            ← Choisir un autre type de compte
          </Link>
        </div>
      </div>
    </div>
  );
}
