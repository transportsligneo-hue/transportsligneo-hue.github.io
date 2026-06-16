import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef, type FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, LogIn, User, Truck } from "lucide-react";
import logoLigneo from "@/assets/logo-transports-ligneo-officiel.png";
import { getRecaptchaToken } from "@/lib/recaptcha";
import { verifyRecaptcha } from "@/lib/recaptcha.functions";

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
  const {
    login,
    logout,
    isAuthenticated,
    isLoading,
    isInitializing,
    role,
    convoyeurStatut,
    typeClient,
    homeRoute,
  } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("client");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  /** True quand on vient de soumettre — déclenche la logique de routage post-login */
  const justLoggedInRef = useRef(false);
  /** Onglet utilisé au moment du submit (figé pour éviter qu'un changement de tab casse la redirection) */
  const submittedTabRef = useRef<Tab>("client");

  useEffect(() => {
    // On attend que l'auth soit complètement hydratée (role + profile + statut)
    if (isInitializing || isLoading || !isAuthenticated) return;

    // Si l'utilisateur est déjà authentifié à l'arrivée sur la page (pas de submit en cours),
    // on le renvoie directement vers son espace.
    if (!justLoggedInRef.current) {
      navigate({ to: homeRoute });
      return;
    }

    // Routage strict par onglet après un login volontaire
    const usedTab = submittedTabRef.current;
    justLoggedInRef.current = false;

    if (role === "admin" || role === "super_admin") {
      navigate({ to: "/admin" });
      return;
    }

    if (usedTab === "pro") {
      if (role !== "convoyeur") {
        setError("Cet email correspond à un compte client. Utilisez l'onglet « Espace Client ».");
        void logout();
        return;
      }
      if (convoyeurStatut === "valide" || convoyeurStatut === "actif") {
        navigate({ to: "/convoyeur" });
      } else {
        navigate({ to: "/attente-validation" });
      }
      return;
    }

    // Onglet client
    if (role === "convoyeur") {
      setError("Cet email correspond à un compte convoyeur. Utilisez l'onglet « Espace Driver ».");
      void logout();
      return;
    }
    if (typeClient === "b2b") {
      navigate({ to: "/dashboard-pro" });
    } else {
      navigate({ to: "/dashboard-client" });
    }
  }, [
    isAuthenticated,
    isLoading,
    isInitializing,
    role,
    convoyeurStatut,
    typeClient,
    homeRoute,
    navigate,
    logout,
  ]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    submittedTabRef.current = tab;
    justLoggedInRef.current = true;
    try {
      // reCAPTCHA v3 — best-effort, avec retry transparent.
      // Un token expire ~2 min ; en cas d'échec on régénère un token frais
      // une seconde fois. Les erreurs transitoires (timeout-or-duplicate,
      // réseau) ne doivent JAMAIS bloquer le login : Supabase a déjà sa propre
      // protection anti brute-force côté serveur.
      const TRANSIENT = new Set([
        "timeout-or-duplicate",
        "missing-input-response",
        "invalid-input-response",
        "network",
      ]);
      const tryVerify = async () => {
        const token = await getRecaptchaToken("login");
        if (!token) return { proceed: true } as const;
        try {
          const r = await verifyRecaptcha({ data: { token, action: "login", minScore: 0.3 } });
          if (r.ok || r.skipped) return { proceed: true } as const;
          const transient = (r.errors ?? []).some((e: string) => TRANSIENT.has(e));
          return { proceed: false, transient } as const;
        } catch {
          return { proceed: false, transient: true } as const;
        }
      };
      let verify = await tryVerify();
      if (!verify.proceed && verify.transient) {
        // Token expiré / réseau — on retente avec un token frais
        await new Promise((r) => setTimeout(r, 400));
        verify = await tryVerify();
      }
      if (!verify.proceed && !verify.transient) {
        justLoggedInRef.current = false;
        setSubmitting(false);
        setError("Vérification de sécurité refusée. Si le problème persiste, contactez-nous.");
        return;
      }
      // Erreur transitoire persistante → on poursuit (best-effort).
      await login(email.trim(), password);
      // Le useEffect prendra le relais une fois l'auth hydratée
    } catch (err: unknown) {
      justLoggedInRef.current = false;
      const msg = err instanceof Error ? err.message : "Erreur de connexion";
      if (msg.toLowerCase().includes("email not confirmed") || msg.toLowerCase().includes("not confirmed")) {
        setError("EMAIL_NOT_CONFIRMED");
      } else {
        setError(msg.includes("Invalid") ? "Email ou mot de passe incorrect." : msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!email.trim()) {
      setError("Saisissez votre email puis cliquez à nouveau sur « Renvoyer ».");
      return;
    }
    try {
      const { error: rErr } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/email-confirmation` },
      });
      if (rErr) throw rErr;
      setError("RESENT");
    } catch (e: any) {
      setError(e?.message || "Impossible de renvoyer l'email.");
    }
  };

  const inscriptionLink = "/choisir-compte";
  const inscriptionLabel = "Créer un compte";
  /** True tant qu'on attend l'hydratation post-login */
  const awaitingRouting = justLoggedInRef.current && isAuthenticated && !isLoading;
  const loading = submitting || awaitingRouting;

  return (
    <div className="min-h-screen flex items-center justify-center section-bg px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block mb-6">
            <img src={logoLigneo} alt="Transports Ligneo" className="h-20 w-auto mx-auto" />
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
            <Truck size={14} /> Espace Driver
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
              disabled={loading}
              className="w-full bg-navy/60 border border-primary/20 rounded px-4 py-3 text-cream text-sm focus:border-primary/60 focus:outline-none transition-colors disabled:opacity-60"
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
              disabled={loading}
              className="w-full bg-navy/60 border border-primary/20 rounded px-4 py-3 text-cream text-sm focus:border-primary/60 focus:outline-none transition-colors disabled:opacity-60"
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

        <div className="text-center mt-6 space-y-3">
          <p className="text-[10px] leading-relaxed text-cream/40 px-2">
            Protégé par reCAPTCHA et soumis à la{" "}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">Politique de Confidentialité</a>
            {" "}et aux{" "}
            <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">Termes d'Utilisation</a>
            {" "}de Google.
          </p>
          <Link to="/" className="block text-cream/40 text-xs hover:text-primary transition-colors">
            ← Retour au site
          </Link>
        </div>
      </div>
    </div>
  );
}
