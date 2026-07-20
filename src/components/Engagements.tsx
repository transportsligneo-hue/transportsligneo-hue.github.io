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

export default function Engagements() {
  return (
    <div className="r4-page" style={{ minHeight: 0 }}>
      <section id="engagements" className="v4-section" style={{ paddingTop: 40, paddingBottom: 90 }}>
        <div className="v4-section-head">
          <div className="v4-hero-eyebrow" style={{ justifyContent: "center", width: "100%" }}>
            <span className="dot" />Nos engagements
          </div>
          <h2>Sécurité, ponctualité et <span className="v4-accent">transparence</span></h2>
          <p>Une exigence à chaque mission.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, alignItems: "center" }} className="v4-engag-split">
          <div className="v4-services-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            {engagements.map((e, i) => {
              const Icon = e.icon;
              return (
                <div key={i} className="v4-svc-card" style={{ padding: 20 }}>
                  <div className="v4-svc-ic" style={{ width: 40, height: 40, marginBottom: 12 }}>
                    <Icon size={18} color="#8fb4ff" strokeWidth={2} />
                  </div>
                  <h3 style={{ fontSize: 14 }}>{e.title}</h3>
                  <p style={{ fontSize: 12.5 }}>{e.text}</p>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <img
              src={franceMapImg}
              alt="Carte de France · Basé à Tours (37)"
              style={{ width: "100%", maxWidth: 420, objectFit: "contain", filter: "drop-shadow(0 0 40px rgba(63,123,255,0.25))" }}
              loading="lazy"
              width={1024}
              height={1024}
            />
            <div style={{ marginTop: 20, textAlign: "center" }}>
              <p style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 700, color: "#6ea1ff", letterSpacing: "0.15em", fontSize: 16 }}>
                Basé à Tours (37)
              </p>
              <p style={{ color: "var(--v4-text-muted)", fontSize: 12, marginTop: 4 }}>
                Au cœur du réseau routier national
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
