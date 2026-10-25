import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import R4Hero from "@/components/marketing/R4Hero";
import { TRAJETS_VILLES, getTrajet } from "@/lib/trajets-seo";

export const Route = createFileRoute("/convoyage/")({
  component: TrajetsHub,
  head: () => ({
    meta: [
      { title: "Trajets de convoyage depuis et vers Tours · Transports Ligneo" },
      { name: "description", content: "Convoyage de véhicule depuis et vers Tours : Paris, Nantes, Bordeaux, Lyon… Prix dès X € TTC, assurance, carburant et péages inclus, livraison avec photos." },
    ],
    links: [{ rel: "canonical", href: "https://transportsligneo.fr/convoyage" }],
  }),
});

function TrajetsHub() {
  return (
    <>
      <Navbar />
      <main className="r4-page" data-audience="pro">
        <R4Hero
          eyebrow="Trajets"
          title={<>Nos trajets de <span className="v4-accent">convoyage</span></>}
          subtitle="Au départ ou à l'arrivée de Tours. Prix indicatif dès, assurance, carburant et péages inclus. Livraison prouvée par photos."
        >
          <Link to="/tarifs" hash="devis" className="v4-btn-primary">Obtenir mon devis</Link>
        </R4Hero>
        <section className="v4-section">
          <div className="hx-benefits hx-benefits--3">
            {TRAJETS_VILLES.flatMap((v) => [`tours-${v.slug}`, `${v.slug}-tours`]).map((slug) => {
              const t = getTrajet(slug)!;
              return (
                <Link key={slug} to="/convoyage/$slug" params={{ slug }} className="hx-benefit" style={{ textDecoration: "none" }}>
                  <h3>{t.depart} → {t.arrivee}</h3>
                  <p>≈ {t.km} km · {t.dureeLabel}</p>
                  <p style={{ fontWeight: 700 }}>dès {t.prixDepuis} € TTC <ArrowRight size={14} style={{ display: "inline" }} /></p>
                </Link>
              );
            })}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
