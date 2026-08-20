import { createFileRoute, Link } from "@tanstack/react-router";
import Navbar from "@/components/Navbar";
import DevisGenerator from "@/components/DevisGenerator";
import MobileTarifsScreen from "@/components/mobile/MobileTarifsScreen";
import Footer from "@/components/Footer";

export const Route = createFileRoute("/tarifs")({
  component: TarifsPage,
  head: () => ({
    meta: [
      { title: "Tarifs & estimation · Transports Ligneo" },
      { name: "description", content: "Tarifs convoyage automobile transparents au départ de Tours (37). Péages, carburant et assurance inclus. Estimation immédiate en ligne." },
      { property: "og:title", content: "Tarifs & estimation · Transports Ligneo" },
      { property: "og:description", content: "Un tarif clair et juste. Devis instantané, aucun frais caché." },
      { property: "og:url", content: "https://transportsligneo.fr/tarifs" },
    ],
    links: [{ rel: "canonical", href: "https://transportsligneo.fr/tarifs" }],
  }),
});

function TarifsPage() {
  return (
    <>
      {/* Mobile · écran dédié navy */}
      <MobileTarifsScreen />

      {/* Desktop */}
      <div className="hidden md:block">
        <Navbar />
        <main className="r4-page">
          {/* ============ HERO ============ */}
          <section className="v4-hero">
          <div className="v4-hero-eyebrow" style={{ justifyContent: "center" }}>
            <span className="dot" />Tarifs
          </div>
          <h1 className="v4-h1">
            Un tarif <span className="v4-accent">clair et juste</span>.
          </h1>
          <p>Péages, carburant et assurance inclus. Aucun frais caché, devis instantané en ligne.</p>
        </section>

        {/* ============ ESTIMATEUR (quote-card style HTML) ============ */}
        <section className="v4-section" style={{ maxWidth: 720, paddingTop: 0 }}>
          <div className="v4-quote-card">
            <div className="v4-quote-inner">
              <DevisGenerator variant="hero-card" />
            </div>
          </div>
        </section>

        {/* ============ GRILLE TARIFAIRE RÉELLE ============ */}
        <section className="v4-section">
          <div className="v4-section-head">
            <div className="v4-hero-eyebrow" style={{ justifyContent: "center", width: "100%" }}>
              <span className="dot" />Nos tarifs
            </div>
            <h2>À partir de <span className="v4-accent">0,85 €/km</span></h2>
            <p>Hors département 37 et limitrophes, pour les trajets de plus de 200 km. Assurance tout risque, péage et carburant inclus. Tarifs TTC.</p>
          </div>

          <div className="v4-services-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
            <div className="v4-svc-card">
              <h3>Tours intra</h3>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--v4-border)" }}>
                <span style={{ color: "var(--v4-text-muted)", fontSize: 13 }}>Livraison simple</span>
                <span style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 700, color: "#6ea1ff" }}>79 €</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0" }}>
                <span style={{ color: "var(--v4-text-muted)", fontSize: 13 }}>Livraison + Restitution</span>
                <span style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 700, color: "#6ea1ff" }}>129 €</span>
              </div>
              <p style={{ marginTop: 10, fontSize: 11.5 }}>Assurance, péage &amp; carburant inclus · TTC</p>
            </div>

            <div className="v4-svc-card">
              <h3>Hors agglomération (37)</h3>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--v4-border)" }}>
                <span style={{ color: "var(--v4-text-muted)", fontSize: 13 }}>Livraison simple</span>
                <span style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 700, color: "#6ea1ff" }}>99 €</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0" }}>
                <span style={{ color: "var(--v4-text-muted)", fontSize: 13 }}>Livraison + Restitution</span>
                <span style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 700, color: "#6ea1ff" }}>129 €</span>
              </div>
              <p style={{ marginTop: 10, fontSize: 11.5 }}>Assurance, péage &amp; carburant inclus · TTC</p>
            </div>

            <div className="v4-svc-card">
              <h3>Options</h3>
              {[
                ["Livraison hors horaires / week-end / express (24h)", "+20 %"],
                ["Lavage intérieur", "Sur devis"],
                ["Lavage intérieur + extérieur", "Sur devis"],
                ["Stockage véhicules", "Sur devis"],
              ].map(([l, p]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--v4-border)", gap: 12 }}>
                  <span style={{ color: "var(--v4-text-muted)", fontSize: 13 }}>{l}</span>
                  <span className="v4-svc-tag" style={{ flexShrink: 0 }}>{p}</span>
                </div>
              ))}
            </div>

            <div className="v4-svc-card">
              <h3>Bon à savoir</h3>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, color: "var(--v4-text-muted)", fontSize: 13, lineHeight: 1.85 }}>
                <li>• Péages et carburant inclus pour le transport</li>
                <li>• Possibilité d'effectuer le plein (voir option)</li>
                <li>• Lavage extérieur offert dès 200 km livrés</li>
                <li>• Convoyeur attitré, tenue professionnelle</li>
                <li>• 0 annulation de notre part (hors force majeure)</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ============ CE QUI EST INCLUS ============ */}
        <section className="v4-section">
          <div className="v4-section-head">
            <div className="v4-hero-eyebrow" style={{ justifyContent: "center", width: "100%" }}>
              <span className="dot" />Transparence totale
            </div>
            <h2>Ce qui est toujours inclus</h2>
            <p>Aucune surprise à la livraison : le prix affiché est le prix final.</p>
          </div>
          <div className="v4-services-grid">
            {[
              { t: "Péages & carburant", d: "Inclus dans chaque devis, quelle que soit la distance parcourue.", p: "M12 2v20M17 7c0-2.2-2.2-4-5-4S7 4.8 7 7s2.2 3.4 5 4 5 1.8 5 4-2.2 4-5 4-5-1.8-5-4" },
              { t: "Assurance tous risques", d: "Chaque mission est couverte de bout en bout, sans supplément.", p: "M12 2l8 4v6c0 5-3.4 8.7-8 10-4.6-1.3-8-5-8-10V6z M9 12l2 2 4-4" },
              { t: "0 frais caché", d: "Le montant du devis est celui de la facture finale.", p: "M9 12l2 2 4-4 M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" },
              { t: "Devis instantané", d: "Un tarif clair et personnalisé en moins de 30 secondes.", p: "M13 2 3 14h7l-1 8 10-12h-7l1-8Z" },
              { t: "Convoyeur attitré", d: "Le même professionnel formé, en tenue, du départ à la livraison.", p: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0" },
              { t: "Suivi GPS temps réel", d: "Vous suivez votre véhicule à la minute près depuis votre espace.", p: "M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z M12 10.5v-.01" },
            ].map((c) => (
              <div key={c.t} className="v4-svc-card">
                <div className="v4-svc-ic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#8fb4ff" strokeWidth="2"><path d={c.p} /></svg>
                </div>
                <h3>{c.t}</h3>
                <p>{c.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ============ COMMENT EST CALCULÉ LE PRIX ============ */}
        <section className="v4-section">
          <div className="v4-section-head">
            <div className="v4-hero-eyebrow" style={{ justifyContent: "center", width: "100%" }}>
              <span className="dot" />Le détail
            </div>
            <h2>Comment est calculé votre prix</h2>
          </div>
          <div className="v4-services-grid">
            {[
              { t: "La distance", d: "Calculée automatiquement entre le lieu d'enlèvement et de livraison.", p: "M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z" },
              { t: "Le type de véhicule", d: "Citadine, berline, SUV ou utilitaire : chaque gabarit a son tarif dédié.", p: "M3 11l2-5h14l2 5 M5 11h14v6H5z" },
              { t: "Livraison simple ou avec restitution", d: "La restitution est proposée à un tarif préférentiel.", p: "M17 3v12M17 15l-4-4M17 15l4-4M7 21V9M7 9l4 4M7 9 3 13" },
              { t: "Le délai souhaité", d: "Une mission express (< 24h) applique un supplément de 20 %.", p: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M12 7v5l3 3" },
            ].map((c) => (
              <div key={c.t} className="v4-svc-card">
                <div className="v4-svc-ic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#8fb4ff" strokeWidth="2"><path d={c.p} /></svg>
                </div>
                <h3>{c.t}</h3>
                <p>{c.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ============ CTA ============ */}
        <div className="v4-cta-box">
          <div className="v4-hero-eyebrow" style={{ justifyContent: "center", width: "100%" }}>
            <span className="dot" />Une question sur un tarif ?
          </div>
          <h2>Parlez à un conseiller</h2>
          <p>Volume important, trajet particulier : nous adaptons le devis à votre besoin.</p>
          <Link to="/contact" className="v4-btn-primary">Contacter un conseiller</Link>
        </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
