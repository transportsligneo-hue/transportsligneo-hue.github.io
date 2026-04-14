import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { seedAdminUser } from "@/server/admin-setup";
import { Loader2, Shield } from "lucide-react";

export const Route = createFileRoute("/setup")({
  component: SetupPage,
  head: () => ({
    meta: [
      { title: "Configuration initiale — Transports Ligneo" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function SetupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !email.includes("@")) {
      setError("Veuillez entrer un email valide.");
      return;
    }
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      const result = await seedAdminUser({
        data: { email, password },
      });
      if (result.success) {
        setSuccess(true);
        setTimeout(() => navigate({ to: "/login" }), 2000);
      } else {
        setError(result.message);
      }
    } catch {
      setError("Erreur lors de la configuration.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center section-bg px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="gold-divider-short mb-4" />
          <h1 className="font-heading text-2xl tracking-[0.15em] uppercase text-primary">
            Configuration initiale
          </h1>
          <p className="text-cream/50 mt-2 text-sm">
            Créez le compte administrateur
          </p>
        </div>

        {success ? (
          <div className="card-premium p-8 rounded text-center">
            <Shield className="text-green-400 mx-auto mb-3" size={32} />
            <p className="text-green-300 text-sm">Compte admin créé ! Redirection vers la connexion...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card-premium p-8 rounded space-y-5">
            {error && (
              <div className="p-3 rounded bg-destructive/20 border border-destructive/30 text-destructive text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs uppercase tracking-wider text-cream/50 mb-2">Email admin</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-navy/60 border border-primary/20 rounded px-4 py-3 text-cream text-sm focus:border-primary/60 focus:outline-none transition-colors"
                placeholder="votre@email.com"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-cream/50 mb-2">Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full bg-navy/60 border border-primary/20 rounded px-4 py-3 text-cream text-sm focus:border-primary/60 focus:outline-none transition-colors"
                placeholder="Minimum 8 caractères"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-cream/50 mb-2">Confirmer le mot de passe</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full bg-navy/60 border border-primary/20 rounded px-4 py-3 text-cream text-sm focus:border-primary/60 focus:outline-none transition-colors"
                placeholder="Retapez le mot de passe"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-3 px-8 py-3 bg-primary text-primary-foreground font-heading text-sm tracking-[0.15em] uppercase hover:bg-gold-light transition-colors duration-300 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <Shield size={16} />
                  Créer le compte admin
                </>
              )}
            </button>
          </form>
        )}

        <div className="text-center mt-6">
          <a href="/" className="text-cream/40 text-xs hover:text-primary transition-colors">
            ← Retour au site
          </a>
        </div>
      </div>
    </div>
  );
}
