import { useState } from "react";
import { Route as RouteIcon, ShieldCheck, Truck, FileCheck2 } from "lucide-react";
import PresentationDemoFilm from "@/components/marketing/PresentationDemoFilm";
import demoParticulier from "@/assets/demo-ligneo-particuliers-2.mp4.asset.json";
import demoParticulierPoster from "@/assets/demo-ligneo-particuliers-poster.jpg.asset.json";
import demoProfessionnels from "@/assets/demo-ligneo-professionnels-son-faststart.mp4.asset.json";
import demoProfessionnelsPoster from "@/assets/demo-ligneo-professionnels-son-poster.jpg.asset.json";
import MobileFooter from "@/components/mobile/MobileFooter";
import { PageCta, PageHero, useReveal } from "@/components/mobile/MobilePageBits";
import { RouteAB } from "@/components/mobile/MobileIcons";

const steps = [
  { Icon: RouteAB, title: "Estimez", text: "Prix en 2 minutes, sans compte." },
  { Icon: FileCheck2, title: "Validez", text: "Signature en ligne, on s’occupe du reste." },
  { Icon: Truck, title: "On convoie", text: "Un pro au volant, suivi GPS en direct." },
  { Icon: ShieldCheck, title: "Vous recevez", text: "État des lieux, facture et PV automatiques." },
];

/** Comment ça marche mobile · 4 étapes numérotées qui s'affichent l'une après l'autre. */
export default function MobileCommentCaMarcheScreen() {
  const [pro, setPro] = useState(false);
  const ref = useReveal<HTMLElement>();
  return (
    <div className="mh2-root md:hidden">
      <PageHero kicker="Notre process" title={<>Comment <em>ça marche</em></>} text="4 étapes, 100 % digital." />

      <div className="mp-vid">
        <div className="mp-vt">
          <button type="button" className={!pro ? "on" : ""} onClick={() => setPro(false)}>Particuliers</button>
          <button type="button" className={pro ? "on pro" : ""} onClick={() => setPro(true)}>Pros</button>
        </div>
        <PresentationDemoFilm
          key={pro ? "pro" : "part"}
          src={pro ? demoProfessionnels.url : demoParticulier.url}
          poster={pro ? demoProfessionnelsPoster.url : demoParticulierPoster.url}
          label={pro ? "Démonstration de commande pour les professionnels" : "Démonstration de commande pour les particuliers"}
        />
      </div>

      <section ref={ref} className="mh2-sec mp-tl" style={{ marginTop: 26 }}>
        {steps.map(({ Icon, title, text }, i) => (
          <div key={title} className="mp-ts">
            <div className="mp-tn">{i + 1}</div>
            <div className="mp-tb">
              <b>
                <Icon />
                {title}
              </b>
              <p>{text}</p>
            </div>
          </div>
        ))}
      </section>

      <PageCta
        title={<>Prêt à <em>partir ?</em></>}
        text="Estimez votre trajet en 2 minutes."
        to="/tarifs"
        label="Estimer mon trajet"
      />
      <MobileFooter />
    </div>
  );
}
