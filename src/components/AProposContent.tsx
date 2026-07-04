import { Award, Heart, ShieldCheck, Sparkles, Target, Users, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

const valeurs = [
  { icon: ShieldCheck, title: "Fiabilité", desc: "Zéro annulation de notre part. Chaque mission est traitée avec le même niveau d'exigence." },
  { icon: Heart, title: "Proximité", desc: "Un interlocuteur dédié, joignable, qui vous tient informé de chaque étape." },
  { icon: Sparkles, title: "Excellence", desc: "Tenue professionnelle, véhicule rendu propre, mise en main soignée." },
  { icon: Target, title: "Flexibilité", desc: "Soir, week-end, urgence : nous nous adaptons à votre cadence." },
];

const stats = [
  { value: "2 300+", label: "Missions réalisées" },
  { value: "500 000+", label: "Kilomètres parcourus" },
  { value: "98 %", label: "Clients satisfaits" },
  { value: "6 ans", label: "D'expérience terrain" },
];

export default function AProposContent() {
  return (
    <>
      {/* ===== HERO navy ===== */}
      <section
        className="relative overflow-hidden pt-28 pb-28 lg:pt-36 lg:pb-36"
        style={{ background: "linear-gradient(160deg, #061238 0%, #0a1f5c 50%, #0f2d80 100%)" }}
      >
        <div aria-hidden className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(60% 50% at 50% 0%, rgba(231,199,106,0.10), transparent 70%)" }} />
        <div aria-hidden className="cyber-aurora" />
        <div aria-hidden className="cyber-grid opacity-60" />
        <div aria-hidden className="cyber-scanline" />
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <span className="cyber-chip inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[10.5px] uppercase tracking-[0.28em] font-heading">
            Notre histoire
          </span>
          <h1 className="font-heading text-4xl lg:text-6xl tracking-wide text-cream mt-6 leading-[1.1]">
            Le convoyage,
            <br />
            <span className="cyber-title-accent">une affaire de confiance.</span>
          </h1>

          <p className="text-cream/70 text-base lg:text-lg mt-7 leading-relaxed max-w-2xl mx-auto">
            Depuis 2021, Transports Ligneo accompagne particuliers, concessionnaires et loueurs dans le convoyage de leurs véhicules à travers la France.
            <br className="hidden sm:block" />
            Une promesse simple : votre véhicule, livré comme s'il était le nôtre.
          </p>
        </div>

        <div aria-hidden className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ height: "120px" }}>
          <svg viewBox="0 0 1440 120" preserveAspectRatio="none" className="w-full h-full block">
            <path d="M0,80 C320,20 760,5 1080,30 C1240,42 1360,70 1440,55 L1440,120 L0,120 Z"
              fill="var(--surface-cream, #faf7ef)" />
          </svg>
        </div>
      </section>

      {/* ===== Notre histoire — section cream ===== */}
      <section className="py-20 lg:py-24" style={{ background: "var(--surface-cream, #faf7ef)" }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-10 items-start">
            <div>
              <span className="text-[10.5px] uppercase tracking-[0.28em] text-[#b8860b] font-heading">Origine</span>
              <h2 className="font-heading text-3xl lg:text-4xl text-[#0b1026] mt-3 mb-6">
                Une vision née sur le terrain
              </h2>
              <div className="space-y-4 text-[#0b1026]/75 text-[15px] leading-relaxed">
                <p>
                  L'aventure démarre à Tours, en 2021. Après plusieurs années à constater les écarts de qualité du convoyage automobile, le constat est clair : il manque un acteur réellement <span className="text-[#b8860b] font-medium">soigné</span>, capable d'allier rigueur, transparence tarifaire et relation humaine.
                </p>
                <p>
                  Transports Ligneo naît de cette ambition. Une structure à taille humaine, des convoyeurs formés en continu, une assurance circulation incluse, et une exigence absolue sur la prise en main du véhicule.
                </p>
                <p>
                  Six ans plus tard, l'entreprise est devenue le partenaire de référence de plusieurs concessionnaires, loueurs et particuliers exigeants partout en France.
                </p>
              </div>
            </div>

            <div className="card-premium-light p-8 lg:p-9 relative">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e7c76a] to-transparent" />
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full border border-[#e7c76a]/40 bg-[#e7c76a]/10 flex items-center justify-center text-[#b8860b]">
                  <Users size={26} />
                </div>
                <div>
                  <p className="font-heading text-[#0b1026] text-xl tracking-wide">Olivier G.</p>
                  <p className="text-[#0b1026]/55 text-[10.5px] tracking-[0.22em] uppercase mt-0.5">Fondateur &amp; dirigeant</p>
                </div>
              </div>
              <p className="text-[#0b1026]/75 text-[14.5px] leading-relaxed italic border-l-2 border-[#e7c76a] pl-4">
                « Chaque véhicule qui nous est confié est un engagement personnel. Notre métier, c'est avant tout une question de confiance, celle qu'un client place entre nos mains et que nous lui rendons à l'arrivée. »
              </p>
              <div className="h-px bg-[#0b1026]/10 my-7" />
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="font-heading text-[#0b1026] text-3xl">2021</p>
                  <p className="text-[#0b1026]/55 text-[10px] tracking-[0.22em] uppercase mt-1">Création</p>
                </div>
                <div>
                  <p className="font-heading text-[#0b1026] text-3xl">Tours</p>
                  <p className="text-[#0b1026]/55 text-[10px] tracking-[0.22em] uppercase mt-1">Siège social</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Chiffres clés — section navy ===== */}
      <section
        className="relative py-20 lg:py-24"
        style={{ background: "linear-gradient(160deg, #061238 0%, #0a1f5c 50%, #0f2d80 100%)" }}
      >
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e7c76a]/40 to-transparent" />
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <span className="text-[10.5px] uppercase tracking-[0.28em] text-[#e7c76a] font-heading">En chiffres</span>
            <h2 className="font-heading text-3xl lg:text-4xl text-cream mt-3">Les chiffres de la confiance</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {stats.map((s, i) => (
              <div
                key={i}
                className="p-7 rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm text-center hover:border-[#e7c76a]/40 transition-all duration-500"
              >
                <p className="font-heading gold-gradient-text text-3xl lg:text-[40px] mb-2 leading-none">{s.value}</p>
                <p className="text-cream/60 text-[11px] tracking-[0.22em] uppercase">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Mission + Vision — section cream ===== */}
      <section className="py-20 lg:py-24" style={{ background: "var(--surface-cream, #faf7ef)" }}>
        <div className="max-w-5xl mx-auto px-6 grid md:grid-cols-2 gap-6">
          <div className="card-premium-light p-9">
            <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#e7c76a]/40 bg-[#e7c76a]/10 text-[#b8860b]">
              <Target size={22} />
            </div>
            <h3 className="font-heading text-[#0b1026] text-xl tracking-wide mb-3">Notre mission</h3>
            <p className="text-[#0b1026]/70 text-[14.5px] leading-relaxed">
              Acheminer chaque véhicule, partout en France et en Europe, avec le même niveau d'exigence : ponctualité, propreté, traçabilité, et une communication transparente du début à la fin.
            </p>
          </div>
          <div className="card-premium-light p-9">
            <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#e7c76a]/40 bg-[#e7c76a]/10 text-[#b8860b]">
              <Award size={22} />
            </div>
            <h3 className="font-heading text-[#0b1026] text-xl tracking-wide mb-3">Notre vision</h3>
            <p className="text-[#0b1026]/70 text-[14.5px] leading-relaxed">
              Devenir la référence française du convoyage automobile. Un service où la technologie (suivi GPS, inspection digitalisée, espace client) sert avant tout l'humain et la qualité.
            </p>
          </div>
        </div>
      </section>

      {/* ===== Valeurs + CTA — section navy ===== */}
      <section
        className="relative py-20 lg:py-24"
        style={{ background: "linear-gradient(160deg, #061238 0%, #0a1f5c 50%, #0f2d80 100%)" }}
      >
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e7c76a]/40 to-transparent" />
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <span className="text-[10.5px] uppercase tracking-[0.28em] text-[#e7c76a] font-heading">Nos valeurs</span>
            <h2 className="font-heading text-3xl lg:text-4xl text-cream mt-3">Ce qui nous guide chaque jour</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {valeurs.map((v, i) => (
              <div
                key={i}
                className="group p-7 rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm text-center hover:border-[#e7c76a]/40 hover:bg-white/[0.05] transition-all duration-500"
              >
                <div className="w-12 h-12 rounded-full border border-[#e7c76a]/40 bg-[#e7c76a]/10 text-[#e7c76a] flex items-center justify-center mx-auto mb-4">
                  <v.icon size={20} />
                </div>
                <h3 className="font-heading text-cream text-[16px] tracking-wide mb-2">{v.title}</h3>
                <p className="text-cream/60 text-[13px] leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-16 text-center max-w-3xl mx-auto">
            <p className="text-cream/80 text-lg font-heading mb-6">
              Envie d'en savoir plus, ou de nous confier votre prochain trajet ?
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link
                to="/tarifs"
                className="inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-xl bg-gradient-to-r from-[#e7c76a] via-[#d4af37] to-[#e7c76a] bg-[length:200%_100%] hover:bg-[position:100%_0] text-[#0b1026] font-heading text-[11.5px] tracking-[0.24em] uppercase shadow-[0_15px_40px_-12px_rgba(231,199,106,0.55)] transition-all duration-300"
              >
                Estimer un trajet <ArrowRight size={14} />
              </Link>
              <Link
                to="/contact"
                className="inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-xl border border-[#e7c76a]/50 text-cream font-heading text-[11.5px] tracking-[0.24em] uppercase hover:bg-white/5 hover:border-[#e7c76a] transition-all duration-300"
              >
                Nous contacter
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
