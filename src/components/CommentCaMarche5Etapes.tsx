import { Smartphone, UserCheck, MapPin, Camera, FileText } from "lucide-react";

const steps = [
  { n: "01", I: Smartphone, t: "Je demande", d: "Je saisis mon trajet et j'obtiens mon devis en 30 secondes.", mock: "Devis · Tours → Paris · 180 €" },
  { n: "02", I: UserCheck, t: "Ligneo organise", d: "Un convoyeur professionnel est attribué à ma mission.", mock: "Convoyeur attribué ✓" },
  { n: "03", I: MapPin, t: "Je suis mon véhicule", d: "Je vois sa position en direct sur la carte GPS.", mock: "En route · arrivée 14:20" },
  { n: "04", I: Camera, t: "Je récupère mon véhicule", d: "État des lieux photo et signature électronique à la remise.", mock: "EDL 360° · Signé" },
  { n: "05", I: FileText, t: "Je retrouve tous mes documents", d: "Rapport, PV et facture disponibles dans mon espace.", mock: "PV.pdf · Facture.pdf" },
];

export default function CommentCaMarche5Etapes() {
  return (
    <section className="r4-page">
      <div className="v4-section" style={{ paddingTop: 140 }}>
        <div className="v4-section-head">
          <div className="v4-hero-eyebrow" style={{ justifyContent: "center", width: "100%" }}><span className="dot" />Comment ça marche</div>
          <h2>5 étapes, zéro stress</h2>
        </div>
        <ol className="hx-steps5">
          {steps.map(({ n, I, t, d, mock }) => (
            <li key={n} className="hx-step5">
              <div className="hx-step5-num">{n}</div>
              <span className="hx-benefit-ic"><I size={20} /></span>
              <h3>{t}</h3>
              <p>{d}</p>
              <div className="hx-step5-mock">{mock}</div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
