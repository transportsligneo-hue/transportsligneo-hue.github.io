import { Link } from "@tanstack/react-router";
import { ShieldCheck, Phone, Zap, CheckCircle } from "lucide-react";

const stats = [
  { v: "6+", l: "Ans d'expérience" },
  { v: "Tours", l: "Base opérationnelle" },
  { v: "France", l: "& Europe" },
  { v: "100%", l: "Digitalisé" },
];

const valeurs = [
  { Icon: ShieldCheck, title: "Rigueur", desc: "Chaque mission suit un protocole strict, du départ à la livraison." },
  { Icon: Phone, title: "Discrétion", desc: "Vos véhicules et vos données sont traités en toute confidentialité." },
  { Icon: Zap, title: "Réactivité", desc: "Un interlocuteur dédié, joignable 7j/7, pour répondre à tout imprévu." },
  { Icon: CheckCircle, title: "Transparence", desc: "Tarifs tout inclus, sans frais cachés ni surprise à la livraison." },
];

const timeline = [
  { year: "Création", title: "Les débuts à Tours", desc: "Olivier G démarre son activité de convoyage automobile, avec pour ambition la rigueur d'un grand groupe et la proximité d'une équipe locale." },
  { year: "Croissance", title: "Développement de l'équipe", desc: "Constitution d'une équipe de convoyeurs formés et l'intégration de convoyeurs indépendants certifiés en renfort." },
  { year: "Digital", title: "Lancement de la plateforme", desc: "Mise en ligne du devis instantané, du suivi GPS et de la signature électronique pour une expérience 100% digitale." },
  { year: "Aujourd'hui", title: "Un partenaire pour les pros", desc: "Développement des solutions dédiées aux concessions, loueurs et gestionnaires de flotte, partout en France et en Europe." },
];

export default function AProposContent() {
  return (
    <div className="r4-page">
      <div className="v4-hero">
        <div className="v4-hero-eyebrow"><span className="dot" />À propos</div>
        <h1 className="v4-h1">Une passion du détail, <span className="v4-accent">au service de la route</span>.</h1>
        <p className="v4-hero-p">Transports Ligneo est né à Tours d'une conviction simple : le convoyage automobile mérite la rigueur, la discrétion et le soin qu'on réserve aux véhicules d'exception.</p>
      </div>

      <div className="v4-stats-row">
        {stats.map((s) => (
          <div key={s.l} className="v4-stat">
            <div className="v">{s.v}</div>
            <div className="l">{s.l}</div>
          </div>
        ))}
      </div>

      <div className="v4-story">
        <p>Fondée à Tours, <b>Transports Ligneo</b> s'est imposée comme un acteur de confiance du convoyage automobile en France, au service des particuliers comme des professionnels — concessions, loueurs et gestionnaires de flotte.</p>
        <p>Notre différence tient en une phrase : <b>chaque véhicule est traité comme s'il était le nôtre.</b> Chauffeurs formés en continu, tenue professionnelle obligatoire, état des lieux photo systématique, assurance tous risques incluse — rien n'est laissé au hasard.</p>
        <p>Nous avons aussi fait le pari du digital dès le premier jour : devis instantané, suivi GPS en direct, signature électronique et facturation automatique. Une exigence de grand groupe, avec la réactivité d'une équipe qui connaît chaque client par son nom.</p>
      </div>

      <div className="v4-section">
        <div className="v4-section-head">
          <div className="v4-hero-eyebrow" style={{ justifyContent: "center", width: "100%" }}>
            <span className="dot" />Nos valeurs
          </div>
          <h2>Ce qui nous guide au quotidien</h2>
        </div>
        <div className="v4-values-grid">
          {valeurs.map(({ Icon, title, desc }) => (
            <div key={title} className="v4-value-card">
              <div className="v4-value-ic"><Icon size={20} strokeWidth={2} /></div>
              <h4>{title}</h4>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="v4-section">
        <div className="v4-section-head">
          <div className="v4-hero-eyebrow" style={{ justifyContent: "center", width: "100%" }}>
            <span className="dot" />Notre parcours
          </div>
          <h2>Quelques étapes clés</h2>
        </div>
        <div className="v4-timeline">
          <div className="v4-tl-track" />
          {timeline.map((it) => (
            <div key={it.year} className="v4-tl-item">
              <div className="v4-tl-year">{it.year}</div>
              <div className="v4-tl-body">
                <h4>{it.title}</h4>
                <p>{it.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="v4-cta-box">
        <div className="v4-hero-eyebrow" style={{ justifyContent: "center", width: "100%" }}>
          <span className="dot" />Rejoignez l'aventure
        </div>
        <h2>Envie de travailler avec nous ?</h2>
        <p>Que vous soyez un particulier ou un professionnel, parlons de votre prochain convoyage.</p>
        <Link to="/contact" className="v4-btn-primary">Nous contacter</Link>
      </div>
    </div>
  );
}
