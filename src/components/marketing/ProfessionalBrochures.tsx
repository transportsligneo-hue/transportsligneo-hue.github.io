import { Download, FileText } from "lucide-react";
import concessions from "@/assets/Ligneo-Concessionnaires.pdf.asset.json";
import loueurs from "@/assets/Ligneo-Loueurs-de-vehicules.pdf.asset.json";
import gestionnaires from "@/assets/Ligneo-Gestionnaires-de-flotte.pdf.asset.json";
import entreprises from "@/assets/Ligneo-Entreprises-parc-vehicules.pdf.asset.json";
import particuliers from "@/assets/Ligneo-Particuliers.pdf.asset.json";

export const particulierBrochure = { audience: "Particuliers", detail: "Achat à distance, déménagement, restitution LOA/LLD et plus", file: particuliers, filename: "Ligneo-Particuliers.pdf" } as const;

export function ParticulierBrochure() {
  const item = particulierBrochure;
  return (
    <section className="v4-section pro-brochures part-brochure" aria-labelledby="part-brochure-title">
      <div className="v4-section-head">
        <div className="v4-hero-eyebrow"><span className="dot" />Document à télécharger</div>
        <h2 id="part-brochure-title">Notre brochure <span className="audience-accent">particuliers</span></h2>
      </div>
      <div className="pro-brochures-grid">
        <article className="pro-brochure">
          <div className="pro-brochure-top">
            <span className="pro-brochure-icon"><FileText size={23} strokeWidth={1.7} /></span>
            <span className="pro-brochure-index">PDF</span>
          </div>
          <h3>{item.audience}</h3>
          <p>{item.detail}</p>
          <a className="pro-brochure-download" href={item.file.url} download={item.filename} type="application/pdf" aria-label="Télécharger la brochure PDF Particuliers">
            Télécharger le PDF <Download size={17} strokeWidth={2} />
          </a>
        </article>
      </div>
    </section>
  );
}

export const professionalBrochures = [
  { id: "concessions", audience: "Concessionnaires automobiles", detail: "Livraison client, reprises et transferts entre concessions", file: concessions, filename: "Ligneo-Concessionnaires.pdf" },
  { id: "loueurs", audience: "Loueurs de véhicules", detail: "Rotations, restitutions et repositionnements entre agences", file: loueurs, filename: "Ligneo-Loueurs-de-vehicules.pdf" },
  { id: "gestionnaires", audience: "Gestionnaires de flotte", detail: "Pilotage, reporting et mouvements de véhicules", file: gestionnaires, filename: "Ligneo-Gestionnaires-de-flotte.pdf" },
  { id: "entreprises", audience: "Entreprises avec parc de véhicules", detail: "Rotations entre collaborateurs, sites et garages", file: entreprises, filename: "Ligneo-Entreprises-parc-vehicules.pdf" },
] as const;

export type BrochureId = (typeof professionalBrochures)[number]["id"];

export default function ProfessionalBrochures({ ids }: { ids?: readonly BrochureId[] }) {
  const brochures = ids ? professionalBrochures.filter((item) => ids.includes(item.id)) : professionalBrochures;
  return (
    <section className="v4-section pro-brochures" aria-labelledby="pro-brochures-title">
      <div className="v4-section-head">
        <div className="v4-hero-eyebrow v"><span className="dot" />Documents professionnels</div>
        <h2 id="pro-brochures-title">Nos présentations <span className="audience-accent">par métier</span></h2>
        <p>Choisissez la présentation adaptée à votre activité.</p>
      </div>
      <div className="pro-brochures-grid">
        {brochures.map((item, index) => (
          <article className="pro-brochure" key={item.id}>
            <div className="pro-brochure-top">
              <span className="pro-brochure-icon"><FileText size={23} strokeWidth={1.7} /></span>
              <span className="pro-brochure-index">0{index + 1} / PDF</span>
            </div>
            <h3>{item.audience}</h3>
            <p>{item.detail}</p>
            <a className="pro-brochure-download" href={item.file.url} download={item.filename} type="application/pdf" aria-label={`Télécharger la présentation PDF pour ${item.audience}`}>
              Télécharger le PDF <Download size={17} strokeWidth={2} />
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}