import { Link } from "@tanstack/react-router";
import { Check, ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import R4Hero from "@/components/marketing/R4Hero";

interface Props {
  eyebrow: string;
  title: string;
  accent: string;
  subtitle: string;
  benefits: Array<{ t: string; d: string }>;
  highlight?: { t: string; d: string; to: string; label: string };
}

export default function ProfilMetierPage({ eyebrow, title, accent, subtitle, benefits, highlight }: Props) {
  return (
    <>
      <Navbar />
      <main className="r4-page">
        <R4Hero eyebrow={eyebrow} title={<>{title} <span className="v4-accent">{accent}</span></>} subtitle={subtitle}>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/tarifs" hash="devis" className="v4-btn-primary">Obtenir mon devis</Link>
            <Link to="/contact" className="v4-btn-outline">Parler à un conseiller</Link>
          </div>
        </R4Hero>
        <section className="v4-section">
          <div className="hx-benefits hx-benefits--3">
            {benefits.map((b) => (
              <div key={b.t} className="hx-benefit">
                <span className="hx-benefit-ic"><Check size={20} /></span>
                <h3>{b.t}</h3>
                <p>{b.d}</p>
              </div>
            ))}
          </div>
          {highlight && (
            <div className="v4-cta-box" style={{ marginTop: 48 }}>
              <h2>{highlight.t}</h2>
              <p>{highlight.d}</p>
              <Link to={highlight.to} className="v4-btn-primary inline-flex items-center gap-2">
                {highlight.label} <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
