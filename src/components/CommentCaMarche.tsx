import { Link } from "@tanstack/react-router";
import { FileText, CheckCircle, Truck, ArrowRight } from "lucide-react";

const steps = [
  {
    icon: FileText,
    step: "01",
    title: "Estimez votre trajet",
    desc: "Renseignez le départ, l'arrivée, le type de véhicule et la date souhaitée. Recevez un tarif clair en quelques secondes.",
  },
  {
    icon: CheckCircle,
    step: "02",
    title: "Validez votre demande",
    desc: "Vous recevez un tarif tout inclus et sans engagement. Confirmez votre demande en quelques clics depuis l'estimateur.",
  },
  {
    icon: Truck,
    step: "03",
    title: "Votre véhicule est livré",
    desc: "Un convoyeur professionnel prend en charge votre véhicule et vous tient informé jusqu'à la livraison.",
  },
];

export default function CommentCaMarche() {
  return (
    <section
      className="relative py-24 lg:py-28 overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, #0b1026 0%, #111a3d 50%, #0b1026 100%)",
      }}
    >
      {/* Halos discrets */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/4 w-[600px] h-[400px] rounded-full opacity-[0.18] blur-3xl"
        style={{ background: "radial-gradient(closest-side, #e7c76a, transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 right-10 w-[500px] h-[350px] rounded-full opacity-[0.12] blur-3xl"
        style={{ background: "radial-gradient(closest-side, #5fb6ff, transparent 70%)" }}
      />

      <div className="relative max-w-6xl mx-auto px-6">
        <div className="text-center mb-16 lg:mb-20">
          <span className="font-heading text-[10px] tracking-[0.42em] uppercase text-[#e7c76a]">
            Comment ça marche
          </span>
          <h2 className="font-heading text-cream text-3xl md:text-4xl lg:text-[42px] mt-3 tracking-[0.01em] leading-[1.15]">
            Un service simple,{" "}
            <span className="gold-gradient-text">rapide et sécurisé</span>.
          </h2>
          <div className="gold-divider-short mt-6" />
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 relative">
          {/* Filet doré horizontal (timeline) */}
          <div
            aria-hidden
            className="hidden md:block absolute top-24 left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-[#e7c76a]/35 to-transparent"
          />

          {steps.map((s, i) => (
            <div
              key={i}
              className="relative rounded-2xl border border-[#e7c76a]/20 bg-gradient-to-b from-white/[0.04] to-white/[0.01] backdrop-blur-md p-8 lg:p-9 transition-all duration-300 hover:border-[#e7c76a]/45 hover:-translate-y-1 hover:shadow-[0_30px_60px_-30px_rgba(231,199,106,0.35)]"
            >
              {/* Numéro géant doré en arrière-plan */}
              <span
                aria-hidden
                className="absolute top-3 right-5 font-heading text-[64px] lg:text-[72px] leading-none select-none pointer-events-none"
                style={{
                  background: "linear-gradient(180deg, rgba(231,199,106,0.18), rgba(231,199,106,0.02))",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {s.step}
              </span>

              {/* Icône cercle doré */}
              <div className="relative w-14 h-14 rounded-xl border border-[#e7c76a]/40 bg-gradient-to-br from-[#e7c76a]/15 to-[#e7c76a]/0 grid place-items-center mb-6">
                <s.icon className="text-[#e7c76a]" size={22} strokeWidth={1.7} />
              </div>

              <h3 className="font-heading text-cream text-[18px] tracking-[0.02em] mb-3">
                {s.title}
              </h3>
              <p className="text-cream/65 text-[13.5px] leading-relaxed">
                {s.desc}
              </p>
            </div>
          ))}
        </div>

        <div className="text-center mt-14">
          <Link
            to="/tarifs"
            className="edl-cta-gold inline-flex items-center gap-3 px-10 py-4 font-heading text-[12px] tracking-[0.22em] uppercase"
          >
            Estimer mon trajet
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
