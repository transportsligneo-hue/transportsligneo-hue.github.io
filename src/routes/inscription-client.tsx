import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, User, Mail, Phone, Lock, Eye, EyeOff } from "lucide-react";
import { getRecaptchaToken } from "@/lib/recaptcha";
import { verifyRecaptcha } from "@/lib/recaptcha.functions";
import { finalizeSignup } from "@/lib/signup-finalize";
import { useRegistrationGate } from "@/hooks/useRegistrationGate";
import { RegistrationClosed } from "@/components/RegistrationClosed";

export const Route = createFileRoute("/inscription-client")({
  component: InscriptionClient,
  head: () => ({
    meta: [
      { title: "Inscription client · Transports Ligneo" },
      { name: "description", content: "Créez votre compte client pour réserver vos convoyages en toute simplicité." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function InscriptionClient() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    prenom: "", nom: "", email: "", telephone: "", password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const { loading: gateLoading, isOpen } = useRegistrationGate();

  if (gateLoading) {
    return (
      <div className="auth-shell flex items-center justify-center px-4 py-10">
        <Loader2 className="animate-spin text-white/60" size={32} />
      </div>
    );
  }

  if (!isOpen("client")) {
    return <RegistrationClosed kind="client" />;
  }

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.prenom || !form.nom || !form.email || !form.telephone || !form.password) {
      setError("Veuillez remplir tous les champs.");
      return;
    }
    if (form.password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    setLoading(true);
    try {
      try {
        const token = await getRecaptchaToken("signup_client");
        if (token) {
          const r = await verifyRecaptcha({ data: { token, action: "signup_client", minScore: 0.3 } });
          if (!r.ok && !r.skipped) console.warn("[signup_client] recaptcha low score", r);
        }
      } catch (e) { console.warn("[signup_client] recaptcha error", e); }
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/email-confirmation`,
          data: {
            role: "client",
            type_client: "particulier",
            nom: form.nom,
            prenom: form.prenom,
            telephone: form.telephone,
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
        // Le trigger handle_new_user crée automatiquement profile + user_roles.
        // On met juste à jour le téléphone si l'utilisateur a une session active.
        if (authData.session) {
          await supabase.from("profiles").update({
            telephone: form.telephone,
            nom: form.nom,
            prenom: form.prenom,
          }).eq("user_id", authData.user.id);
        }

        // Emails + notification admin côté serveur (aucune session tant que
        // l'email n'est pas confirmé).
        await finalizeSignup(authData.user.id, "client");

        setSuccess(true);
        if (authData.session) {
          setTimeout(() => navigate({ to: "/dashboard-client" }), 1500);
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
            <div className="mx-auto h-14 w-14 rounded-full bg-blue-500/15 border border-blue-400/30 flex items-center justify-center">
              <Mail className="text-blue-300" size={28} />
            </div>
            <h1 className="auth-title text-xl md:text-2xl">Vérifiez votre email</h1>
            <p className="auth-subtle text-sm leading-relaxed">
              Nous venons d'envoyer un lien de confirmation à <span className="text-white font-medium">{form.email}</span>.
              Cliquez dessus pour activer votre compte, puis revenez vous connecter.
            </p>
            <div className="text-white/50 text-xs space-y-1 pt-3 border-t border-white/10">
              <p>Pas reçu ? Vérifiez vos spams.</p>
              <p>Le lien expire dans 24 heures.</p>
            </div>
            <Link to="/login" className="auth-link uppercase tracking-[0.14em] text-[11px] font-semibold">
              Aller à la connexion →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell flex items-center justify-center px-4 py-10">
      <div className="max-w-md w-full auth-fade-in">
        <div className="text-center mb-6">
          <h1 className="auth-title text-2xl md:text-3xl">Inscription client</h1>
          <p className="auth-subtle text-sm mt-1.5">Créez votre espace réservation</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-card p-6 md:p-7 space-y-5">
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
            <label className="auth-label">Email *</label>
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
              <input type={showPwd ? "text" : "password"} value={form.password} onChange={update("password")} className="auth-input pr-11" required minLength={8} placeholder="Minimum 8 caractères" />
              <button type="button" onClick={() => setShowPwd(v => !v)} aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"} tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors">
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && <div className="auth-alert auth-alert-error">{error}</div>}

          <button type="submit" disabled={loading} className="auth-btn-primary">
            {loading && <Loader2 className="animate-spin" size={16} />}
            {loading ? "Création…" : "Créer mon compte"}
          </button>
        </form>

        <div className="text-center mt-5 space-y-2.5">
          <p className="text-[10px] leading-relaxed text-white/45 px-2">
            Protégé par reCAPTCHA  · {" "}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-200">Confidentialité</a>
            {" "}·{" "}
            <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-200">CGU</a>
          </p>
          <Link to="/login" className="block auth-link uppercase tracking-[0.14em] text-[11px] font-semibold">
            Déjà inscrit ? Se connecter
          </Link>
          <Link to="/choisir-compte" className="block text-white/50 text-xs hover:text-white transition-colors">
            ← Choisir un autre type de compte
          </Link>
        </div>
      </div>
    </div>
  );
}

