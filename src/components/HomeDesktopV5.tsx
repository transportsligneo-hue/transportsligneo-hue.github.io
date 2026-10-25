import { DemoRequestButton } from "@/components/marketing/DemoRequestButton";
import { Link } from "@tanstack/react-router";
import {
  MapPin, ShieldCheck, ScanLine, PenLine, FolderOpen, User, BriefcaseBusiness, CarFront, House,
  KeyRound, Truck, BarChart3, ArrowRight, Phone,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import DevisGenerator from "@/components/DevisGenerator";
import ParcoursMetier from "@/components/ParcoursMetier";
import AvisSection from "@/components/public/AvisSection";
import DerniersArticles from "@/components/public/DerniersArticles";
import FaqDynamique from "@/components/public/FaqDynamique";
import { scrollToDevis } from "@/lib/scroll-to-devis";

import heroDark from "@/assets/hero-ligneo-coucher.jpg";
import heroLight from "@/assets/hero-ligneo-utilitaire.jpg";
import logoCat from "@/assets/cat-group-new.jpeg.asset.json";
import logoTransak from "@/assets/transakauto-new.png.asset.json";

const goDevis = () => { scrollToDevis(); };

/** Petit éclat lumineux au clic sur les raccourcis du héros (la couleur vient de --hx-c). */
const lit = (e: React.MouseEvent<HTMLElement>) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>(".hx-q");
  if (!el) return;
  el.classList.remove("hx-lit");
  void el.offsetWidth;
  el.classList.add("hx-lit");
  window.setTimeout(() => el.classList.remove("hx-lit"), 900);
};

export default function HomeDesktopV5() {
  const { isAuthenticated, homeRoute } = useAuth();
  return (
    <div className="r4-page">
      {/* ============ HERO ============ */}
      <section className="v5-hero v5-hero--bright">
        <div
          className="v5-hero-photo"
          style={{
            backgroundImage: `url(${heroDark})`,
            ["--hero-dark" as string]: `url(${heroDark})`,
            ["--hero-light" as string]: `url(${heroLight})`,
          }}
        />
        <div className="v5-hero-tint" />
        <div className="v5-hero-fade" />

        <div className="v5-hero-grid">
          <div>
            <div className="v4-hero-eyebrow"><span className="dot" />Transports Ligneo · Convoyage et logistique automobile</div>
            <h1 className="v5-hero-h1 hx-title">
              Votre véhicule doit aller quelque part ?{" "}
              <span className="v4-accent">Ligneo s'occupe du reste.</span>
            </h1>
            <p className="hx-sub">
              Convoyage et logistique automobile France &amp; Europe · Assurance, carburant et péage inclus · Suivi GPS · État des lieux
            </p>

            <div className="hx-quick" onClickCapture={lit}>
              <Link to="/devenir-convoyeur" className="hx-q hx-q-conv">
                <span className="hx-q-label">Je suis convoyeur</span>
              </Link>
              <Link to="/suivi" className="hx-q hx-q-suiv">
                <span className="hx-q-label">Suivre mon véhicule</span>
              </Link>
              <Link to="/contact" className="hx-q hx-q-contact" aria-label="Contact · Transports Ligneo">
                <span className="hx-q-label">Contact</span>
              </Link>
              <DemoRequestButton className="hx-q hx-q-demo" />
            </div>
          </div>

          <div id="devis" className="v5-hero-quote scroll-mt-32">
            <DevisGenerator variant="flat-mini" />
          </div>
        </div>
      </section>

      {/* ============ BÉNÉFICES + PARCOURS + CARTE ============ */}
      <section className="v4-section mx-sec">
        <div className="mx-wrap">
          <div className="v4-section-head mx-benefits-head">
            <h2>Un convoyage sans stress, <span className="hx-neon">du départ à l'arrivée</span></h2>
          </div>
          <div className="hx-benefits mx-benefits">
            {[
              { I: MapPin, t: "Suivi GPS", d: "Vous savez où est votre véhicule, à tout moment." },
              { I: ShieldCheck, t: "Assurance incluse", d: "Votre véhicule est couvert pendant tout le trajet." },
              { I: ScanLine, t: "État des lieux 360°", d: "Photos horodatées au départ et à l'arrivée." },
              { I: PenLine, t: "Signature électronique", d: "Remise validée en un geste, sans papier." },
              { I: FolderOpen, t: "Documents centralisés", d: "Devis, PV et factures réunis au même endroit." },
            ].map(({ I, t, d }) => (
              <div key={t} className="hx-benefit">
                <span className="hx-benefit-ic"><I size={20} /></span>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>

          <div className="v4-section-head mx-head">
            <div className="v4-hero-eyebrow"><span className="dot" />Vous êtes…</div>
            <h2>Un parcours <span className="hx-neon">pensé pour votre métier</span></h2>
          </div>
          <ParcoursMetier />
        </div>
      </section>

      <AvisSection />

      <section className="v4-section">
        <div className="hx-figures">
          {[
            { v: "+5000", l: "Véhicules convoyés" },
            { v: "Tout inclus", l: "Péages, carburant et assurance" },
            { v: "+5 ans", l: "D'expérience" },
            { v: "7/7", l: "Disponible" },
          ].map((s) => (
            <div key={s.l} className="hx-figure"><div className="v">{s.v}</div><div className="l">{s.l}</div></div>
          ))}
        </div>
      </section>

      {/* ============ PREUVE SOCIALE ============ */}
      <section className="v5-trust">
        <div className="v5-trust-label">Ils nous confient leurs <span className="hx-neon">véhicules</span></div>
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

      {/* ============ ESPACE LIGNEO ============ */}
      <section className="v4-section">
        <div className="v4-section-head">
          <div className="v4-hero-eyebrow" style={{ justifyContent: "center", width: "100%" }}><span className="dot" />La plateforme</div>
          <h2>Découvrez votre espace <span className="hx-neon">Ligneo</span></h2>
          <p>Tableau de bord → Carte → Mission → Véhicule → Documents → Facture</p>
        </div>
        <div className="hx-platform">
          <div className="hx-platform-steps">
            {["Tableau de bord", "Carte", "Mission", "Véhicule", "Documents", "Facture"].map((s, i) => (
              <span key={s} className="hx-step-chip"><b>{String(i + 1).padStart(2, "0")}</b>{s}</span>
            ))}
          </div>
        </div>
      </section>

      <DerniersArticles />
      <FaqDynamique />

      {/* ============ CTA FINAL ============ */}
      <div className="v4-cta-box">
        <h2>Votre véhicule doit être <span className="hx-neon">déplacé ?</span></h2>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
          <button type="button" onClick={goDevis} className="v4-btn-primary">Obtenir mon devis</button>
          <Link to="/suivi" className="v4-btn-outline">Suivre mon véhicule</Link>
        </div>
      </div>
    </div>
  );
}
