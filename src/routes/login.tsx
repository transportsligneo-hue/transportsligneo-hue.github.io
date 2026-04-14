import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, LogIn } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Connexion — Transports Ligneo" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function LoginPage() {
  const { login, isAuthenticated, role, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect if already authenticated
  if (!authLoading && isAuthenticated && role) {
    if (role === "admin") {
      navigate({ to: "/admin" });
    } else if (role === "convoyeur") {
      navigate({ to: "/convoyeur" });
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur de connexion";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center section-bg px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="gold-divider-short mb-4" />
          <h1 className="font-heading text-2xl md:text-3xl tracking-[0.15em] uppercase text-primary">
            Espace professionnel
          </h1>
          <p className="text-cream/50 mt-2 text-sm">Connexion sécurisée</p>
        </div>

        <form onSubmit={handleSubmit} className="card-premium p-8 rounded space-y-5">
          {error && (
            <div className="p-3 rounded bg-destructive/20 border border-destructive/30 text-destructive text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs uppercase tracking-wider text-cream/50 mb-2">Email</label>
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
              className="w-full bg-navy/60 border border-primary/20 rounded px-4 py-3 text-cream text-sm focus:border-primary/60 focus:outline-none transition-colors"
              placeholder="••••••••"
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
                Connexion...
              </>
            ) : (
              <>
                <LogIn size={16} />
                Se connecter
              </>
            )}
          </button>
        </form>

        <div className="text-center mt-6">
          <a href="/" className="text-cream/40 text-xs hover:text-primary transition-colors">
            ← Retour au site
          </a>
        </div>
      </div>
    </div>
  );
}
