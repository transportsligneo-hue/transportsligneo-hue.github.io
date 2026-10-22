import { Link, useSearch } from "@tanstack/react-router";
import { Car, Clock, Fuel, MapPin, Phone, Route as RouteIcon, ShieldCheck, Sparkles, Zap, CheckCircle2, ChevronRight } from "lucide-react";
import DevisGenerator, { type DevisGeneratorPrefill } from "@/components/DevisGenerator";
import MobileFooter from "@/components/mobile/MobileFooter";
import { SteeringWheel } from "@/components/mobile/MobileIcons";
import "@/styles/mobile-home-v2.css";

/**
 * MobileTarifsScreen · v2 — page Tarifs mobile, même design que l'accueil mobile.
 * Reprend le vrai simulateur et les mêmes tarifs.
 */
export default function MobileTarifsScreen() {
  const { audience } = useSearch({ from: "/tarifs" });
  const devisPrefill: DevisGeneratorPrefill | undefined = audience === "pro" ? { clientType: "pro_ponctuel" } : undefined;

  return (
    <div className="mh2-root md:hidden">
      <section className="mh2-thero">
        <div className="mh2-h2">Tarifs</div>
        <h1>
          Tarifs de <em>convoyage automobile</em>
        </h1>
        <p>Péages, carburant et assurance inclus. Aucun frais caché, devis instantané.</p>
      </section>

      <div className="mh2-sec" style={{ marginTop: 14 }}>
        <div className="mh2-est">
          <DevisGenerator variant="flat" prefill={devisPrefill} />
        </div>
      </div>

      <section className="mh2-sec">
        <div className="mh2-h2">Nos tarifs</div>
        <div className="mh2-big">
          À partir de <em>0,85 €/km</em>
        </div>
        <PriceCard
          icon={<MapPin size={16} />}
          title="Tours intra"
          lines={[
            { l: "Livraison simple", p: "70 €" },
            { l: "Restitution et livraison", p: "120 €" },
          ]}
          footnote="Assurance, péage & carburant inclus · TTC"
        />
        <PriceCard
          icon={<RouteIcon size={16} />}
          title="Hors agglomération (37)"
          lines={[
            { l: "Livraison simple", p: "90 €" },
            { l: "Restitution et livraison", p: "130 €" },
          ]}
          footnote="Assurance, péage & carburant inclus · TTC"
        />
        <PriceCard
          icon={<Sparkles size={16} />}
          title="Options"
          lines={[
            { l: "Express (24 h)", p: "+20 %" },
            { l: "Soir, week-end", p: "+30 %" },
            { l: "Lavage intérieur", p: "Sur devis", small: true },
            { l: "Lavage intérieur + extérieur", p: "Sur devis", small: true },
            { l: "Stockage véhicules", p: "Sur devis", small: true },
          ]}
        />
        <p className="mh2-note">Hors département 37 et limitrophes, pour les trajets de plus de 200 km. Assurance tous risques incluse.</p>
      </section>

      <section className="mh2-sec">
        <div className="mh2-h2">Toujours inclus</div>
        <h2 className="mh2-t2">
          Transparence <em>totale</em>
        </h2>
        <div className="mh2-inc">
          <Inc icon={<Fuel size={20} />} title="Péages & carburant" sub="Inclus dans le prix" />
          <Inc icon={<ShieldCheck size={20} />} title="Assurance tous risques" sub="De l'enlèvement à la remise" />
          <Inc icon={<CheckCircle2 size={20} />} title="0 frais caché" sub="Le prix affiché est le prix payé" />
          <Inc icon={<Zap size={20} />} title="Devis en 2 min" sub="Réponse immédiate" />
          <Inc icon={<SteeringWheel />} title="Convoyeur attitré" sub="Un pro vérifié" />
          <Inc icon={<RouteIcon size={20} />} title="Suivi GPS live" sub="Position en direct" />
        </div>
      </section>

      <section className="mh2-sec">
        <div className="mh2-h2">Le détail</div>
        <h2 className="mh2-t2">
          Comment est calculé <em>votre prix</em>
        </h2>
        <div className="mh2-tl">
          <Factor icon={<RouteIcon size={22} />} title="La distance" tag="km" desc="Calculée entre l'enlèvement et la livraison." />
          <Factor icon={<Car size={22} />} title="Le type de véhicule" tag="Véhicule" desc="Citadine, berline, SUV ou utilitaire." />
          <Factor icon={<ChevronRight size={22} />} title="Simple ou restitution" tag="Formule" desc="La restitution est proposée à un tarif préférentiel." />
          <Factor icon={<Clock size={22} />} title="Le délai souhaité" tag="+20 %" desc="Mission express (< 24 h) : supplément de 20 %." />
        </div>
      </section>

      <section className="mh2-sec">
        <div className="mh2-cta2">
          <div className="mh2-h2" style={{ color: "#9dc0ff" }}>Une question ?</div>
          <h3>
            Parlez à un <em>conseiller</em>
          </h3>
          <p>Volume, trajet particulier : nous adaptons le devis à votre besoin.</p>
          <Link to="/contact" className="mh2-cbtn">
            <Phone size={15} strokeWidth={2.4} /> Contacter un conseiller
          </Link>
        </div>
      </section>

      <MobileFooter withStores={false} />
    </div>
  );
}

function PriceCard({
  icon,
  title,
  lines,
  footnote,
}: {
  icon: React.ReactNode;
  title: string;
  lines: { l: string; p: string; small?: boolean }[];
  footnote?: string;
}) {
  return (
    <div className="mh2-pc">
      <h3>
        {icon}
        {title}
      </h3>
      {lines.map((row) => (
        <div key={row.l} className="mh2-pl">
          <span>{row.l}</span>
          <b style={row.small ? { fontSize: 12 } : undefined}>{row.p}</b>
        </div>
      ))}
      {footnote ? <small>{footnote}</small> : null}
    </div>
  );
}

function Inc({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="mh2-inc-t">
      <span className="mh2-inc-ic">{icon}</span>
      <span>
        {title}
        <small>{sub}</small>
      </span>
    </div>
  );
}

function Factor({ icon, title, tag, desc }: { icon: React.ReactNode; title: string; tag: string; desc: string }) {
  return (
    <div className="mh2-fr">
      <span className="mh2-node">{icon}</span>
      <div className="mh2-fcard">
        <b>
          {title}
          <i>{tag}</i>
        </b>
        <p>{desc}</p>
      </div>
    </div>
  );
}
