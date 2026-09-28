import { Link } from "@tanstack/react-router";
import {
  MapPin, ShieldCheck, ScanLine, PenLine, FolderOpen, User, Building2, Car, MapPinned,
  KeyRound, Truck, BarChart3, ArrowRight, Quote,
} from "lucide-react";
import DevisGenerator from "@/components/DevisGenerator";
import MapLigneo from "@/components/MapLigneo";
import AvisSection from "@/components/public/AvisSection";
import DerniersArticles from "@/components/public/DerniersArticles";
import FaqDynamique from "@/components/public/FaqDynamique";
import { scrollToDevis } from "@/lib/scroll-to-devis";

import heroBg from "@/assets/hero-ligneo-night.jpg";
import logoCat from "@/assets/cat-group-new.jpeg.asset.json";
import logoTransak from "@/assets/transakauto-new.png.asset.json";

const goDevis = () => { scrollToDevis(); };

export default function HomeDesktopV5() {
  return (
    <div className="r4-page">
      {/* ============ HERO ============ */}
      <section className="v5-hero v5-hero--bright">
        <div className="v5-hero-photo" style={{ backgroundImage: `url(${heroBg})` }} />
        <div className="v5-hero-tint" />
        <div className="v5-hero-fade" />

        <div className="v5-hero-grid">
          <div>
            <div className="v4-hero-eyebrow"><span className="dot" />Transports Ligneo · Convoyage automobile</div>
            <h1 className="v5-hero-h1 hx-title">
              Votre véhicule doit aller quelque part ?{" "}
              <span className="v4-accent">Ligneo s'occupe du reste.</span>
            </h1>
            <p className="hx-sub">
              Convoyage automobile France &amp; Europe · Assurance incluse · Suivi GPS · État des lieux
            </p>

            <button type="button" onClick={goDevis} className="hx-cta">
              Obtenir mon devis en 30 secondes <ArrowRight size={20} />
            </button>

            <div className="hx-switch">
              <Link to="/services" search={{ audience: "particuliers" }} className="hx-switch-btn">
                <User size={18} /> Je suis un particulier
              </Link>
              <Link to="/services" search={{ audience: "pro" }} className="hx-switch-btn hx-switch-btn--violet">
                <Building2 size={18} /> Je suis un professionnel
              </Link>
              <button type="button" onClick={goDevis} className="hx-switch-btn">
                <Car size={18} /> Obtenir un devis
              </button>
              <Link to="/suivi" className="hx-switch-btn">
                <MapPinned size={18} /> Je suis déjà client
              </Link>
            </div>
          </div>

          <div id="devis" className="v5-hero-quote scroll-mt-32">
            <DevisGenerator variant="flat-mini" />
          </div>
        </div>
      </section>

      {/* ============ BÉNÉFICES ============ */}
      <section className="v4-section">
        <div className="v4-section-head">
          <h2>Un convoyage sans stress, du départ à l'arrivée</h2>
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
      </section>

      {/* ============ VOUS ÊTES... ============ */}
      <section className="v4-section">
        <div className="v4-section-head">
          <div className="v4-hero-eyebrow" style={{ justifyContent: "center", width: "100%" }}><span className="dot" />Vous êtes…</div>
          <h2>Un parcours pensé pour votre métier</h2>
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
      </section>

      {/* ============ CARTE ============ */}
      <MapLigneo size="big" />

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
        <div className="hx-testis">
          {[
            { q: "Réactifs, ponctuels et un suivi clair à chaque étape. Nos transferts entre sites sont devenus simples.", a: "Responsable logistique · Concession multi-sites" },
            { q: "J'ai suivi ma voiture en direct jusqu'à la livraison, avec les photos de l'état des lieux. Rassurant.", a: "Client particulier · Tours" },
            { q: "Une seule facture pour tous nos sites et un historique complet : un vrai gain de temps.", a: "Gestionnaire de parc · Réseau d'agences" },
          ].map((t) => (
            <figure key={t.a} className="hx-testi">
              <Quote size={20} className="hx-testi-q" />
              <blockquote>{t.q}</blockquote>
              <figcaption>{t.a}</figcaption>
            </figure>
          ))}
        </div>
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

      <AvisSection />
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
