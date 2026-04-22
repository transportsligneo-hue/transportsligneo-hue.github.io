import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Lock, CheckCircle, AlertCircle } from "lucide-react";
import logoLigneo from "@/assets/logo-transports-ligneo-officiel.png";

export const Route = createFileRoute("/reset-password")({
  component: ResetPassword,
  head: () => ({
    meta: [
      { title: "Nouveau mot de passe — Transports Ligneo" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  // Vérifie qu'on a bien une session de recovery active (le lien magique l'établit)
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) setHasSession(!!session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || session) setHasSession(true);
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) { setError("Le mot de passe doit contenir au moins 8 caractères."); return; }
    if (password !== confirmPassword) { setError("Les mots de passe ne correspondent pas."); return; }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setSuccess(true);
      await supabase.auth.signOut();
      setTimeout(() => navigate({ to: "/login" }), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur lors de la mise à jour.");
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
            Nouveau mot de passe
          </h1>
        </div>

        {success ? (
          <div className="card-premium p-7 rounded text-center space-y-4">
            <CheckCircle className="text-primary mx-auto" size={42} />
            <h2 className="font-heading text-lg text-cream tracking-wider">Mot de passe modifié !</h2>
            <p className="text-cream/60 text-sm">Redirection vers la page de connexion…</p>
            <Loader2 className="animate-spin text-primary mx-auto" size={20} />
          </div>
        ) : hasSession === false ? (
          <div className="card-premium p-7 rounded text-center space-y-4">
            <AlertCircle className="text-amber-400 mx-auto" size={42} />
            <h2 className="font-heading text-lg text-cream tracking-wider">Lien invalide ou expiré</h2>
            <p className="text-cream/60 text-sm">
              Ce lien de réinitialisation n'est plus valide. Demandez un nouveau lien depuis la page de connexion.
            </p>
            <Link
              to="/mot-de-passe-oublie"
              className="inline-block mt-2 px-6 py-3 bg-primary text-primary-foreground font-heading text-sm tracking-[0.15em] uppercase hover:bg-gold-light transition-colors"
            >
              Demander un nouveau lien
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card-premium p-7 rounded space-y-5">
            {error && (
              <div className="p-3 rounded bg-destructive/15 border border-destructive/30 text-destructive text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs uppercase tracking-wider text-cream/50 mb-2">
                <Lock size={12} className="inline mr-1" /> Nouveau mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full bg-navy/60 border border-primary/20 rounded px-4 py-3 text-cream text-sm focus:border-primary/60 focus:outline-none transition-colors"
                placeholder="Minimum 8 caractères"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-cream/50 mb-2">
                <Lock size={12} className="inline mr-1" /> Confirmer le mot de passe
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full bg-navy/60 border border-primary/20 rounded px-4 py-3 text-cream text-sm focus:border-primary/60 focus:outline-none transition-colors"
                placeholder="Retapez votre mot de passe"
              />
            </div>

            <button
              type="submit"
              disabled={loading || hasSession === null}
              className="w-full inline-flex items-center justify-center gap-3 px-8 py-3 bg-primary text-primary-foreground font-heading text-sm tracking-[0.15em] uppercase hover:bg-gold-light transition-colors disabled:opacity-60"
            >
              {loading ? <><Loader2 size={16} className="animate-spin" />Mise à jour…</> : "Modifier mon mot de passe"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
