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
              Convoyage et logistique automobile France &amp; Europe · Assurance, carburant et péage inclus · Suivi GPS · État des lieux
            </p>

            <div className="hb-wrap">
              <div className="hb-grid3">
                <Link to="/services" search={{ audience: "particuliers" }} className="hb-btn hb-part">
                  <span className="hb-ic"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg></span>
                  <span className="hb-row"><span className="hb-label">Je suis un particulier</span><span className="hb-chev">→</span></span>
                </Link>
                <Link to="/services" search={{ audience: "pro" }} className="hb-btn hb-pro">
                  <span className="hb-ic"><svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/></svg></span>
                  <span className="hb-row"><span className="hb-label">Je suis un professionnel</span><span className="hb-chev">→</span></span>
                </Link>
                <Link to={isAuthenticated ? homeRoute : "/login"} className="hb-btn hb-esp">
                  <span className="hb-ic"><svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7"/><path d="M5 10v9a1 1 0 0 0 1 1h3v-6h6v6h3a1 1 0 0 0 1-1v-9"/></svg></span>
                  <span className="hb-row"><span className="hb-label">Mon espace client</span><span className="hb-chev">→</span></span>
                </Link>
              </div>
              <div className="hb-divider"><span>Autres accès</span><i /></div>
              <div className="hb-minis">
                <Link to="/devenir-convoyeur" className="hb-mini hb-conv">
                  <span className="hb-ic"><svg viewBox="0 0 24 24"><path d="M3 13l1.5-5A2 2 0 0 1 6.4 7h11.2a2 2 0 0 1 1.9 1.4L21 13"/><rect x="2.5" y="13" width="19" height="5" rx="1.5"/><circle cx="7" cy="18.5" r="1.6" fill="#fff" stroke="none"/><circle cx="17" cy="18.5" r="1.6" fill="#fff" stroke="none"/></svg></span>
                  <span className="hb-label">Je suis convoyeur</span>
                </Link>
                <Link to="/suivi" className="hb-mini hb-suiv">
                  <span className="hb-ic"><svg viewBox="0 0 24 24"><path d="M12 22s7-7.2 7-12.5A7 7 0 0 0 5 9.5C5 14.8 12 22 12 22Z"/><circle cx="12" cy="9.5" r="2.5"/></svg></span>
                  <span className="hb-label">Suivre mon véhicule</span>
                </Link>
              </div>
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
              <h2>Un convoyage sans stress, <span className="hx-neon">du départ à l'arrivée</span></h2>
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
        <h2>Votre véhicule doit être <span className="hx-neon">déplacé</span> ?</h2>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
          <button type="button" onClick={goDevis} className="v4-btn-primary">Obtenir mon devis</button>
          <Link to="/suivi" className="v4-btn-outline">Suivre mon véhicule</Link>
        </div>
      </div>
    </div>
  );
}
