import { Briefcase, User } from "lucide-react";
import PresentationDemoFilm from "@/components/marketing/PresentationDemoFilm";
import demoParticulier from "@/assets/demo-ligneo-particuliers-2.mp4.asset.json";
import demoParticulierPoster from "@/assets/demo-ligneo-particuliers-poster.jpg.asset.json";
import demoProfessionnels from "@/assets/demo-ligneo-professionnels-son-faststart.mp4.asset.json";
import demoProfessionnelsPoster from "@/assets/demo-ligneo-professionnels-son-poster.jpg.asset.json";
import { services, type Audience } from "@/components/ServicesContent";
import { audiences, features } from "@/components/services/ProSegment";
import MobileFooter from "@/components/mobile/MobileFooter";
import { PageCta, PageHero } from "@/components/mobile/MobilePageBits";

/** Services mobile · mêmes textes que le site, design navy (bleu particuliers / violet pros). */
export default function MobileServicesScreen({
  audience,
  onAudienceChange,
}: {
  audience: Audience;
  onAudienceChange: (a: Audience) => void;
}) {
  const pro = audience === "pro";
  const cards = pro
    ? [...audiences, ...features].map((x) => ({ Icon: x.Icon, title: x.title, desc: x.desc, tags: [] as string[] }))
    : services;

  return (
    <div className="mh2-root md:hidden">
      <PageHero
        kicker={pro ? "Solutions professionnelles" : "Nos services"}
        title={
          pro ? (
            <>
              Le convoyage à l’échelle de <em>votre flotte.</em>
            </>
          ) : (
            <>
              Avec Ligneo, <em>la tranquillité sur toute la ligne.</em>
            </>
          )
        }
        text={
          pro
            ? "Concessions, loueurs, gestionnaires de parc : une plateforme dédiée pour piloter vos convoyages."
            : "Un convoyeur professionnel prend en charge votre véhicule de l’enlèvement à la remise des clés."
        }
      />

      <div className="mp-seg" role="tablist" aria-label="Audience">
        <button type="button" role="tab" aria-selected={!pro} className={!pro ? "on" : ""} onClick={() => onAudienceChange("particuliers")}>
          <User size={14} /> Particuliers
        </button>
        <button type="button" role="tab" aria-selected={pro} className={pro ? "on pro" : ""} onClick={() => onAudienceChange("pro")}>
          <Briefcase size={14} /> Pros
        </button>
      </div>

      <div className="mp-vid">
        <PresentationDemoFilm
          key={pro ? "pro" : "part"}
          src={pro ? demoProfessionnels.url : demoParticulier.url}
          poster={pro ? demoProfessionnelsPoster.url : demoParticulierPoster.url}
          label={pro ? "Présentation Ligneo pour les professionnels" : "Présentation Ligneo pour les particuliers"}
        />
      </div>

      <section className={`mh2-sec${pro ? " mp-pro" : ""}`}>
        {cards.map(({ Icon, title, desc, tags }) => (
          <article key={title} className="mp-sv">
            <div className="mp-ic">
              <Icon size={22} />
            </div>
            <h3>{title}</h3>
            <p>{desc}</p>
            {tags.length > 0 && (
              <div className="mp-tags">
                {tags.map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
            )}
          </article>
        ))}
      </section>

      <PageCta
        title={
          <>
            Un besoin <em>particulier ?</em>
          </>
        }
        text="Décrivez-nous votre situation, devis clair garanti."
        to={pro ? "/contact" : "/tarifs"}
        label={pro ? "Parler à un conseiller" : "Demander un devis"}
      />
      <MobileFooter />
    </div>
  );
}
