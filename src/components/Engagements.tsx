import { Clock, Award, Globe, GraduationCap, Shield, Eye } from "lucide-react";
import MapLigneo from "@/components/MapLigneo";

const engagements = [
  { icon: Shield, title: "Sécurité", text: "Assurance circulation incluse sur chaque mission, véhicule protégé de A à Z." },
  { icon: Clock, title: "Ponctualité", text: "Récupération en moins de 24h selon distance. Respect strict des délais." },
  { icon: Eye, title: "Transparence", text: "Tarifs clairs, péages et carburant inclus. Suivi en temps réel." },
  { icon: Award, title: "Expérience", text: "Plus de 6 ans d'expertise dans le convoyage automobile." },
  { icon: Globe, title: "Couverture nationale", text: "Intervention en France entière et partout en Europe." },
  { icon: GraduationCap, title: "Professionnalisme", text: "Convoyeurs professionnels, formés en continu, tenue professionnelle." },
];

export default function Engagements({ audience = "particuliers" }: { audience?: "particuliers" | "pro" }) {
  return (
    <div className="r4-page services-engagements" data-audience={audience} style={{ minHeight: 0 }}>
      <section id="engagements" className="v4-section" style={{ paddingTop: 40, paddingBottom: 90 }}>
        <div className="v4-section-head">
          <div className="v4-hero-eyebrow" style={{ justifyContent: "center", width: "100%" }}>
            <span className="dot" />Nos engagements
          </div>
          <h2>Sécurité, ponctualité et <span className="audience-accent">transparence</span></h2>
          <p>Une exigence à chaque mission.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, alignItems: "center" }} className="v4-engag-split">
          <div className="v4-services-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            {engagements.map((e, i) => {
              const Icon = e.icon;
              return (
                <div key={i} className="v4-svc-card" style={{ padding: 20 }}>
                  <div className="v4-svc-ic" style={{ width: 40, height: 40, marginBottom: 12 }}>
                    <Icon size={18} strokeWidth={2} />
                  </div>
                  <h3 style={{ fontSize: 14 }}>{e.title}</h3>
                  <p style={{ fontSize: 12.5 }}>{e.text}</p>
                </div>
              );
            })}
          </div>

          <div className="hx-map-card engag-map-card">
            <MapLigneo size="big" />
            <div className="hx-map-caption">
              <p className="engagements-location">Basé à Tours (37)</p>
              <span>Au cœur du réseau routier national</span>
            </div>
          </div>

        </div>
      </section>
    </div>
  );
}
