import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Mail, CheckCircle, ArrowLeft } from "lucide-react";
import logoLigneo from "@/assets/logo-transports-ligneo-officiel.png";

export const Route = createFileRoute("/mot-de-passe-oublie")({
  component: MotDePasseOublie,
  head: () => ({
    meta: [
      { title: "Mot de passe oublié — Transports Ligneo" },
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
    <div className="min-h-screen flex items-center justify-center section-bg px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block mb-6">
            <img src={logoLigneo} alt="Transports Ligneo" className="h-14 w-auto mx-auto" />
          </Link>
          <div className="gold-divider-short mb-4" />
          <h1 className="font-heading text-2xl md:text-3xl tracking-[0.15em] uppercase text-primary">
            Mot de passe oublié
          </h1>
          <p className="text-cream/50 mt-2 text-sm">Recevez un lien de réinitialisation</p>
        </div>

        {sent ? (
          <div className="card-premium p-7 rounded text-center space-y-4">
            <CheckCircle className="text-primary mx-auto" size={42} />
            <h2 className="font-heading text-lg text-cream tracking-wider">Email envoyé !</h2>
            <p className="text-cream/60 text-sm">
              Si un compte existe pour <strong className="text-cream">{email}</strong>, vous recevrez un lien
              de réinitialisation dans quelques instants. Pensez à vérifier vos spams.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 mt-4 px-6 py-3 bg-primary text-primary-foreground font-heading text-sm tracking-[0.15em] uppercase hover:bg-gold-light transition-colors"
            >
              <ArrowLeft size={14} /> Retour à la connexion
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card-premium p-7 rounded space-y-5">
            {error && (
              <div className="p-3 rounded bg-destructive/15 border border-destructive/30 text-destructive text-sm">
                {error}
              </div>
            )}
            <p className="text-cream/60 text-sm">
              Saisissez votre adresse email. Nous vous enverrons un lien sécurisé pour choisir un nouveau mot de passe.
            </p>
            <div>
              <label className="block text-xs uppercase tracking-wider text-cream/50 mb-2">
                <Mail size={12} className="inline mr-1" /> Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full bg-navy/60 border border-primary/20 rounded px-4 py-3 text-cream text-sm focus:border-primary/60 focus:outline-none transition-colors"
                placeholder="votre@email.com"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-3 px-8 py-3 bg-primary text-primary-foreground font-heading text-sm tracking-[0.15em] uppercase hover:bg-gold-light transition-colors disabled:opacity-60"
            >
              {loading ? <><Loader2 size={16} className="animate-spin" />Envoi…</> : "Envoyer le lien"}
            </button>
            <div className="text-center pt-2 border-t border-primary/10">
              <Link to="/login" className="text-cream/50 text-xs hover:text-primary transition-colors">
                ← Retour à la connexion
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
