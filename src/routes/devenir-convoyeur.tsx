import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const Route = createFileRoute("/devenir-convoyeur")({
  component: DevenirConvoyeurPage,
  head: () => ({
    meta: [
      { title: "Devenir convoyeur · Rejoindre le réseau Transports Ligneo" },
      { name: "description", content: "Conditions d'éligibilité pour rejoindre le réseau de convoyeurs Transports Ligneo : permis B, 21 ans, statut indépendant et RC Pro." },
      { property: "og:title", content: "Devenir convoyeur · Transports Ligneo" },
      { property: "og:description", content: "Vérifiez les conditions et rejoignez le réseau de convoyeurs Transports Ligneo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const CONDITIONS = [
  "Permis B valide depuis 3 ans minimum",
  "21 ans minimum",
  "Casier judiciaire vierge",
  "Statut auto-entrepreneur ou société (créé ou en cours)",
  "Attestation RC Pro couvrant l'activité de convoyage",
];

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

function ArrowIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function DevenirConvoyeurPage() {
  const navigate = useNavigate();

  return (
    <>
      <Navbar />
      <main className="dc-page">
        <div className="dc-wrap">
          <div className="dc-eyebrow"><span className="dot" />Réseau Ligneo</div>
          <h1>Devenir <span className="accent">convoyeur</span></h1>
          <p className="dc-lead">Avant de commencer, vérifiez que vous remplissez ces conditions.</p>

          <div className="dc-card">
            <div className="dc-card-title">Conditions d'éligibilité</div>
            {CONDITIONS.map((c) => (
              <div className="dc-cond" key={c}>
                <div className="dc-check"><CheckIcon /></div>
                <span>{c}</span>
              </div>
            ))}
            <div className="dc-divider" />
            <div className="dc-help">
              Pas encore d'assurance RC Pro ou de statut ? <Link to="/contact">Contactez-nous</Link>, on vous oriente.
            </div>
            <button
              type="button"
              className="dc-btn-primary"
              onClick={() => navigate({ to: "/inscription-convoyeur", search: {} })}
            >
              Je remplis les conditions <ArrowIcon />
            </button>
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
