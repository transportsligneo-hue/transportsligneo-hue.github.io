import { Link } from "@tanstack/react-router";
import DevisGenerator from "@/components/DevisGenerator";
import MapLigneo from "@/components/MapLigneo";
import AvisSection from "@/components/public/AvisSection";
import DerniersArticles from "@/components/public/DerniersArticles";
import FaqDynamique from "@/components/public/FaqDynamique";

import heroBg from "@/assets/hero-ligneo-night.jpg";
import logoCat from "@/assets/cat-group-new.jpeg.asset.json";
import logoTransak from "@/assets/transakauto-new.png.asset.json";


/**
 * Home Desktop V5 — reproduit fidèlement le HTML de référence
 * (accueil-desktop-refonte_3.html). Tout est scopé sous .r4-page pour
 * l'ambiance navy/or/électrique. Aucune section blanche.
 */
export default function HomeDesktopV5() {
  return (
    <div className="r4-page">
      {/* ============ HERO PHOTO + QUOTE ============ */}
      <section className="v5-hero">
        <div className="v5-hero-photo" style={{ backgroundImage: `url(${heroBg})` }} />
        <div className="v5-hero-tint" />
        <div className="v5-hero-glow" />
        <div className="v5-hero-fade" />

        <div className="v5-hero-grid">
          {/* Colonne gauche */}
          <div>
            <div className="v4-hero-eyebrow"><span className="dot" />Convoyage automobile · France &amp; Europe</div>
            <h1 className="v5-hero-h1">
              La tranquillité<br />sur <span className="v4-accent">toute la ligne</span>.
            </h1>
            <p className="v5-hero-lead">
              Transports Ligneo, spécialiste du convoyage automobile.
              Nous déplaçons votre véhicule avec rigueur, discrétion et passion,
              partout en France et en Europe.
            </p>
            <div className="v5-check-list">
              {["Réponse immédiate", "Assurance incluse", "Péages & carburant inclus", "Disponible 7j/7"].map((t) => (
                <div key={t}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="m5 13 4 4L19 7" /></svg>
                  {t}
                </div>
              ))}
            </div>
            <div className="v5-hero-actions">
              <Link to="/contact" className="hero-pill hero-pill-blue">Contact</Link>
              <Link to="/services" search={{ audience: "pro" }} className="hero-pill hero-pill-violet">
                Nos services B2B
              </Link>
              <Link to="/devenir-convoyeur" className="hero-pill hero-pill-green">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M8 11V7a4 4 0 0 1 8 0v4" /><rect x="5" y="11" width="14" height="9" rx="2" /></svg>
                Espace Driver
              </Link>
            </div>
          </div>

          {/* Colonne droite — estimateur en quote-card */}
          <div className="v4-quote-card">
            <div className="v4-quote-inner">
              <DevisGenerator variant="flat-mini" />
            </div>
          </div>
        </div>
      </section>

      {/* ============ HERO STATS ============ */}
      <section className="v5-hero-stats">
        {[
          { v: "5000+", l: "Véhicules convoyés" },
          { v: "6+ ans", l: "D'expérience" },
          { v: "100%", l: "Digitalisé" },
          { v: "7j/7", l: "Disponible" },
        ].map((s) => (
          <div key={s.l} className="v5-hstat">
            <div className="v">{s.v}</div>
            <div className="l">{s.l}</div>
          </div>
        ))}
      </section>

      {/* ============ MAP FRANCE + EUROPE ============ */}
      <MapLigneo size="big" />

      {/* ============ TRUST — Partenaires (marquee) ============ */}
      <section className="v5-trust">
        <div className="v5-trust-label">Ils nous font confiance</div>
        <div className="v5-trust-sub">Partenaires & clients de référence</div>
        <div className="v5-marquee-mask">
          <div className="v5-marquee-track">
            {Array.from({ length: 8 }).flatMap((_, i) => [
              <div key={`c-${i}`} className="v5-logo-item"><img src={logoCat.url} alt="Groupe CAT" /></div>,
              <div key={`t-${i}`} className="v5-logo-item"><img src={logoTransak.url} alt="TransakAuto" /></div>,
            ])}
          </div>
        </div>
      </section>


      {/* ============ POURQUOI NOUS CHOISIR ============ */}
      <section className="v4-section">
        <div className="v4-section-head">
          <div className="v4-hero-eyebrow" style={{ justifyContent: "center", width: "100%" }}>
            <span className="dot" />Notre signature
          </div>
          <h2>Pourquoi nous choisir</h2>
          <p>Des engagements concrets pour un service d'exception.</p>
        </div>
        <div className="v5-feat-grid">
          {[
            { t: "Fiabilité garantie", d: "0 annulation de notre part. Chaque mission est assurée et suivie de bout en bout.", p: "M12 2l8 4v6c0 5-3.4 8.7-8 10-4.6-1.3-8-5-8-10V6z M9 12l2 2 4-4" },
            { t: "Rapidité d'exécution", d: "Prise en charge possible en moins de 24h selon la distance et la disponibilité.", p: "M13 2 3 14h7l-1 8 10-12h-7l1-8Z" },
            { t: "Tarifs transparents", d: "Péages et carburant inclus. Aucun frais caché, devis instantané en ligne.", p: "M12 2v20M17 7c0-2.2-2.2-4-5-4S7 4.8 7 7s2.2 3.4 5 4 5 1.8 5 4-2.2 4-5 4-5-1.8-5-4" },
            { t: "Convoyeurs professionnels", d: "Équipe de convoyeurs professionnels indépendants, formée en continu. Tenue professionnelle obligatoire.", p: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0" },
            { t: "+6 ans d'expérience", d: "Un savoir-faire éprouvé auprès de concessionnaires, loueurs et particuliers.", p: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M12 7v5l3 3" },
            { t: "Disponible 7j/7", d: "Un interlocuteur dédié pour répondre à vos besoins à tout moment.", p: "M4 4h3l2 5-2 1a11 11 0 0 0 6 6l1-2 5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 2 6a2 2 0 0 1 2-2Z" },
          ].map((c) => (
            <div key={c.t} className="v5-feat-card">
              <div className="v5-feat-ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="#8fb4ff" strokeWidth="2"><path d={c.p} /></svg>
              </div>
              <h4>{c.t}</h4>
              <p>{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ NOTRE PROCESS (teaser 3 étapes) ============ */}
      <section className="v4-section">
        <div className="v4-section-head">
          <div className="v4-hero-eyebrow" style={{ justifyContent: "center", width: "100%" }}>
            <span className="dot" />Notre process
          </div>
          <h2>Un service simple, rapide et sécurisé</h2>
        </div>
        <div className="v5-teaser-grid">
          <div className="v5-teaser-card">
            <div className="v5-teaser-num">01</div>
            <h4>Estimez votre trajet</h4>
            <p>Départ, arrivée, véhicule et date. Recevez un tarif clair en quelques secondes.</p>
          </div>
          <div className="v5-teaser-card">
            <div className="v5-teaser-num">02</div>
            <h4>Validez votre demande</h4>
            <p>Tarif tout inclus, sans engagement. Confirmez en quelques clics.</p>
          </div>
          <div className="v5-teaser-card">
            <div className="v5-teaser-num">03</div>
            <h4>Votre véhicule est livré</h4>
            <p>Un convoyeur professionnel prend en charge votre véhicule et vous informe jusqu'à la livraison.</p>
          </div>
        </div>
        <div className="v5-teaser-cta">
          <Link to="/comment-ca-marche" className="v4-btn-outline">Voir les étapes en détail →</Link>
        </div>
      </section>

      {/* ============ AVIS CLIENTS ============ */}
      <AvisSection />

      {/* ============ ACTUALITÉS ============ */}
      <DerniersArticles />

      {/* ============ FAQ ============ */}
      <FaqDynamique />

      {/* ============ CTA FINALE ============ */}
      <div className="v4-cta-box">
        <div className="v4-hero-eyebrow" style={{ justifyContent: "center", width: "100%" }}>
          <span className="dot" />Prêt à démarrer ?
        </div>
        <h2>Estimez votre convoyage dès maintenant</h2>
        <p>Devis instantané, sans engagement. Réponse en moins de 30 secondes.</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link to="/tarifs" className="v4-btn-primary">Estimer mon trajet</Link>
          <Link to="/suivi" className="v4-btn-outline">Suivre ma mission</Link>
        </div>
      </div>
    </div>
  );
}
