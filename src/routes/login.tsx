import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, LogIn, User, Truck } from "lucide-react";
import logoLigneo from "@/assets/logo-ligneo.png";

type Tab = "client" | "pro";

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
  const { login, isAuthenticated, role, user, isLoading: authLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("client");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirection auto après connexion (en respectant l'onglet sélectionné)
  useEffect(() => {
    if (authLoading || !isAuthenticated || !user) return;
    let cancelled = false;
    (async () => {
      // Routage strict par onglet : un client qui se connecte via "Pro" est rejeté
      if (tab === "pro") {
        if (role === "admin") { navigate({ to: "/admin" }); return; }
        if (role !== "convoyeur") {
          await supabase.auth.signOut();
          if (!cancelled) {
            setError("Cet email correspond à un compte client. Utilisez l'onglet « Espace Client ».");
          }
          return;
        }
        const { data: conv } = await supabase
          .from("convoyeurs")
          .select("statut")
          .eq("user_id", user.id)
          .maybeSingle();
        if (cancelled) return;
        if (conv?.statut === "valide" || conv?.statut === "actif") {
          // /convoyeur existe déjà ; le futur /dashboard-convoyeur réutilisera ces routes
          navigate({ to: "/convoyeur" });
        } else {
          await supabase.auth.signOut();
          navigate({ to: "/attente-validation" });
        }
      } else {
        // Onglet client
        if (role === "admin") { navigate({ to: "/admin" }); return; }
        if (role === "convoyeur") {
          await supabase.auth.signOut();
          if (!cancelled) {
            setError("Cet email correspond à un compte convoyeur. Utilisez l'onglet « Espace Pro ».");
          }
          return;
        }
        navigate({ to: "/dashboard-client" });
      }
    })();
    return () => { cancelled = true; };
  }, [authLoading, isAuthenticated, role, user, navigate, tab, logout]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur de connexion";
      setError(msg.includes("Invalid") ? "Email ou mot de passe incorrect." : msg);
    } finally {
      setLoading(false);
    }
  };

  const inscriptionLink = tab === "pro" ? "/inscription-convoyeur" : "/inscription-client";
  const inscriptionLabel = tab === "pro" ? "Devenir convoyeur" : "Créer un compte client";

  return (
    <div className="min-h-screen flex items-center justify-center section-bg px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block mb-6">
            <img src={logoLigneo} alt="Transports Ligneo" className="h-14 w-auto mx-auto" />
          </Link>
          <div className="gold-divider-short mb-4" />
          <h1 className="font-heading text-2xl md:text-3xl tracking-[0.15em] uppercase text-primary">
            Connexion
          </h1>
          <p className="text-cream/50 mt-2 text-sm">Accédez à votre espace sécurisé</p>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-0 mb-0 rounded-t border border-primary/20 border-b-0 overflow-hidden">
          <button
            type="button"
            onClick={() => { setTab("client"); setError(""); }}
            className={`flex items-center justify-center gap-2 py-3 text-xs uppercase tracking-[0.15em] font-medium transition-all ${
              tab === "client"
                ? "bg-primary text-navy"
                : "bg-navy/40 text-cream/60 hover:text-primary"
            }`}
          >
            <User size={14} /> Espace Client
          </button>
          <button
            type="button"
            onClick={() => { setTab("pro"); setError(""); }}
            className={`flex items-center justify-center gap-2 py-3 text-xs uppercase tracking-[0.15em] font-medium transition-all ${
              tab === "pro"
                ? "bg-primary text-navy"
                : "bg-navy/40 text-cream/60 hover:text-primary"
            }`}
          >
            <Truck size={14} /> Espace Pro
          </button>
        </div>

        <form onSubmit={handleSubmit} className="card-premium p-7 rounded-t-none rounded-b space-y-5 border-t-0">
          {error && (
            <div className="p-3 rounded bg-destructive/15 border border-destructive/30 text-destructive text-sm">
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
              autoComplete="email"
              className="w-full bg-navy/60 border border-primary/20 rounded px-4 py-3 text-cream text-sm focus:border-primary/60 focus:outline-none transition-colors"
              placeholder={tab === "pro" ? "convoyeur@email.com" : "votre@email.com"}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs uppercase tracking-wider text-cream/50">Mot de passe</label>
              <Link
                to="/mot-de-passe-oublie"
                className="text-[10px] uppercase tracking-wider text-primary/80 hover:text-primary transition-colors"
              >
                Oublié ?
              </Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
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
              <><Loader2 size={16} className="animate-spin" />Connexion…</>
            ) : (
              <><LogIn size={16} />Se connecter</>
            )}
          </button>

          <div className="text-center pt-2 border-t border-primary/10">
            <Link to={inscriptionLink} className="text-primary text-xs hover:text-gold-light transition-colors uppercase tracking-[0.15em]">
              {inscriptionLabel} →
            </Link>
          </div>
        </form>

        <div className="text-center mt-6">
          <Link to="/" className="text-cream/40 text-xs hover:text-primary transition-colors">
            ← Retour au site
          </Link>
        </div>
      </div>
    </div>
  );
}
