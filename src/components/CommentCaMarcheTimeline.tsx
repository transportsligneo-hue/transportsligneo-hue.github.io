/**
 * Comment ça marche · refonte V5 exactement calquée sur le HTML
 * `comment-ca-marche-refonte.html` : hero + timeline 4 phases (12 sous-étapes)
 * + section plateforme + stats + CTA. Tout est scopé sous .r4-page.
 */
import { Link } from "@tanstack/react-router";

const phases = [
  {
    n: "01",
    tag: "Étape 1",
    title: "Estimation & Devis",
    p: "Le client crée son compte ou lance directement une estimation · le compte se crée automatiquement à cette occasion. Le devis est généré et signé électroniquement, sans attendre.",
    subs: [
      "Création de compte",
      "Estimateur intelligent",
      "Devis automatique",
      "Signature électronique",
    ],
  },
  {
    n: "02",
    tag: "Étape 2",
    title: "Validation interne",
    p: "Notre équipe réceptionne le devis signé et contrôle la cohérence de la mission avant de la mettre en production.",
    subs: ["Réception admin", "Validation exploitation"],
  },
  {
    n: "03",
    tag: "Étape 3",
    title: "Convoyage",
    p: "Un convoyeur certifié est attribué selon la zone et la disponibilité. Le client suit son véhicule en direct jusqu'à la livraison.",
    subs: ["Attribution convoyeur", "Suivi GPS temps réel", "Livraison ponctuelle"],
  },
  {
    n: "04",
    tag: "Étape 4",
    title: "Clôture & Facturation",
    p: "État des lieux signé à la livraison, facture générée automatiquement, tout est archivé et consultable en un clic.",
    subs: ["État des lieux signé", "Facturation automatique", "Historique centralisé"],
  },
];

const platformFeatures = [
  {
    t: "Tableau de bord",
    d: "Véhicules disponibles, en convoyage, missions en cours, terminées et à venir. Statistiques d'activité en temps réel.",
    svg: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  },
  {
    t: "Gestion de flotte",
    d: "Centralisez tous vos véhicules, suivez les convoyages et pilotez votre parc depuis un seul écran.",
    svg: <><path d="M3 11l2-5h14l2 5" /><path d="M5 11h14v6H5z" /><circle cx="8" cy="19" r="1.5" /><circle cx="16" cy="19" r="1.5" /></>,
  },
  {
    t: "Historique complet",
    d: "Toutes les missions, trajets, départs, arrivées, dates, convoyeurs et états des lieux archivés.",
    svg: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
  },
  {
    t: "Documents centralisés",
    d: "Devis, factures, EDL, signatures, photos et historiques accessibles depuis un espace unique.",
    svg: <><path d="M6 3h9l3 3v15H6z" /><path d="M9 9h6M9 13h6M9 17h4" /></>,
  },
  {
    t: "Suivi temps réel",
    d: "Avancement des missions, étapes franchies, horaires, statuts et notifications instantanées.",
    svg: <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />,
  },
  {
    t: "Alertes & sécurité",
    d: "Alertes administratives, signature électronique probante et traçabilité complète des actions.",
    svg: <><path d="M12 2l8 4v6c0 5-3.4 8.7-8 10-4.6-1.3-8-5-8-10V6z" /><path d="m9 12 2 2 4-4" /></>,
  },
];

export default function CommentCaMarcheTimeline() {
  return (
    <div className="r4-page">
      {/* ============ HERO ============ */}
      <section className="v4-hero" style={{ paddingBottom: 40 }}>
        <div className="v4-hero-eyebrow" style={{ justifyContent: "center" }}>
          <span className="dot" />Notre process
        </div>
        <h1 className="v4-h1">
          Comment <span className="v4-accent">ça marche</span>
        </h1>
        <p>
          De la création de compte à la facture : <b className="text-[#2F5FFF]">4 grandes étapes</b>, 12 actions précises, 100 % digitalisées.
        </p>
        <div style={{ marginTop: 12 }}>
          <span className="v5-platform-pill">⚡ Plateforme digitale nouvelle génération</span>
        </div>
      </section>

      {/* ============ TIMELINE 4 PHASES ============ */}
      <section className="v5-timeline">
        <div className="v5-timeline-track" />
        <div className="v5-timeline-dot" />
        {phases.map((phase) => (
          <div key={phase.n} className="v5-step">
            <div className="v5-step-num">
              <div className="n">{phase.n}</div>
              <div className="lbl">Phase</div>
            </div>
            <div className="v5-step-body">
              <div className="v5-phase-tag">{phase.tag}</div>
              <h3>{phase.title}</h3>
              <p>{phase.p}</p>
              <div className="v5-substeps">
                {phase.subs.map((s, i) => (
                  <div key={s} className="v5-substep">
                    <span className="idx">{
                      // numéro global : 4 + 2 + 3 + 3 cumul
                      phase.n === "01" ? i + 1
                      : phase.n === "02" ? i + 5
                      : phase.n === "03" ? i + 7
                      : i + 10
                    }</span>{s}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* ============ PLATEFORME COMPLÈTE ============ */}
      <section className="v4-section">
        <div className="v4-section-head">
          <div className="v4-hero-eyebrow" style={{ justifyContent: "center", width: "100%" }}>
            <span className="dot" />Plateforme complète
          </div>
          <h2>Gérez votre flotte en toute simplicité</h2>
          <p>
            Bien plus qu'un service de convoyage : une véritable plateforme
            digitale pour piloter votre parc, vos missions et vos documents
            depuis un seul espace.
          </p>
        </div>
        <div className="v5-feat-grid">
          {platformFeatures.map((f) => (
            <div key={f.t} className="v5-feat-card">
              <div className="v5-feat-ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="#8fb4ff" strokeWidth="2">{f.svg}</svg>
              </div>
              <h4>{f.t}</h4>
              <p>{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ STATS ============ */}
      <section className="v4-stats-row">
        {[
          { v: "100%", l: "Digitalisé" },
          { v: "7j/7", l: "Disponible" },
          { v: "0", l: "Annulation" },
        ].map((s) => (
          <div key={s.l} className="v4-stat">
            <div className="v">{s.v}</div>
            <div className="l">{s.l}</div>
          </div>
        ))}
      </section>

      {/* ============ CTA FINALE ============ */}
      <div className="v4-cta-box">
        <div className="v4-hero-eyebrow" style={{ justifyContent: "center", width: "100%" }}>
          <span className="dot" />Prêt à démarrer ?
        </div>
        <h2>Prêt à simplifier la gestion de vos véhicules ?</h2>
        <p>Obtenez un devis en 30 secondes ou parlez directement à un conseiller. Sans engagement.</p>
        <div className="v5-cta-buttons">
          <Link to="/tarifs" className="v4-btn-primary">Demander un devis</Link>
          <Link to="/contact" className="v4-btn-outline">Contacter un conseiller</Link>
        </div>
        <div className="v5-trust-row">
          <span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l8 4v6c0 5-3.4 8.7-8 10-4.6-1.3-8-5-8-10V6z" /></svg>
            Assurance incluse
          </span>
          <span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>
            Disponible 7j/7
          </span>
          <span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 12 2 2 4-4" /><circle cx="12" cy="12" r="9" /></svg>
            0 annulation
          </span>
        </div>
      </div>
    </div>
  );
}
