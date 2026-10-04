import { DemoRequestButton } from "@/components/marketing/DemoRequestButton";
import { Link } from "@tanstack/react-router";
import {
  MapPin, ShieldCheck, ScanLine, PenLine, FolderOpen, User, BriefcaseBusiness, CarFront, House,
  KeyRound, Truck, BarChart3, ArrowRight, Phone,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import DevisGenerator from "@/components/DevisGenerator";
import MapLigneo from "@/components/MapLigneo";
import AvisSection from "@/components/public/AvisSection";
import DerniersArticles from "@/components/public/DerniersArticles";
import FaqDynamique from "@/components/public/FaqDynamique";
import { scrollToDevis } from "@/lib/scroll-to-devis";

import heroBg from "@/assets/hero-ligneo-extended.jpg";
import logoCat from "@/assets/cat-group-new.jpeg.asset.json";
import logoTransak from "@/assets/transakauto-new.png.asset.json";

const goDevis = () => { scrollToDevis(); };

export default function HomeDesktopV5() {
  const { isAuthenticated, homeRoute } = useAuth();
  return (
    <div className="r4-page">
      {/* ============ HERO ============ */}
      <section className="v5-hero v5-hero--bright">
        <div className="v5-hero-photo" style={{ backgroundImage: `url(${heroBg})` }} />
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
              Convoyage et logistique automobile France &amp; Europe · Assurance incluse · Suivi GPS · État des lieux
            </p>

            <div className="hx-switch">
              <Link to="/services" search={{ audience: "particuliers" }} className="hx-switch-btn">
                <span className="hx-switch-icon"><User size={24} strokeWidth={2.1} aria-hidden="true" /></span>
                <span className="hx-switch-label">Je suis un particulier</span>
                <ArrowRight className="hx-switch-arrow" size={17} strokeWidth={1.8} aria-hidden="true" />
              </Link>
              <Link to="/services" search={{ audience: "pro" }} className="hx-switch-btn hx-switch-btn--violet">
                <span className="hx-switch-icon"><BriefcaseBusiness size={24} strokeWidth={2.1} aria-hidden="true" /></span>
                <span className="hx-switch-label">Je suis un professionnel</span>
                <ArrowRight className="hx-switch-arrow" size={17} strokeWidth={1.8} aria-hidden="true" />
              </Link>
              <Link to="/devenir-convoyeur" className="hx-switch-btn hx-switch-btn--driver hx-switch-btn--calm">
                <span className="hx-switch-icon"><CarFront size={24} strokeWidth={2.1} aria-hidden="true" /></span>
                <span className="hx-switch-label">Je suis convoyeur</span>
                <ArrowRight className="hx-switch-arrow" size={17} strokeWidth={1.8} aria-hidden="true" />
              </Link>
              <Link to={isAuthenticated ? homeRoute : "/login"} className="hx-switch-btn hx-switch-btn--client hx-switch-btn--calm">
                <span className="hx-switch-icon"><House size={24} strokeWidth={2.1} aria-hidden="true" /></span>
                <span className="hx-switch-label">Mon espace client</span>
                <ArrowRight className="hx-switch-arrow" size={17} strokeWidth={1.8} aria-hidden="true" />
              </Link>
              <Link to="/suivi" className="hx-switch-btn hx-switch-btn--track hx-switch-btn--calm">
                <span className="hx-switch-icon"><MapPin size={24} strokeWidth={2.1} aria-hidden="true" /></span>
                <span className="hx-switch-label">Suivre mon véhicule</span>
                <ArrowRight className="hx-switch-arrow" size={17} strokeWidth={1.8} aria-hidden="true" />
              </Link>
            </div>

            <div className="hx-contact-row">
              <Link to="/contact" className="dg-call-btn" aria-label="Contact · Transports Ligneo">
                <span className="dg-call-ic"><Phone size={13} strokeWidth={2.4} /></span>
                Contact
              </Link>
              <DemoRequestButton />
            </div>
          </div>

          <div id="devis" className="v5-hero-quote scroll-mt-32">
            <DevisGenerator variant="flat-mini" />
          </div>
        </div>
      </section>

      {/* ============ BÉNÉFICES + PARCOURS + CARTE ============ */}
      <section className="v4-section">
        <div className="hx-split">
          <div className="hx-split-left">
            <div className="v4-section-head hx-split-head">
              <h2>Un convoyage <span className="hx-neon">sans stress</span>, du départ à l'arrivée</h2>
            </div>
            <div className="hx-benefits">
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

            <div className="v4-section-head hx-split-head">
              <div className="v4-hero-eyebrow"><span className="dot" />Vous êtes…</div>
              <h2>Un parcours <span className="hx-neon">pensé pour votre métier</span></h2>
            </div>
            <div className="hx-segments">
              <Link to="/services" search={{ audience: "particuliers" }} className="hx-seg">
                <span className="hx-seg-ic"><User size={22} /></span>
                <h3>Particulier</h3>
                <p>Faire transporter mon véhicule simplement et en toute sécurité.</p>
                <span className="hx-seg-more">Découvrir <ArrowRight size={14} /></span>
              </Link>
              <Link to="/concessionnaires" className="hx-seg">
                <span className="hx-seg-ic"><KeyRound size={22} /></span>
                <h3>Concessionnaire</h3>
                <p>Déplacez vos véhicules entre concessions, ateliers et clients.</p>
                <span className="hx-seg-more">Découvrir <ArrowRight size={14} /></span>
              </Link>
              <Link to="/loueurs" className="hx-seg">
                <span className="hx-seg-ic"><Truck size={22} /></span>
                <h3>Loueur</h3>
                <p>Automatisez les rotations de véhicules entre agences.</p>
                <span className="hx-seg-more">Découvrir <ArrowRight size={14} /></span>
              </Link>
              <Link to="/gestionnaires-flotte" className="hx-seg">
                <span className="hx-seg-ic"><BarChart3 size={22} /></span>
                <h3>Gestionnaire de flotte</h3>
                <p>Une vision centralisée de tous vos mouvements de véhicules.</p>
                <span className="hx-seg-more">Découvrir <ArrowRight size={14} /></span>
              </Link>
            </div>
          </div>

          <aside className="hx-split-map">
            <div className="hx-map-card">
              <MapLigneo size="small" className="hx-map-flush" />
              <div className="hx-map-caption">
                <p>Basé à Tours (37)</p>
                <span>France entière et toute l'Europe</span>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* ============ PREUVE SOCIALE ============ */}
      <section className="v5-trust">
        <div className="v5-trust-label">Ils nous confient leurs véhicules</div>
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

      <section className="v4-section">
        <div className="hx-figures">
          {[
            { v: "+5000", l: "Véhicules convoyés" },
            { v: "Tout inclus", l: "Péages, carburant et assurance" },
            { v: "+6 ans", l: "D'expérience" },
            { v: "7/7", l: "Disponible" },
          ].map((s) => (
            <div key={s.l} className="hx-figure"><div className="v">{s.v}</div><div className="l">{s.l}</div></div>
          ))}
        </div>
      </section>

      <AvisSection />

      {/* ============ ESPACE LIGNEO ============ */}
      <section className="v4-section">
        <div className="v4-section-head">
          <div className="v4-hero-eyebrow" style={{ justifyContent: "center", width: "100%" }}><span className="dot" />La plateforme</div>
          <h2>Découvrez votre espace Ligneo</h2>
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
        <h2>Votre véhicule doit être déplacé ?</h2>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
          <button type="button" onClick={goDevis} className="v4-btn-primary">Obtenir mon devis</button>
          <Link to="/suivi" className="v4-btn-outline">Suivre mon véhicule</Link>
        </div>
      </div>
    </div>
  );
}
