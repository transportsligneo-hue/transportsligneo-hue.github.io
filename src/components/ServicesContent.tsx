import { useRef } from "react";
import { User, Users2, Car, MapPin, Plane, Star, Camera, ShieldCheck, HeartHandshake, KeyRound } from "lucide-react";
import filmParcoursMission from "@/assets/presentation-particuliers-voix.mp4.asset.json";
import { useAutoplayWithSound } from "@/hooks/useAutoplayWithSound";
import ServicesPlateforme from "@/components/ServicesPlateforme";
import ProSegment from "@/components/services/ProSegment";

const services = [
  {
    Icon: Car,
    title: "Achat à distance",
    desc: "Vous achetez votre véhicule loin de chez vous ? Nous le récupérons et vous le livrons à domicile, sans stress et sans trajet improvisé.",
    tags: ["Livraison à domicile", "Traçabilité complète"],
  },
  {
    Icon: MapPin,
    title: "Déménagement & changement de vie",
    desc: "Déménagement, mutation professionnelle, saisonniers : votre voiture vous suit où que vous alliez, en France ou en Europe.",
    tags: ["France & Europe", "Sur mesure"],
  },
  {
    Icon: KeyRound,
    title: "Restitution LOA / LLD",
    desc: "Fin de leasing ou de location longue durée : nous ramenons votre véhicule chez le concessionnaire ou le loueur dans les délais impartis.",
    tags: ["Délai respecté", "État des lieux inclus"],
  },
  {
    Icon: HeartHandshake,
    title: "Vente entre particuliers",
    desc: "Vendez ou achetez un véhicule d'occasion sans vous déplacer : enlèvement, livraison et constat intégrés pour un échange serein.",
    tags: ["Constat 360°", "Paiement sécurisé"],
  },
  {
    Icon: Plane,
    title: "Rapatriement de véhicule",
    desc: "Panne, accident, imprévu en voyage : nous rapattons votre voiture jusqu'à l'adresse de votre choix, en toute sécurité.",
    tags: ["Disponible 7j/7", "Assurance incluse"],
  },
  {
    Icon: Star,
    title: "Véhicules de collection",
    desc: "Manipulation avec le soin qu'exigent les véhicules d'exception : chauffeurs formés, équipements adaptés, transport sur devis.",
    tags: ["Soin d'exception", "Sur devis"],
  },
  {
    Icon: Camera,
    title: "État des lieux photo",
    desc: "Constat photo 360° à l'enlèvement et à la livraison, horodaté et signé, pour une traçabilité totale et une tranquillité absolue.",
    tags: ["Photos 360°", "Signature digitale"],
  },
  {
    Icon: ShieldCheck,
    title: "Assurance tous risques",
    desc: "Chaque mission est couverte du départ à l'arrivée, sans supplément ni petites lignes en bas du devis. Vous roulez tranquille.",
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
  const videoRef = useRef<HTMLVideoElement>(null);

  // Lecture automatique avec le son, dès que la vidéo entre dans le viewport
  useAutoplayWithSound(videoRef, audience === "particuliers");

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
<h1 className="v4-h1">Votre véhicule, <span className="v4-accent">entre des mains expertes</span>.</h1>
            <p className="v4-hero-p">De la citadine au véhicule de collection, pour tous les moments de votre vie : un convoyeur professionnel prend en charge votre véhicule de l'enlèvement à la remise des clés, dans un service complet, transparent et assuré, pensé pour les particuliers.</p>
          </div>

          <section className="v4-section particuliers-film" style={{ textAlign: "center" }}>
            <div className="v4-section-head">
<div className="v4-hero-eyebrow" style={{ display: "inline-flex", marginBottom: 14 }}>
                <span className="dot" />Comment ça marche&nbsp;?
              </div>
              <h2>
                Un convoyage maîtrisé, <em className="v4-accent" style={{ fontStyle: "normal" }}>à chaque kilomètre</em>
              </h2>
            </div>
            <div
              className="v4-video-wrap film-neon"
              style={{
                maxWidth: 760,
                margin: "0 auto",
                borderRadius: 24,
                overflow: "hidden",
              }}
            >
              <video
                ref={videoRef}
                src={filmParcoursMission.url}
                controls
                playsInline
                preload="auto"
                style={{ display: "block", width: "100%", height: "auto" }}
              />
            </div>
          </section>

          <div className="v4-section">
            <div className="v4-services-grid">
              {services.map(({ Icon, title, desc, tags }) => (
                <div key={title} className="v4-svc-card">
                  <div className="v4-svc-ic"><Icon size={22} strokeWidth={2} /></div>
                  <h2>{title}</h2>
                  <p>{desc}</p>
                  <div className="v4-svc-tags">
                    {tags.map((t) => <span key={t} className="v4-svc-tag">{t}</span>)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <ServicesPlateforme />
        </>
      ) : (
        <ProSegment />
      )}
    </div>
  );
}
