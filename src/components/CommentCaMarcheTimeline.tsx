import { Link } from "@tanstack/react-router";
import { FileText, Car, MapPin, CheckCircle, ShieldCheck, Clock, ArrowRight } from "lucide-react";

const steps = [
  {
    icon: FileText,
    n: "01",
    title: "Réservation",
    desc: "Estimez votre trajet en ligne en moins de 30 secondes. Validez votre devis, communiquez les informations du véhicule et choisissez votre date de prise en charge.",
    bullets: ["Estimation instantanée", "Devis transparent", "Confirmation par email"],
  },
  {
    icon: Car,
    n: "02",
    title: "Prise en charge",
    desc: "Notre convoyeur dédié récupère votre véhicule à l'endroit convenu. Inspection complète, photos contradictoires et mise en main soignée.",
    bullets: ["Inspection 360°", "État des lieux signé", "Communication directe"],
  },
  {
    icon: MapPin,
    n: "03",
    title: "Livraison",
    desc: "Votre véhicule est conduit par un professionnel formé, suivi en temps réel, puis remis au destinataire avec inspection finale et compte-rendu.",
    bullets: ["Suivi GPS", "Livraison ponctuelle", "Compte-rendu complet"],
  },
];

export default function CommentCaMarcheTimeline() {
  return (
    <>
      {/* ===== HERO navy premium ===== */}
      <section
        className="relative overflow-hidden pt-28 pb-28 lg:pt-36 lg:pb-36"
        style={{ background: "linear-gradient(180deg, #0b1026 0%, #111a3d 100%)" }}
      >
        <div aria-hidden className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(60% 50% at 50% 0%, rgba(231,199,106,0.10), transparent 70%)" }} />
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#e7c76a]/40 bg-[#e7c76a]/[0.08] px-4 py-1.5 text-[10.5px] uppercase tracking-[0.28em] text-[#e7c76a] font-heading">
            Notre process
          </span>
          <h1 className="font-heading text-4xl lg:text-6xl tracking-wide text-cream mt-6 leading-[1.1]">
            Comment <span className="gold-gradient-text">ça marche</span>
          </h1>
          <p className="text-cream/70 mt-6 text-base lg:text-lg leading-relaxed">
            De la réservation à la livraison, un processus simple, fluide et transparent.
          </p>
        </div>

        <div aria-hidden className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ height: "120px" }}>
          <svg viewBox="0 0 1440 120" preserveAspectRatio="none" className="w-full h-full block">
            <path d="M0,80 C320,20 760,5 1080,30 C1240,42 1360,70 1440,55 L1440,120 L0,120 Z"
              fill="var(--surface-cream, #faf7ef)" />
          </svg>
        </div>
      </section>

      {/* ===== TIMELINE — section cream ===== */}
      <section className="py-20 lg:py-24" style={{ background: "var(--surface-cream, #faf7ef)" }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="relative">
            <div
              className="absolute left-6 md:left-1/2 top-2 bottom-2 w-px bg-gradient-to-b from-[#e7c76a]/30 via-[#d4af37]/50 to-[#e7c76a]/30"
              aria-hidden
            />

            <div className="space-y-12 md:space-y-20">
              {steps.map((step, i) => {
                const Icon = step.icon;
                const isLeft = i % 2 === 0;
                return (
                  <div key={i} className="relative md:grid md:grid-cols-2 md:gap-14 items-center">
                    {/* Pastille dorée */}
                    <div className="absolute left-6 md:left-1/2 -translate-x-1/2 z-10">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#e7c76a] to-[#d4af37] flex items-center justify-center shadow-[0_10px_30px_-8px_rgba(231,199,106,0.6)]">
                        <Icon className="text-[#0b1026]" size={22} strokeWidth={2.2} />
                      </div>
                    </div>

                    <div
                      className={`pl-24 md:pl-0 ${
                        isLeft ? "md:pr-14 md:text-right" : "md:col-start-2 md:pl-14"
                      }`}
                    >
                      <div className="card-premium-light p-7 lg:p-9 inline-block w-full">
                        <p className="font-heading text-[#b8860b] text-[10.5px] tracking-[0.3em] uppercase mb-2">
                          Étape {step.n}
                        </p>
                        <h2 className="font-heading text-2xl lg:text-[28px] text-[#0b1026] tracking-wide mb-3">
                          {step.title}
                        </h2>
                        <p className="text-[#0b1026]/70 text-[14.5px] leading-relaxed mb-5">
                          {step.desc}
                        </p>
                        <ul className={`space-y-2 ${isLeft ? "md:flex md:flex-col md:items-end" : ""}`}>
                          {step.bullets.map((b, j) => (
                            <li
                              key={j}
                              className={`flex items-center gap-2 text-[#0b1026]/75 text-[13px] ${
                                isLeft ? "md:flex-row-reverse" : ""
                              }`}
                            >
                              <CheckCircle size={14} className="text-[#b8860b] shrink-0" />
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className={isLeft ? "hidden md:block md:col-start-2" : "hidden md:block md:col-start-1 md:row-start-1"} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ===== Réassurance + CTA — section navy ===== */}
      <section
        className="relative py-20 lg:py-24"
        style={{ background: "linear-gradient(180deg, #0b1026 0%, #111a3d 100%)" }}
      >
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e7c76a]/40 to-transparent" />
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid sm:grid-cols-3 gap-5 mb-12">
            {[
              { icon: ShieldCheck, label: "Assurance incluse" },
              { icon: Clock, label: "Disponible 7j/7" },
              { icon: CheckCircle, label: "0 annulation" },
            ].map((r, i) => (
              <div
                key={i}
                className="group p-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm text-center hover:border-[#e7c76a]/40 transition-all duration-500"
              >
                <div className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#e7c76a]/40 bg-[#e7c76a]/10 text-[#e7c76a]">
                  <r.icon size={20} />
                </div>
                <p className="text-cream/85 text-[11.5px] font-heading tracking-[0.22em] uppercase">{r.label}</p>
              </div>
            ))}
          </div>

          <div className="text-center">
            <p className="text-cream/80 text-lg lg:text-xl font-heading mb-6">
              Prêt à confier votre véhicule ?
            </p>
            <Link
              to="/tarifs"
              className="inline-flex items-center justify-center gap-2.5 px-10 py-4 rounded-xl bg-gradient-to-r from-[#e7c76a] via-[#d4af37] to-[#e7c76a] bg-[length:200%_100%] hover:bg-[position:100%_0] text-[#0b1026] font-heading text-[12px] tracking-[0.24em] uppercase shadow-[0_15px_40px_-10px_rgba(231,199,106,0.7)] transition-all duration-300"
            >
              Estimer mon trajet <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
