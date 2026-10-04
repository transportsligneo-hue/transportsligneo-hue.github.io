import { useRef } from "react";
import presentationPro from "@/assets/demo-ligneo-professionnels-commande.mp4.asset.json";
import presentationProPoster from "@/assets/demo-ligneo-professionnels-commande-poster.jpg.asset.json";
import demoProfessionnels from "@/assets/demo-ligneo-professionnels-son-faststart.mp4.asset.json";
import demoProfessionnelsPoster from "@/assets/demo-ligneo-professionnels-son-poster.jpg.asset.json";
import driverLogo from "@/assets/logo-video-driver.png.asset.json";
import proLogo from "@/assets/logo-video-professionnels.jpg.asset.json";
import { useAutoplayWithSound } from "@/hooks/useAutoplayWithSound";
import PresentationDemoFilm from "@/components/marketing/PresentationDemoFilm";

const STEPS = [
  {
    title: "Estimation & devis en ligne",
    desc: "Vous renseignez le trajet, le véhicule et la date souhaitée.",
    points: [
      "Tarif instantané, péages et carburant inclus",
      "Devis simple ou groupé (plusieurs véhicules)",
      "Envoi du devis PDF par email",
    ],
  },
  {
    title: "Validation par notre équipe",
    desc: "Un exploitant contrôle la faisabilité et confirme la mission.",
    points: [
      "Vérification des créneaux et des contraintes",
      "Ajustement des contacts et des accès sur site",
      "Confirmation écrite et bon de commande archivé",
    ],
  },
  {
    title: "Recherche du convoyeur & prise en charge",
    desc: "Un convoyeur professionnel est affecté puis se déplace sur site.",
    points: [
      "Convoyeur assuré, formé et identifiable",
      "État des lieux photo 360° et signature à l'enlèvement",
      "Suivi GPS activé dès le départ",
    ],
  },
  {
    title: "Livraison ou restitution",
    desc: "Le véhicule est remis au destinataire, dossier complet à l'appui.",
    points: [
      "État des lieux d'arrivée et signature du réceptionnaire",
      "Rapport PDF disponible immédiatement",
      "Facturation consolidée par site ou par mission",
    ],
  },
];

export function ProFilm() {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Lecture automatique avec le son, dès que la vidéo entre dans le viewport
  useAutoplayWithSound(videoRef);

  return (
    <section className="v4-section pro-film" aria-label="Parcours professionnel en vidéo">
      <div
        className="v4-video-wrap film-neon"
        style={{
          maxWidth: 760,
          margin: "0 auto",
          borderRadius: 22,
          overflow: "hidden",
        }}
      >
        <video
          ref={videoRef}
          src={presentationPro.url}
          poster={presentationProPoster.url}
          controls
          playsInline
          preload="auto"
          className="pro-film-video"
          style={{ display: "block", width: "100%", height: "auto" }}
        />
      </div>
    </section>
  );
}

/** Présentations publiques des métiers, indépendantes des missions Driver. */
export function ProPresentations() {
  return (
    <section className="pro-presentations v4-section" aria-label="Présentations vidéo Ligneo">
      <div className="v4-section-head">
        <h2>Découvrez Transports Ligneo</h2>
      </div>
      <div className="pro-presentations-grid">
        <div className="pro-presentation pro-presentation--business">
          <h3>Pour les professionnels</h3>
          <video src={presentationPro.url} poster={presentationProPoster.url} controls playsInline preload="metadata" aria-label="Présentation Transports Ligneo pour les professionnels" />
          <img src={proLogo.url} alt="Transports Ligneo" className="pro-presentation-logo" loading="lazy" />
        </div>
        <div className="pro-presentation pro-presentation--demo">
          <h3>Commander une mission professionnelle</h3>
          <PresentationDemoFilm src={demoProfessionnels.url} poster={demoProfessionnelsPoster.url} label="Démonstration Ligneo : commander une mission professionnelle" />
          <img src={driverLogo.url} alt="Ligneo Driver" className="pro-presentation-logo pro-presentation-logo--driver" loading="lazy" />
        </div>
      </div>
    </section>
  );
}

export default function ProTimeline() {
  return (
    <div className="v4-section">
      <div className="v4-section-head">
        <div className="v4-hero-eyebrow v" style={{ justifyContent: "center", width: "100%" }}>
          <span className="dot" />Comment ça marche
        </div>
        <h2>Quatre étapes, <span className="v4-accent v">du devis à la livraison</span></h2>
        <p>Un process industrialisé et traçable, conçu pour les volumes professionnels.</p>
      </div>
      <ol className="pro-tl">
        {STEPS.map((s, i) => (
          <li key={s.title} className="pro-tl-item">
            <div className="pro-tl-marker">
              <span className="pro-tl-num">{String(i + 1).padStart(2, "0")}</span>
            </div>
            <div className="pro-tl-body">
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
              <ul>
                {s.points.map((p) => (
                  <li key={p}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true">
                      <path d="m5 13 4 4L19 7" />
                    </svg>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}