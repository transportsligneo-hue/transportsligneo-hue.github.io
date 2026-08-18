import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Mail, CheckCircle, AlertCircle, Loader2, ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { subscribeNewsletter } from "@/lib/public-content.functions";
import { useRegistrationGate } from "@/hooks/useRegistrationGate";

export const Route = createFileRoute("/devenir-convoyeur")({
  component: DevenirConvoyeurPage,
  head: () => ({
    meta: [
      { title: "Réseau complet · Rejoindre Transports Ligneo" },
      { name: "description", content: "Le réseau de convoyeurs Transports Ligneo est actuellement complet. Laissez votre email pour être prévenu en priorité dès qu'une place se libère." },
      { property: "og:title", content: "Réseau complet · Transports Ligneo" },
      { property: "og:description", content: "Le réseau de convoyeurs Transports Ligneo est actuellement complet. Laissez votre email pour être prévenu en priorité." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function ArrowIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function DevenirConvoyeurPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const submit = useServerFn(subscribeNewsletter);
  const { gate, loading } = useRegistrationGate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    try {
      await submit({ data: { email: email.trim(), source: "convoyeur-waitlist" } });
      setStatus("success");
      setEmail("");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Une erreur est survenue. Veuillez réessayer.");
    }
  };

  return (
    <>
      <Navbar />
      <main className="dc-page">
        <div className="dc-wrap">
          <div className="dc-eyebrow"><span className="dot" />Réseau Ligneo</div>
          <h1>Notre réseau de convoyeurs est <span className="accent">complet</span>.</h1>
          <p className="dc-lead">
            Nous restons volontairement sélectifs pour garantir la qualité de service sur chaque mission.
            Laissez-nous votre email : nous vous recontactons en priorité dès qu'une place se libère ou que nos besoins évoluent.
          </p>

          <div className="dc-card">
            {status === "success" ? (
              <div className="dc-waitlist-success">
                <div className="dc-waitlist-success-icon">
                  <CheckCircle size={32} strokeWidth={2} />
                </div>
                <div className="dc-waitlist-success-title">Vous êtes enregistré(e)</div>
                <p className="dc-waitlist-success-text">
                  Nous vous recontacterons en priorité dès qu'une place se libère dans le réseau de convoyeurs Transports Ligneo.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="dc-waitlist-form" noValidate>
                <label htmlFor="waitlist-email" className="dc-waitlist-label">
                  Votre email
                </label>
                <div className="dc-waitlist-input-wrap">
                  <span className="dc-waitlist-input-icon" aria-hidden="true">
                    <Mail size={18} strokeWidth={2} />
                  </span>
                  <input
                    id="waitlist-email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="exemple@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="dc-waitlist-input"
                    disabled={status === "loading"}
                    required
                  />
                </div>
                {status === "error" && (
                  <div className="dc-waitlist-error" role="alert">
                    <AlertCircle size={16} strokeWidth={2} />
                    <span>{errorMsg}</span>
                  </div>
                )}
                <button
                  type="submit"
                  className="dc-btn-primary"
                  disabled={status === "loading" || !email.trim()}
                >
                  {status === "loading" ? (
                    <>
                      <Loader2 size={16} strokeWidth={2.5} className="animate-spin" />
                      Enregistrement…
                    </>
                  ) : (
                    <>
                      Être prévenu(e) en priorité <ArrowIcon size={14} />
                    </>
                  )}
                </button>
                <p className="dc-waitlist-disclaimer">
                  Enregistrement sans engagement. Vous pouvez vous désinscrire à tout moment.
                </p>
              </form>
            )}
          </div>

          <div className="dc-login-card">
            <div className="dc-login-left">
              <div className="dc-login-ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <rect x="5" y="11" width="14" height="9" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
              </div>
              <div className="dc-login-text">
                <b>Déjà convoyeur chez nous ?</b>Retrouvez votre espace et vos missions en cours
              </div>
            </div>
            <Link to="/login" className="dc-btn-login">
              Se connecter <ArrowIcon size={13} />
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
