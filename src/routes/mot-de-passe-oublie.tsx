import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Mail, CheckCircle, ArrowLeft } from "lucide-react";
import logoLigneo from "@/assets/logo-transports-ligneo-officiel.png";

export const Route = createFileRoute("/mot-de-passe-oublie")({
  component: MotDePasseOublie,
  head: () => ({
    meta: [
      { title: "Mot de passe oublié · Transports Ligneo" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function MotDePasseOublie() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) throw resetError;
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'envoi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md auth-fade-in">
        <div className="text-center mb-6">
          <Link to="/" className="inline-block mb-4">
            <img src={logoLigneo} alt="Transports Ligneo" className="h-16 w-auto mx-auto drop-shadow-[0_8px_20px_rgba(59,130,246,0.35)]" />
          </Link>
          <h1 className="auth-title text-2xl md:text-3xl">Mot de passe oublié</h1>
          <p className="auth-subtle text-sm mt-1.5">Recevez un lien de réinitialisation</p>
        </div>

        {sent ? (
          <div className="auth-card p-7 text-center space-y-4">
            <div className="mx-auto h-14 w-14 rounded-full bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center">
              <CheckCircle className="text-emerald-300" size={28} />
            </div>
            <h2 className="auth-title text-lg">Email envoyé</h2>
            <p className="auth-subtle text-sm">
              Si un compte existe pour <strong className="text-white">{email}</strong>, vous recevrez un lien
              de réinitialisation dans quelques instants. Pensez à vérifier vos spams.
            </p>
            <Link to="/login" className="auth-btn-primary mt-2">
              <ArrowLeft size={14} /> Retour à la connexion
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-card p-6 sm:p-7 space-y-5">
            {error && <div className="auth-alert auth-alert-error">{error}</div>}
            <p className="auth-subtle text-sm">
              Saisissez votre adresse email. Nous vous enverrons un lien sécurisé pour choisir un nouveau mot de passe.
            </p>
            <div>
              <label className="auth-label">Email</label>
              <div className="auth-field">
                <Mail size={16} className="auth-field-icon" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="auth-input"
                  placeholder="votre@email.com"
                />
              </div>
            </div>
            <button type="submit" disabled={loading} className="auth-btn-primary">
              {loading ? <><Loader2 size={16} className="animate-spin" />Envoi…</> : "Envoyer le lien"}
            </button>
            <div className="text-center pt-3 border-t border-white/10">
              <Link to="/login" className="auth-link uppercase tracking-[0.14em] text-[11px] font-semibold">
                ← Retour à la connexion
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
