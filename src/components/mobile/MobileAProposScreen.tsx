import { stats, valeurs, timeline } from "@/components/AProposContent";
import MobileFooter from "@/components/mobile/MobileFooter";
import { PageCta, PageHero, useReveal } from "@/components/mobile/MobilePageBits";

/** À propos mobile · mêmes textes que le site PC, agrandis pour la lecture. */
export default function MobileAProposScreen() {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div className="mh2-root mp-ap md:hidden">
      <PageHero
        kicker="À propos"
        title={
          <>
            Une passion du détail, <em>au service de la route.</em>
          </>
        }
        text="Transports Ligneo est né à Tours d'une conviction simple : le convoyage automobile mérite la rigueur, la discrétion et le soin qu'on réserve aux véhicules d'exception."
      />

      <div className="mp-stats">
        {stats.map((s) => (
          <div key={s.l}>
            <b>{s.v}</b>
            <span>{s.l}</span>
          </div>
        ))}
      </div>

      <div className="mp-story">
        <p>
          Fondée par Olivier Gourlaouen à Tours (37), <b>Transports Ligneo</b> s'est imposée comme un acteur de confiance du convoyage automobile en France, au service des particuliers comme des professionnels : concessions, loueurs et gestionnaires de flotte.
        </p>
        <p>
          Notre différence tient en une phrase : <b>chaque véhicule est traité comme s'il était le nôtre.</b> Chauffeurs formés en continu, tenue professionnelle obligatoire, état des lieux photo systématique, assurance tous risques incluse. Rien n'est laissé au hasard.
        </p>
        <p>
          Nous avons aussi fait le pari du digital : devis instantané, suivi GPS en direct, signature électronique et facturation automatique. Une exigence de grand groupe, avec la réactivité d'une équipe qui connaît chaque client par son nom.
        </p>
      </div>

      <section className="mh2-sec">
        <div className="mh2-h2">Nos valeurs</div>
        <h2 className="mh2-t2">
          Ce qui nous guide au <em>quotidien</em>
        </h2>
        <div className="mp-vl">
          {valeurs.map(({ Icon, title, desc }) => (
            <div key={title} className="mp-vrow">
              <div className="mp-ic">
                <Icon size={20} />
              </div>
              <div>
                <b>{title}</b>
                <p>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section ref={ref} className="mh2-sec">
        <div className="mh2-h2">Notre parcours</div>
        <h2 className="mh2-t2">
          Quelques étapes <em>clés</em>
        </h2>
        <div className="mp-tl" style={{ paddingLeft: 6 }}>
          {timeline.map((it) => (
            <div key={it.year} className="mp-ts">
              <div className="mp-tn yr">{it.year}</div>
              <div className="mp-tb">
                <em>{it.tag}</em>
                <b>{it.title}</b>
                <p>{it.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <PageCta
        title={
          <>
            Envie de travailler <em>avec nous ?</em>
          </>
        }
        text="Que vous soyez un particulier ou un professionnel, parlons de votre prochain convoyage."
        to="/contact"
        label="Nous contacter"
      />
      <MobileFooter />
    </div>
  );
}
