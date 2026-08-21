import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";

type Slide = {
  label: string;
  title: string;
  desc: string;
  features: string[];
  icon: ReactNode;
};

const SLIDES: Slide[] = [
  {
    label: "Position GPS en direct",
    title: "Un suivi transparent, à chaque étape",
    desc: "De l'enlèvement à la livraison, suivez votre véhicule en temps réel depuis votre espace client, sans avoir à appeler pour prendre des nouvelles.",
    features: ["Position GPS en direct", "Trajet visible en continu", "Historique complet du parcours"],
    icon: (
      <>
        <path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21z" />
        <circle cx="12" cy="9.5" r="2.6" />
      </>
    ),
  },
  {
    label: "Notifications à chaque étape clé",
    title: "Informé sans avoir à demander",
    desc: "Prise en charge, départ, arrivée : une notification vous prévient automatiquement à chaque étape clé du convoyage.",
    features: ["Alerte à la prise en charge", "Alerte à la livraison", "Notification en cas d'imprévu"],
    icon: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </>
    ),
  },
  {
    label: "Contact direct et rapide avec un conseiller",
    title: "Un conseiller dédié, joignable directement",
    desc: "Une question sur votre mission ? Vous échangez directement avec votre conseiller Ligneo, sans standard ni attente.",
    features: ["Interlocuteur unique sur votre dossier", "Réponse rapide, sans intermédiaire", "Suivi personnalisé de bout en bout"],
    icon: (
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.99.36 1.96.68 2.89a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.19-1.19a2 2 0 0 1 2.11-.45c.93.32 1.9.55 2.89.68A2 2 0 0 1 22 16.92z" />
    ),
  },
  {
    label: "Signature digitalisée",
    title: "Une prise en charge 100% dématérialisée",
    desc: "Le client signe l'état des lieux directement depuis l'application, sans papier, avec un horodatage certifié.",
    features: ["Signature à l'écran, prise et remise", "Horodatage certifié", "Archivage automatique du document"],
    icon: (
      <>
        <path d="M4 20h16" />
        <path d="M8.5 15.5L18 6l-3-3-9.5 9.5L4 16z" />
      </>
    ),
  },
  {
    label: "États des lieux photo",
    title: "Un rapport photo complet à chaque mission",
    desc: "Chaque prise en charge et chaque livraison génère un état des lieux photo, disponible immédiatement dans votre espace client.",
    features: ["Photos horodatées du véhicule", "Rapport consultable en ligne", "Preuve en cas de litige"],
    icon: (
      <>
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </>
    ),
  },
  {
    label: "Scan OCR & documents",
    title: "Vos documents reconnus et classés automatiquement",
    desc: "Carte grise, permis, bon de commande : nos outils scannent et reconnaissent vos documents pour accélérer chaque mission.",
    features: ["Reconnaissance automatique des documents", "Moins de saisie manuelle", "Dossier de mission centralisé"],
    icon: (
      <>
        <path d="M4 7V4h3" />
        <path d="M17 4h3v3" />
        <path d="M20 17v3h-3" />
        <path d="M7 20H4v-3" />
        <path d="M4 12h16" />
      </>
    ),
  },
  {
    label: "Ligne dédiée 7j/7",
    title: "Une assistance disponible tous les jours",
    desc: "Notre ligne dédiée reste joignable 7 jours sur 7 pour répondre à toute question avant, pendant ou après votre convoyage.",
    features: ["Assistance disponible 7j/7", "Prise en charge rapide des demandes", "Un service pensé pour la tranquillité"],
    icon: (
      <>
        <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
        <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
      </>
    ),
  },
];

export default function ServicesGarantiesCarousel() {
  const [current, setCurrent] = useState(0);
  const [fading, setFading] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const goTo = (i: number) => {
    setFading(true);
    setTimeout(() => {
      setCurrent(((i % SLIDES.length) + SLIDES.length) % SLIDES.length);
      setFading(false);
    }, 220);
    restart();
  };

  const restart = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setCurrent((c) => (c + 1) % SLIDES.length);
        setFading(false);
      }, 220);
    }, 5000);
  };

  useEffect(() => {
    restart();
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const s = SLIDES[current];

  return (
    <section className="sg-carousel-section">
      <div className="sg-stage">
        <div className="sg-eyebrow">
          <span className="sg-dot" />
          <span>Nos garanties</span>
        </div>
        <h2 className="sg-h1">
          <span className="sg-h1-white">Un convoyage suivi</span>
          <span className="sg-h1-comma">, </span>
          <em className="sg-h1-blue">de bout en bout</em>
        </h2>

        <div className="sg-panel">
          <div className="sg-visual">
            <div className="sg-icon-glow" />
            <div className={`sg-icon-wrap ${fading ? "sg-fade" : ""}`}>
              <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                {s.icon}
              </svg>
            </div>
            <div className={`sg-visual-label ${fading ? "sg-fade" : ""}`}>{s.label}</div>
          </div>

          <div className="sg-content">
            <h3 className={`sg-content-title ${fading ? "sg-fade" : ""}`}>{s.title}</h3>
            <p className={`sg-content-desc ${fading ? "sg-fade" : ""}`}>{s.desc}</p>
            <ul className={`sg-feature-list ${fading ? "sg-fade" : ""}`}>
              {s.features.map((f) => (
                <li key={f}>
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="sg-nav-row">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              className={`sg-dot-btn ${i <= current ? "sg-done" : ""}`}
              onClick={() => goTo(i)}
              aria-label={`Aller à la garantie ${i + 1}`}
            >
              <span className="sg-fill" />
            </button>
          ))}
        </div>

        <div className="sg-arrows">
          <button className="sg-arrow-btn" onClick={() => goTo(current - 1)} aria-label="Précédent">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button className="sg-arrow-btn" onClick={() => goTo(current + 1)} aria-label="Suivant">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>

        <div className="sg-cta-block">
          <div className="sg-cta-eyebrow">Un besoin spécifique ?</div>
          <div className="sg-cta-title">Parlons de votre projet de convoyage</div>
          <p className="sg-cta-sub">Particulier, concession, loueur ou gestionnaire de flotte : nous avons une solution adaptée.</p>
          <Link to="/contact" className="sg-cta-btn">
            Contacter un conseiller
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="M13 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
