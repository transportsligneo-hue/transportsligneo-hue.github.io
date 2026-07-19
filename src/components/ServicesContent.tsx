import { Link } from "@tanstack/react-router";
import { User, Building2, Truck, Star, Camera, ShieldCheck, MapPin, Bell, PhoneCall, Check } from "lucide-react";

const services = [
  {
    Icon: User,
    title: "Convoyage particuliers",
    desc: "Déménagement, achat à distance, restitution LOA/LLD : votre véhicule livré où vous le souhaitez, sans prendre le volant.",
    tags: ["Devis en 30s", "Assurance incluse"],
  },
  {
    Icon: Building2,
    title: "Concessions & loueurs",
    desc: "Livraison inter-sites, transferts de stock, restitution clients : un partenaire fiable pour vos flux réguliers de véhicules.",
    tags: ["Facturation groupée", "Interlocuteur dédié"],
  },
  {
    Icon: Truck,
    title: "Gestion de flotte",
    desc: "Pour les entreprises multi-véhicules : pilotage centralisé, missions groupées et reporting complet de votre parc.",
    tags: ["Multi-sites", "Reporting"],
  },
  {
    Icon: Star,
    title: "Véhicules de collection",
    desc: "Manipulation avec le soin qu'exigent les véhicules d'exception : chauffeurs formés, équipements adaptés.",
    tags: ["Soin premium", "Sur devis"],
  },
  {
    Icon: Camera,
    title: "État des lieux photo",
    desc: "Constat photo 360° à l'enlèvement et à la livraison, horodaté et signé, pour une traçabilité totale.",
    tags: ["Photos 360°", "Signature digitale"],
  },
  {
    Icon: ShieldCheck,
    title: "Assurance tous risques",
    desc: "Chaque mission est couverte de bout en bout, sans supplément ni petites lignes en bas du devis.",
    tags: ["Incluse d'office", "0 frais caché"],
  },
];

export default function ServicesContent() {
  return (
    <div className="r4-page">
      <div className="v4-hero">
        <div className="v4-hero-eyebrow"><span className="dot" />Nos services</div>
        <h1 className="v4-h1">Le convoyage, <span className="v4-accent">réinventé</span>.</h1>
        <p className="v4-hero-p">De la citadine au véhicule de collection, pour les particuliers comme pour les professionnels : un service de convoyage complet, transparent et assuré.</p>
      </div>

      <div className="v4-section">
        <div className="v4-services-grid">
          {services.map(({ Icon, title, desc, tags }) => (
            <div key={title} className="v4-svc-card">
              <div className="v4-svc-ic"><Icon size={22} strokeWidth={2} /></div>
              <h3>{title}</h3>
              <p>{desc}</p>
              <div className="v4-svc-tags">
                {tags.map((t) => <span key={t} className="v4-svc-tag">{t}</span>)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="v4-split-feature">
        <div className="v4-split-visual">
          <div className="v4-visual-badge">
            <div className="v4-big-ic"><MapPin size={38} strokeWidth={1.8} /></div>
            <div style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 700, fontSize: 15 }}>Suivi GPS en direct</div>
          </div>
        </div>
        <div className="v4-split-text">
          <h2>Un suivi transparent, à chaque étape</h2>
          <p>De l'enlèvement à la livraison, vous suivez votre véhicule en temps réel depuis votre espace client — sans avoir à appeler pour prendre des nouvelles.</p>
          <ul>
            <li><Check /> Position GPS en direct</li>
            <li><Bell /> Notifications à chaque étape clé</li>
            <li><PhoneCall /> Contact direct avec le convoyeur</li>
          </ul>
        </div>
      </div>

      <div className="v4-cta-box">
        <div className="v4-hero-eyebrow" style={{ justifyContent: "center", width: "100%" }}>
          <span className="dot" />Un besoin spécifique ?
        </div>
        <h2>Parlons de votre projet de convoyage</h2>
        <p>Particulier, concession, loueur ou gestionnaire de flotte : nous avons une solution adaptée.</p>
        <Link to="/contact" className="v4-btn-primary">Contacter un conseiller</Link>
      </div>
    </div>
  );
}
