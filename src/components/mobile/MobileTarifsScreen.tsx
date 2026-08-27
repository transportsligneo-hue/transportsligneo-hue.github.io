import { Link } from "@tanstack/react-router";
import { MapPin, Phone, ShieldCheck, Zap, CheckCircle2, ArrowRight, Fuel, Route as RouteIcon, Clock, Car } from "lucide-react";
import DevisGenerator from "@/components/DevisGenerator";

/**
 * MobileTarifsScreen · page Tarifs dédiée mobile, ambiance navy/or
 * cohérente avec MobileHomeScreen. Reprend le simulateur réel.
 */
export default function MobileTarifsScreen() {

  return (
    <div
      className="md:hidden relative min-h-screen overflow-x-hidden text-white pb-24 pt-[118px]"
      style={{
        background:
          "radial-gradient(520px 440px at 90% 0%, rgba(63,123,255,0.28), transparent 60%)," +
          "radial-gradient(420px 360px at -8% 22%, rgba(217,181,74,0.10), transparent 60%)," +
          "radial-gradient(480px 420px at 105% 60%, rgba(79,140,255,0.16), transparent 60%)," +
          "linear-gradient(180deg, #0a1230 0%, #0a1230 10%, #070c1f 34%, #060a1a 70%, #050813 100%)",
      }}
    >
      {/* Hero */}
      <section className="relative z-[1] px-[22px] pt-6 pb-2">
        <div className="flex items-center gap-2 uppercase mb-3 text-[10.5px] font-semibold tracking-[0.2em] text-[#4f8cff]"
          style={{ fontFamily: "'Space Grotesk', sans-serif", textShadow: "0 0 12px rgba(63,123,255,0.6)" }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#4f8cff]" style={{ boxShadow: "0 0 8px #4f8cff" }} />
          Tarifs
        </div>
        <h1 className="text-[32px] leading-[1.08] font-extrabold tracking-[-0.01em] mb-3 text-white" style={{ fontFamily: "'Poppins', sans-serif" }}>
          Un tarif <span style={{ color: "#6ea1ff", textShadow: "0 0 18px rgba(91,143,255,0.8)" }}>clair et juste</span>.
        </h1>
        <p className="text-[13px] leading-[1.55] text-[#dbe3ff] max-w-[320px]">
          Péages, carburant et assurance inclus. Aucun frais caché, devis instantané.
        </p>
      </section>

      {/* Simulateur réel */}
      <div className="relative z-[3] mx-[18px] mt-5">
        <DevisGenerator variant="flat" />
      </div>

      {/* Grille tarifaire */}
      <section className="relative z-[1] px-[22px] pt-10">
        <div className="flex items-center gap-2 uppercase mb-3 text-[10px] font-semibold tracking-[0.2em] text-[#d9b54a]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          <span className="w-1.5 h-1.5 rounded-full bg-[#d9b54a]" />
          Nos tarifs
        </div>
        <h2 className="text-[22px] font-extrabold text-white leading-tight mb-4" style={{ fontFamily: "'Poppins', sans-serif" }}>
          À partir de <span style={{ color: "#6ea1ff" }}>0,85 €/km</span>
        </h2>

        <div className="grid grid-cols-1 gap-3">
          <PriceCard
            title="Tours intra"
            lines={[
              { l: "Livraison simple", p: "70 €" },
              { l: "Livraison + Restitution", p: "129 €" },
            ]}
            footnote="Assurance, péage & carburant inclus · TTC"
          />
          <PriceCard
            title="Hors agglomération (37)"
            lines={[
              { l: "Livraison simple", p: "99 €" },
              { l: "Livraison + Restitution", p: "129 €" },
            ]}
            footnote="Assurance, péage & carburant inclus · TTC"
          />
          <PriceCard
            title="Options"
            lines={[
              { l: "Express (24h), soir, week-end", p: "+20 %" },
              { l: "Lavage intérieur", p: "Sur devis" },
              { l: "Lavage intérieur + extérieur", p: "Sur devis" },
              { l: "Stockage véhicules", p: "Sur devis" },
            ]}
          />
        </div>

        <p className="mt-4 text-[11.5px] text-[#9aa6c9] leading-relaxed">
          Hors département 37 et limitrophes, pour les trajets de plus de 200 km. Assurance tout risque incluse.
        </p>
      </section>

      {/* Ce qui est inclus */}
      <section className="relative z-[1] px-[22px] pt-10">
        <div className="flex items-center gap-2 uppercase mb-3 text-[10px] font-semibold tracking-[0.2em] text-[#d9b54a]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          <span className="w-1.5 h-1.5 rounded-full bg-[#d9b54a]" />
          Toujours inclus
        </div>
        <h2 className="text-[20px] font-extrabold text-white leading-tight mb-4" style={{ fontFamily: "'Poppins', sans-serif" }}>
          Transparence totale
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <MiniIncluded icon={<Fuel size={16} className="text-[#8fb4ff]" />} title="Péages & carburant" />
          <MiniIncluded icon={<ShieldCheck size={16} className="text-[#8fb4ff]" />} title="Assurance tous risques" />
          <MiniIncluded icon={<CheckCircle2 size={16} className="text-[#8fb4ff]" />} title="0 frais caché" />
          <MiniIncluded icon={<Zap size={16} className="text-[#8fb4ff]" />} title="Devis en 30 s" />
          <MiniIncluded icon={<Car size={16} className="text-[#8fb4ff]" />} title="Convoyeur attitré" />
          <MiniIncluded icon={<MapPin size={16} className="text-[#8fb4ff]" />} title="Suivi GPS live" />
        </div>
      </section>

      {/* Comment est calculé le prix */}
      <section className="relative z-[1] px-[22px] pt-10">
        <div className="flex items-center gap-2 uppercase mb-3 text-[10px] font-semibold tracking-[0.2em] text-[#4f8cff]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          <span className="w-1.5 h-1.5 rounded-full bg-[#4f8cff]" />
          Le détail
        </div>
        <h2 className="text-[20px] font-extrabold text-white leading-tight mb-4" style={{ fontFamily: "'Poppins', sans-serif" }}>
          Comment est calculé votre prix
        </h2>
        <div className="flex flex-col gap-2.5">
          <FactorRow icon={<RouteIcon size={15} />} title="La distance" desc="Calculée entre l'enlèvement et la livraison." />
          <FactorRow icon={<Car size={15} />} title="Le type de véhicule" desc="Citadine, berline, SUV ou utilitaire." />
          <FactorRow icon={<ArrowRight size={15} />} title="Livraison simple ou avec restitution" desc="La restitution est proposée à un tarif préférentiel." />
          <FactorRow icon={<Clock size={15} />} title="Le délai souhaité" desc="Une mission express (< 24h) : supplément de 20 %." />
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-[1] px-[22px] pt-10">
        <div
          className="rounded-[22px] p-5 border border-[rgba(122,163,255,0.24)]"
          style={{ background: "linear-gradient(150deg, rgba(63,123,255,0.16), rgba(217,181,74,0.10))" }}
        >
          <div className="flex items-center gap-2 uppercase mb-2 text-[10px] font-semibold tracking-[0.2em] text-[#d9b54a]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#d9b54a]" />
            Une question ?
          </div>
          <h3 className="text-[18px] font-extrabold text-white mb-1.5" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Parlez à un conseiller
          </h3>
          <p className="text-[12.5px] text-[#dbe3ff] mb-4">Volume, trajet particulier : nous adaptons le devis à votre besoin.</p>
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-[13px] font-bold text-[#0a1230]"
            style={{ background: "linear-gradient(135deg, #d9b54a, #e7c76a)", boxShadow: "0 10px 24px rgba(217,181,74,0.35)" }}
          >
            <Phone size={14} strokeWidth={2.4} /> Contacter un conseiller
          </Link>
        </div>
      </section>

      {/* Footer minimal */}
      <footer className="relative z-[1] px-5 pt-10 pb-8 mt-6">
        <div className="rounded-[22px] border border-white/[0.08] bg-white/[0.03] p-4 flex items-center gap-3 backdrop-blur-xl">
          <span className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-2xl border border-[#60a5fa]/35 bg-[#60a5fa]/10">
            <MapPin className="text-[#93c5fd]" size={17} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-white text-[13px] font-bold tracking-wide">Basé à Tours (37)</p>
            <p className="text-white/55 text-[11px] mt-0.5 truncate">07 82 45 61 81 · contact@transportsligneo.fr</p>
          </div>
        </div>
        <p className="text-center text-white/30 text-[10px] mt-5 tracking-wider">
          © {new Date().getFullYear()} Transports LIGNEO
        </p>
      </footer>
    </div>
  );
}

function PriceCard({ title, lines, footnote }: { title: string; lines: { l: string; p: string }[]; footnote?: string }) {
  return (
    <div
      className="rounded-[20px] p-4 border border-[rgba(122,163,255,0.22)]"
      style={{ background: "linear-gradient(150deg, rgba(14,20,44,0.85), rgba(10,18,48,0.7))", backdropFilter: "blur(12px)" }}
    >
      <h3 className="text-[15px] font-bold text-white mb-2.5" style={{ fontFamily: "'Poppins', sans-serif" }}>{title}</h3>
      <div className="flex flex-col">
        {lines.map((row, i) => (
          <div key={row.l} className={`flex items-center justify-between py-2.5 ${i < lines.length - 1 ? "border-b border-white/[0.06]" : ""}`}>
            <span className="text-[12.5px] text-[#9aa6c9]">{row.l}</span>
            <span className="text-[14px] font-bold text-[#6ea1ff]" style={{ fontFamily: "'Poppins', sans-serif" }}>{row.p}</span>
          </div>
        ))}
      </div>
      {footnote ? <p className="mt-2.5 text-[10.5px] text-[#8290b8]">{footnote}</p> : null}
    </div>
  );
}

function MiniIncluded({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div
      className="rounded-[16px] p-3 border border-[rgba(122,163,255,0.2)] flex items-center gap-2.5"
      style={{ background: "rgba(14,20,44,0.7)" }}
    >
      <span className="w-8 h-8 rounded-full bg-[rgba(63,123,255,0.18)] border border-[rgba(122,163,255,0.35)] flex items-center justify-center shrink-0">
        {icon}
      </span>
      <span className="text-[11.5px] font-semibold text-white leading-tight">{title}</span>
    </div>
  );
}

function FactorRow({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div
      className="rounded-[16px] p-3.5 border border-[rgba(122,163,255,0.2)] flex items-start gap-3"
      style={{ background: "rgba(14,20,44,0.7)" }}
    >
      <span className="w-9 h-9 rounded-full bg-[rgba(63,123,255,0.18)] border border-[rgba(122,163,255,0.35)] flex items-center justify-center shrink-0 text-[#8fb4ff]">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[13px] font-bold text-white leading-tight mb-0.5">{title}</div>
        <div className="text-[11.5px] text-[#9aa6c9] leading-snug">{desc}</div>
      </div>
    </div>
  );
}
