import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Lock, CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react";
import logoLigneo from "@/assets/logo-transports-ligneo-officiel.png";

export const Route = createFileRoute("/reset-password")({
  component: ResetPassword,
  head: () => ({
    meta: [
      { title: "Nouveau mot de passe · Transports Ligneo" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    const consumeLink = async () => {
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
      const q = url.searchParams;

      const errDesc = q.get("error_description") ?? hash.get("error_description");
      if (errDesc) {
        if (!cancelled) { setError(decodeURIComponent(errDesc)); setHasSession(false); }
        return;
      }

      try {
        const code = q.get("code");
        const tokenHash = q.get("token_hash") ?? q.get("token");
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");

        if (accessToken && refreshToken) {
          const { error: e } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (e) throw e;
        } else if (code) {
          const { error: e } = await supabase.auth.exchangeCodeForSession(code);
          if (e) throw e;
        } else if (tokenHash) {
          const { error: e } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
          if (e) throw e;
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Lien invalide.");
          setHasSession(false);
        }
        return;
      }

      // Nettoie l'URL (évite de rejouer un token déjà consommé)
      if (url.hash || q.has("code") || q.has("token_hash") || q.has("token")) {
        window.history.replaceState({}, "", url.pathname);
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!cancelled) setHasSession(!!session);
    };

    void consumeLink();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || session) { setHasSession(true); setError(""); }
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
    <div className="auth-shell flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md auth-fade-in">
        <div className="text-center mb-6">
          <Link to="/" className="inline-block mb-4">
            <img src={logoLigneo} alt="Transports Ligneo" className="h-16 w-auto mx-auto drop-shadow-[0_8px_20px_rgba(59,130,246,0.35)]" />
          </Link>
          <h1 className="auth-title text-2xl md:text-3xl">Nouveau mot de passe</h1>
        </div>

        {success ? (
          <div className="auth-card p-7 text-center space-y-4">
            <div className="mx-auto h-14 w-14 rounded-full bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center">
              <CheckCircle className="text-emerald-300" size={28} />
            </div>
            <h2 className="auth-title text-lg">Mot de passe modifié</h2>
            <p className="auth-subtle text-sm">Redirection vers la page de connexion…</p>
            <Loader2 className="animate-spin text-blue-300 mx-auto" size={20} />
          </div>
        ) : hasSession === false ? (
          <div className="auth-card p-7 text-center space-y-4">
            <div className="mx-auto h-14 w-14 rounded-full bg-amber-500/15 border border-amber-400/30 flex items-center justify-center">
              <AlertCircle className="text-amber-300" size={28} />
            </div>
            <h2 className="auth-title text-lg">Lien invalide ou expiré</h2>
            <p className="auth-subtle text-sm">
              Ce lien de réinitialisation n'est plus valide. Demandez un nouveau lien depuis la page de connexion.
            </p>
            <Link to="/mot-de-passe-oublie" className="auth-btn-primary mt-2">
              Demander un nouveau lien
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-card p-6 sm:p-7 space-y-5">
            {error && <div className="auth-alert auth-alert-error">{error}</div>}

            <div>
              <label className="auth-label">Nouveau mot de passe</label>
              <div className="auth-field">
                <Lock size={16} className="auth-field-icon" />
                <input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="auth-input pr-11"
                  placeholder="Minimum 8 caractères"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
                  aria-label={showPwd ? "Masquer" : "Afficher"}
                  tabIndex={-1}
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="auth-label">Confirmer le mot de passe</label>
              <div className="auth-field">
                <Lock size={16} className="auth-field-icon" />
                <input
                  type={showPwd ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="auth-input"
                  placeholder="Retapez votre mot de passe"
                />
              </div>
            </div>

            <button type="submit" disabled={loading || hasSession === null} className="auth-btn-primary">
              {loading ? <><Loader2 size={16} className="animate-spin" />Mise à jour…</> : "Modifier mon mot de passe"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
