import { User, Building2, Truck, Star, Camera, ShieldCheck, Users2 } from "lucide-react";
import ServicesGarantiesCarousel from "@/components/ServicesGarantiesCarousel";
import ServicesPlateforme from "@/components/ServicesPlateforme";
import ProSegment from "@/components/services/ProSegment";

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
    tags: ["Soin d'exception", "Sur devis"],
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

export type Audience = "particuliers" | "pro";

export default function ServicesContent({
  audience = "particuliers",
  onAudienceChange,
}: {
  audience?: Audience;
  onAudienceChange?: (a: Audience) => void;
}) {
  return (
    <div className="r4-page">
      {/* Toggle Particuliers / Professionnels */}
      <div className="v4-tabs" role="tablist" aria-label="Audience">
        <button
          type="button"
          role="tab"
          aria-selected={audience === "particuliers"}
          className={`v4-tab${audience === "particuliers" ? " is-active" : ""}`}
          onClick={() => onAudienceChange?.("particuliers")}
        >
          <User size={15} />
          Particuliers
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={audience === "pro"}
          className={`v4-tab pro${audience === "pro" ? " is-active" : ""}`}
          onClick={() => onAudienceChange?.("pro")}
        >
          <Users2 size={15} />
          Professionnels
        </button>
      </div>

      {audience === "particuliers" ? (
        <>
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

          <ServicesGarantiesCarousel />

          <ServicesPlateforme />
        </>
      ) : (
        <ProSegment />
      )}
    </div>
  );
}
