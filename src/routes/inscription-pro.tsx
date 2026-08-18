import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, User, Mail, Phone, Lock, CheckCircle, Building2, Hash } from "lucide-react";
import { getRecaptchaToken } from "@/lib/recaptcha";
import { verifyRecaptcha } from "@/lib/recaptcha.functions";
import { finalizeSignup } from "@/lib/signup-finalize";
import { useRegistrationGate } from "@/hooks/useRegistrationGate";
import { RegistrationClosed } from "@/components/RegistrationClosed";

export const Route = createFileRoute("/inscription-pro")({
  component: InscriptionPro,
  head: () => ({
    meta: [
      { title: "Inscription professionnelle · Transports Ligneo" },
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
  const { loading: gateLoading, isOpen } = useRegistrationGate();

  if (gateLoading) {
    return (
      <div className="auth-shell flex items-center justify-center px-4 py-10">
        <Loader2 className="animate-spin text-white/60" size={32} />
      </div>
    );
  }

  if (!isOpen("pro")) {
    return <RegistrationClosed kind="pro" />;
  }

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
      // reCAPTCHA en mode soft : on log le score mais on ne bloque jamais l'inscription
      try {
        const token = await getRecaptchaToken("signup_pro");
        if (token) {
          const r = await verifyRecaptcha({ data: { token, action: "signup_pro", minScore: 0.3 } });
          if (!r.ok && !r.skipped) console.warn("[signup_pro] recaptcha low score", r);
        }
      } catch (e) { console.warn("[signup_pro] recaptcha error", e); }
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: {
            role: "client",
            type_client: "b2b",
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

        await finalizeSignup(authData.user.id, "pro");

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
      <div className="auth-shell flex items-center justify-center px-4 py-10">
        <div className="max-w-md w-full auth-fade-in">
          <div className="auth-card p-8 text-center space-y-4">
            <div className="mx-auto h-14 w-14 rounded-full bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center">
              <CheckCircle className="text-emerald-300" size={28} />
            </div>
            <h1 className="auth-title text-xl md:text-2xl">Compte pro créé</h1>
            <p className="auth-subtle text-sm leading-relaxed">
              Vérifiez votre boîte mail pour confirmer votre adresse, puis connectez-vous à votre espace B2B.
            </p>
            <Link to="/login" className="auth-link uppercase tracking-[0.14em] text-[11px] font-semibold">
              Aller à la connexion →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full auth-fade-in">
        <div className="text-center mb-6">
          <div className="auth-eyebrow justify-center">Espace professionnel</div>
          <h1 className="auth-title text-2xl md:text-[34px]">
            Inscription <span className="auth-accent">pro</span>
          </h1>
          <p className="auth-subtle text-sm mt-2">Concessionnaires · loueurs · assurances · dashboard B2B</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-card p-6 md:p-7 space-y-5">
          <div className="space-y-4 pb-4 border-b border-white/10">
            <div>
              <label className="auth-label">Raison sociale *</label>
              <div className="auth-field">
                <Building2 size={16} className="auth-field-icon" />
                <input type="text" value={form.societe} onChange={update("societe")} className="auth-input" required />
              </div>
            </div>
            <div>
              <label className="auth-label">SIRET</label>
              <div className="auth-field">
                <Hash size={16} className="auth-field-icon" />
                <input type="text" value={form.siret} onChange={update("siret")} className="auth-input" placeholder="14 chiffres" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="auth-label">Prénom *</label>
              <div className="auth-field">
                <User size={16} className="auth-field-icon" />
                <input type="text" value={form.prenom} onChange={update("prenom")} className="auth-input" required />
              </div>
            </div>
            <div>
              <label className="auth-label">Nom *</label>
              <div className="auth-field">
                <User size={16} className="auth-field-icon" />
                <input type="text" value={form.nom} onChange={update("nom")} className="auth-input" required />
              </div>
            </div>
          </div>

          <div>
            <label className="auth-label">Email pro *</label>
            <div className="auth-field">
              <Mail size={16} className="auth-field-icon" />
              <input type="email" value={form.email} onChange={update("email")} className="auth-input" required />
            </div>
          </div>

          <div>
            <label className="auth-label">Téléphone *</label>
            <div className="auth-field">
              <Phone size={16} className="auth-field-icon" />
              <input type="tel" value={form.telephone} onChange={update("telephone")} className="auth-input" required />
            </div>
          </div>

          <div>
            <label className="auth-label">Mot de passe *</label>
            <div className="auth-field">
              <Lock size={16} className="auth-field-icon" />
              <input type="password" value={form.password} onChange={update("password")} className="auth-input" required minLength={8} placeholder="Minimum 8 caractères" />
            </div>
          </div>

          {error && <div className="auth-alert auth-alert-error">{error}</div>}

          <button type="submit" disabled={loading} className="auth-btn-primary">
            {loading && <Loader2 className="animate-spin" size={16} />}
            {loading ? "Création…" : "Créer mon compte pro"}
          </button>
        </form>

        <div className="text-center mt-6 space-y-2.5">
          <p className="text-[10px] leading-relaxed text-white/45 px-2">
            Protégé par reCAPTCHA ·{" "}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-200">Confidentialité</a>
            {" "}·{" "}
            <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-200">CGU</a>
          </p>
          <Link to="/login" className="block auth-link uppercase tracking-[0.14em] text-[11px] font-semibold">
            Déjà inscrit ? Se connecter
          </Link>
          <Link to="/choisir-compte" className="block text-white/40 text-xs hover:text-white transition-colors">
            ← Choisir un autre type de compte
          </Link>
        </div>
      </div>
    </div>
  );
}
