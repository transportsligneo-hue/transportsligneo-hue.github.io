import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef, type FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, LogIn, User, Truck, Mail, Lock, Eye, EyeOff, ShieldCheck, ArrowRight } from "lucide-react";
import logoLigneo from "@/assets/logo-transports-ligneo-officiel.png";
import { getRecaptchaToken } from "@/lib/recaptcha";
import { verifyRecaptcha } from "@/lib/recaptcha.functions";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobileAppShell } from "@/components/mobile/MobileAppGate";


type Tab = "client" | "pro";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Connexion · Transports Ligneo" },
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
  const isMobileApp = useIsMobileAppShell();
  const [tab, setTab] = useState<Tab>(isMobileApp ? "pro" : "client");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("ligneo_remember") !== "false";
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const justLoggedInRef = useRef(false);
  const submittedTabRef = useRef<Tab>("client");

  useEffect(() => {
    if (isInitializing || isLoading || !isAuthenticated) return;
    if (!justLoggedInRef.current) { navigate({ to: homeRoute }); return; }
    const usedTab = submittedTabRef.current;
    justLoggedInRef.current = false;

    if (role === "admin" || role === "super_admin") { navigate({ to: "/admin" }); return; }
    if (usedTab === "pro") {
      if (role !== "convoyeur") {
        setError("Cet email correspond à un compte client. Utilisez l'onglet « Espace Client ».");
        void logout();
        return;
      }
      if (convoyeurStatut === "valide" || convoyeurStatut === "actif") navigate({ to: "/convoyeur" });
      else navigate({ to: "/attente-validation" });
      return;
    }
    if (role === "convoyeur") {
      setError("Cet email correspond à un compte convoyeur. Utilisez l'onglet « Espace Driver ».");
      void logout();
      return;
    }
    if (typeClient === "b2b") navigate({ to: "/dashboard-pro" });
    else navigate({ to: "/dashboard-client" });
  }, [isAuthenticated, isLoading, isInitializing, role, convoyeurStatut, typeClient, homeRoute, navigate, logout]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    submittedTabRef.current = tab;
    justLoggedInRef.current = true;
    try {
      try {
        localStorage.setItem("ligneo_remember", remember ? "true" : "false");
        sessionStorage.setItem("ligneo_tab_alive", "1");
      } catch { /* ignore */ }
      const TRANSIENT = new Set(["timeout-or-duplicate", "missing-input-response", "invalid-input-response", "network"]);
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
        await new Promise((r) => setTimeout(r, 400));
        verify = await tryVerify();
      }
      if (!verify.proceed && !verify.transient) {
        justLoggedInRef.current = false;
        setSubmitting(false);
        setError("Vérification de sécurité refusée. Si le problème persiste, contactez-nous.");
        return;
      }
      await login(email.trim(), password);
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
    if (!email.trim()) { setError("Saisissez votre email puis cliquez à nouveau sur « Renvoyer »."); return; }
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

  const awaitingRouting = justLoggedInRef.current && isAuthenticated && !isLoading;
  const loading = submitting || awaitingRouting;

  // Garde-fou : si la redirection n'aboutit pas (réseau lent, profil illisible),
  // on débloque le bouton au lieu de rester bloqué sur « Connexion… ».
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => {
      if (justLoggedInRef.current) {
        justLoggedInRef.current = false;
        setSubmitting(false);
        setError("Connexion établie mais l'espace met du temps à s'ouvrir. Réessayez ou rechargez la page.");
      }
    }, 15000);
    return () => clearTimeout(t);
  }, [loading]);


  return (
    <div className="auth-shell flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md auth-fade-in">
        <div className="text-center mb-6">
          <Link to="/" className="inline-block mb-4 relative auth-logo-pulse">
            <img src={logoLigneo} alt="Transports Ligneo" className="h-16 w-auto mx-auto drop-shadow-[0_8px_20px_rgba(59,130,246,0.45)] relative z-10" />
          </Link>
          <h1 className="auth-title text-2xl md:text-3xl">Connexion <span className="auth-accent">sécurisée</span></h1>
          <p className="auth-subtle text-sm mt-1.5">Accédez à votre espace en un clic</p>
        </div>

        <div className="auth-tabs mb-4">
          <button
            type="button"
            onClick={() => { setTab("client"); setError(""); }}
            className={`auth-tab ${tab === "client" ? "auth-tab-active" : ""}`}
          >
            <User size={13} /> Espace Client
          </button>
          <button
            type="button"
            onClick={() => { setTab("pro"); setError(""); }}
            className={`auth-tab ${tab === "pro" ? "auth-tab-active" : ""}`}
          >
            <Truck size={13} /> Espace Driver
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-card p-6 sm:p-7 space-y-5">
          {error === "EMAIL_NOT_CONFIRMED" ? (
            <div className="auth-alert auth-alert-info space-y-2">
              <p>Votre adresse email n'a pas encore été confirmée.</p>
              <button type="button" onClick={handleResendConfirmation} className="auth-link uppercase tracking-[0.14em] text-[11px]">
                → Renvoyer l'email de confirmation
              </button>
            </div>
          ) : error === "RESENT" ? (
            <div className="auth-alert auth-alert-success">
              Email de confirmation renvoyé. Vérifiez votre boîte (et vos spams).
            </div>
          ) : error ? (
            <div className="auth-alert auth-alert-error">{error}</div>
          ) : null}

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
                disabled={loading}
                className="auth-input"
                placeholder={tab === "pro" ? "convoyeur@email.com" : "votre@email.com"}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="auth-label mb-0">Mot de passe</label>
              <Link to="/mot-de-passe-oublie" className="auth-link uppercase tracking-[0.14em] text-[10px]">
                Oublié ?
              </Link>
            </div>
            <div className="auth-field">
              <Lock size={16} className="auth-field-icon" />
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={loading}
                className="auth-input pr-11"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
                aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                tabIndex={-1}
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-[12px] text-white/75 select-none cursor-pointer">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              disabled={loading}
              className="h-4 w-4 rounded border-white/25 bg-white/5 accent-blue-400 cursor-pointer"
            />
            <span>Rester connecté sur cet appareil</span>
          </label>

          <button type="submit" disabled={loading} className="auth-btn-primary">

            {loading ? (
              <><Loader2 size={16} className="animate-spin" />Connexion…</>
            ) : (
              <><LogIn size={16} />Se connecter</>
            )}
          </button>

          <div className="text-center pt-4 border-t border-white/10">
            <Link to="/choisir-compte" className="auth-link-lg is-gold">
              Créer un compte
              <ArrowRight size={14} className="arrow" />
            </Link>
          </div>
        </form>

        <div className="flex flex-col items-center gap-3 mt-6">
          <Link to="/" className="auth-link-lg">
            <ArrowRight size={14} className="arrow-back rotate-180" />
            Retour au site
          </Link>
          <p className="inline-flex items-center gap-1.5 text-[10px] leading-relaxed text-white/45 px-2 text-center">
            <ShieldCheck size={11} className="text-blue-300" />
            Protégé par reCAPTCHA ·{" "}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-200">Confidentialité</a>
            {" "}·{" "}
            <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-200">CGU</a>
          </p>
        </div>
      </div>
    </div>
  );
}
