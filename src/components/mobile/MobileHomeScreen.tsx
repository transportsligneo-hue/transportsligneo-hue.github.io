import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Sparkles,
  FileText,
  MapPin,
  Phone,
  ShieldCheck,
  ChevronRight,
  Truck,
  Clock,
  Euro,
  Zap,
  Globe2,
  Award,
  Headphones,
} from "lucide-react";
import logoLigneo from "@/assets/logo-transports-ligneo-officiel.png";
import heroChauffeur from "@/assets/hero-chauffeur-ligneo.jpg";
import MobilePartnersStrip from "@/components/mobile/MobilePartnersStrip";
import MobileDevisGenerator from "@/components/mobile/MobileDevisGenerator";
import { useAuth } from "@/hooks/useAuth";

/**
 * Écran d'accueil mobile premium — rythme navy → cream → navy
 * aligné sur le design desktop (Mercedes / Blacklane / Porsche Services).
 */
export default function MobileHomeScreen() {
  const { isAuthenticated, role } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const goEspace = () => {
    if (!isAuthenticated) return navigate({ to: "/login" });
    if (role === "admin" || role === "super_admin") return navigate({ to: "/admin" });
    if (role === "convoyeur") return navigate({ to: "/convoyeur" });
    return navigate({ to: "/dashboard-client" });
  };

  const handleScrollToDevis = () => {
    const el = document.getElementById("mobile-devis");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="md:hidden home-shell min-h-screen pb-bottom-nav">
      {/* === HEADER STICKY PREMIUM === */}
      <header
        className={`safe-top sticky top-0 z-40 px-5 pt-3 pb-3 flex items-center justify-between transition-all duration-300 ${
          scrolled
            ? "bg-[#0b1026]/90 backdrop-blur-xl border-b border-[rgba(212,175,55,0.18)] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.7)]"
            : "bg-transparent"
        }`}
      >
        <Link to="/" className="flex items-center gap-2.5 tap-scale" aria-label="Accueil">
          <img src={logoLigneo} alt="Transports Ligneo" className="h-11 w-auto object-contain" loading="eager" />
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={handleScrollToDevis}
            className="h-9 px-3.5 rounded-full text-[10px] tracking-[0.2em] uppercase font-heading flex items-center gap-1.5 tap-scale text-[#0b1026]"
            style={{
              background: "linear-gradient(135deg, #e7c76a 0%, #d4af37 100%)",
              boxShadow: "0 6px 18px -6px rgba(212,175,55,0.55), inset 0 1px 0 rgba(255,255,255,0.4)",
            }}
            aria-label="Estimer"
          >
            <Sparkles size={12} /> Estimer
          </button>
          <button
            onClick={goEspace}
            className="w-9 h-9 rounded-full border border-[rgba(212,175,55,0.35)] bg-white/[0.04] flex items-center justify-center tap-scale"
            aria-label="Mon espace"
          >
            <ShieldCheck size={16} className="text-[#e7c76a]" />
          </button>
        </div>
      </header>

      {/* === HERO IMAGE FULL-BLEED === */}
      <section className="relative">
        <div className="relative h-[420px] w-full overflow-hidden">
          <img
            src={heroChauffeur}
            alt="Chauffeur Transports LIGNEO devant une Mercedes noire"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: "42% center" }}
            loading="eager"
            fetchPriority="high"
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(180deg, rgba(11,16,38,0.30) 0%, rgba(11,16,38,0.08) 30%, rgba(11,16,38,0.70) 72%, #111a3d 100%)",
            }}
          />
          <div className="absolute inset-x-0 bottom-0 px-5 pb-6">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[rgba(212,175,55,0.4)] bg-white/[0.04] backdrop-blur-md text-[9px] tracking-[0.28em] uppercase text-[#e7c76a] font-heading">
              <span className="w-1.5 h-1.5 rounded-full bg-[#e7c76a] animate-pulse" />
              Disponible 7j/7
            </span>
            <h1 className="font-heading text-cream text-[32px] tracking-[0.01em] mt-4 leading-[1.08]">
              La tranquillité <br />
              <span className="gold-gradient-text italic">sur toute la ligne.</span>
            </h1>
            <p className="text-cream/75 text-[13px] mt-3 leading-relaxed max-w-[88%]">
              Convoyage automobile premium. Tarif live en 30&nbsp;secondes.
            </p>
            <span aria-hidden className="block mt-5 h-px w-24 bg-gradient-to-r from-[#5fb6ff] via-[#e7c76a] to-transparent" />
          </div>
        </div>
      </section>

      {/* === CTA PRINCIPAL === */}
      <section className="px-5 pt-6">
        <button
          onClick={handleScrollToDevis}
          className="edl-cta w-full h-14 rounded-2xl font-heading text-[12px] tracking-[0.22em] uppercase flex items-center justify-center gap-2 text-white tap-scale"
        >
          <Sparkles size={16} />
          Estimer mon trajet
        </button>
        <p className="text-center text-cream/50 text-[11px] mt-3 tracking-[0.08em]">
          Réponse immédiate · Tarif transparent · Assurance incluse
        </p>
      </section>

      {/* === ESTIMATEUR (verre fumé navy) === */}
      <section id="mobile-devis" className="px-5 pt-8 pb-10 scroll-mt-24">
        <div className="flex items-end justify-between mb-4 px-1">
          <div>
            <p className="text-[10px] tracking-[0.28em] uppercase text-[#e7c76a]/90 font-heading">
              Estimation · 30 sec
            </p>
            <h2 className="font-heading text-cream text-[20px] tracking-wide mt-1.5">
              Votre devis instantané
            </h2>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-[#e7c76a]/10 border border-[#e7c76a]/35 text-[9px] tracking-[0.22em] uppercase text-[#e7c76a] font-heading">
            Gratuit
          </span>
        </div>
        {/* Wrapper sans filter/transform pour ne pas casser le portal du picker */}
        <div className="rounded-2xl border border-[rgba(212,175,55,0.22)] bg-gradient-to-b from-[rgba(20,28,60,0.78)] to-[rgba(11,16,38,0.86)] shadow-[0_28px_70px_-22px_rgba(0,0,0,0.75)] p-1">
          <MobileDevisGenerator />
        </div>

        {/* Trust chips */}
        <div className="grid grid-cols-2 gap-2 mt-5">
          {[
            { icon: Zap, label: "Réponse immédiate" },
            { icon: Euro, label: "Tarif transparent" },
            { icon: ShieldCheck, label: "Assurance incluse" },
            { icon: Globe2, label: "Service Europe" },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-[rgba(212,175,55,0.20)] bg-white/[0.025]"
            >
              <Icon size={14} className="text-[#e7c76a] shrink-0" />
              <span className="text-cream/80 text-[11px] tracking-wide">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* === COURBE ORGANIQUE NAVY → CREAM === */}
      <div className="relative h-10 -mb-px">
        <svg
          viewBox="0 0 360 40"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full"
          aria-hidden
        >
          <path d="M0,0 C90,40 270,40 360,0 L360,40 L0,40 Z" fill="#faf7ef" />
        </svg>
      </div>

      {/* ============================================================
          === SECTION CREAM : STATS / RÉASSURANCE PREMIUM ===
          ============================================================ */}
      <section className="bg-[#faf7ef] px-5 pt-8 pb-10 text-[#0b1026]">
        <div className="text-center mb-6">
          <p className="text-[10px] tracking-[0.3em] uppercase text-[#b8902e] font-heading">
            La signature LIGNEO
          </p>
          <h2 className="font-heading text-[#0b1026] text-[22px] tracking-wide mt-2">
            Une exigence, <span className="italic text-[#b8902e]">sans compromis.</span>
          </h2>
        </div>

        <div className="relative bg-white rounded-2xl border border-black/[0.06] shadow-[0_2px_4px_rgba(11,16,38,0.04),0_22px_50px_-26px_rgba(11,16,38,0.20)] px-5 py-6 space-y-5">
          <span
            aria-hidden
            className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#5fb6ff] to-transparent"
          />
          {[
            { icon: Award, title: "6+ ans d'expérience", desc: "Savoir-faire terrain auprès des pros et particuliers." },
            { icon: ShieldCheck, title: "0 annulation", desc: "Chaque mission validée est assurée jusqu'au bout." },
            { icon: Headphones, title: "7j/7 disponible", desc: "Un interlocuteur dédié pour vos urgences." },
          ].map(({ icon: Icon, title, desc }, i) => (
            <div
              key={title}
              className={`flex items-start gap-4 ${i > 0 ? "pt-5 border-t border-[rgba(11,16,38,0.08)]" : ""}`}
            >
              <span className="shrink-0 inline-flex items-center justify-center w-12 h-12 rounded-xl border border-[rgba(212,175,55,0.45)] bg-gradient-to-br from-[rgba(212,175,55,0.14)] to-[rgba(212,175,55,0.04)]">
                <Icon size={20} className="text-[#b8902e]" strokeWidth={1.7} />
              </span>
              <div>
                <h3 className="font-heading text-[#0b1026] text-[13px] tracking-[0.08em] uppercase">
                  {title}
                </h3>
                <p className="text-[#5b6485] text-[12.5px] leading-relaxed mt-1.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* === RACCOURCIS premium (cards cream) === */}
        <div className="grid grid-cols-2 gap-3 mt-7">
          <ShortcutCardLight
            to="/tarifs"
            icon={<FileText size={18} className="text-[#b8902e]" />}
            label="Devis instantané"
            sub="En 30 sec."
          />
          <ShortcutCardLight
            to="/tarifs"
            icon={<Euro size={18} className="text-[#b8902e]" />}
            label="Voir les tarifs"
            sub="Péages inclus"
          />
          <ShortcutCardLight
            to="/comment-ca-marche"
            icon={<Truck size={18} className="text-[#b8902e]" />}
            label="Comment ça marche"
            sub="3 étapes"
          />
          <ShortcutCardLight
            to="/contact"
            icon={<Phone size={18} className="text-[#b8902e]" />}
            label="Nous contacter"
            sub="7j/7"
          />
        </div>
      </section>

      {/* === COURBE CREAM → NAVY === */}
      <div className="relative h-10 -mt-px">
        <svg
          viewBox="0 0 360 40"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full"
          aria-hidden
        >
          <path d="M0,40 C90,0 270,0 360,40 L360,0 L0,0 Z" fill="#faf7ef" />
        </svg>
      </div>

      {/* ============================================================
          === SECTION NAVY : ENGAGEMENTS + ÉTAPES ===
          ============================================================ */}
      <section className="px-5 pt-8 pb-6">
        <div className="text-center mb-6">
          <p className="text-[10px] tracking-[0.3em] uppercase text-[#e7c76a] font-heading">
            Nos engagements
          </p>
          <h2 className="font-heading text-cream text-[22px] tracking-wide mt-2">
            Un service <span className="italic text-[#e7c76a]">à votre image.</span>
          </h2>
          <span aria-hidden className="block mx-auto mt-4 h-px w-20 bg-gradient-to-r from-transparent via-[#5fb6ff] to-transparent" />
        </div>

        <div className="space-y-3">
          <EngagementPremium
            icon={<ShieldCheck size={18} />}
            title="Fiabilité garantie"
            desc="Mission assurée et suivie de bout en bout."
          />
          <EngagementPremium
            icon={<Clock size={18} />}
            title="Prise en charge 24h"
            desc="Selon distance et disponibilité."
          />
          <EngagementPremium
            icon={<Euro size={18} />}
            title="Tarifs transparents"
            desc="Aucun frais caché. Devis en ligne immédiat."
          />
        </div>
      </section>

      {/* === COMMENT ÇA MARCHE === */}
      <section className="px-5 pt-4 pb-8">
        <div className="flex items-end justify-between mb-4">
          <div>
            <p className="text-[10px] tracking-[0.3em] uppercase text-[#e7c76a] font-heading">
              En 3 étapes
            </p>
            <h2 className="font-heading text-cream text-[20px] tracking-wide mt-1.5">
              Simple, rapide, premium.
            </h2>
          </div>
          <Link
            to="/comment-ca-marche"
            className="text-[#e7c76a] text-[11px] tracking-[0.18em] uppercase flex items-center gap-1 font-heading"
          >
            Détails <ChevronRight size={13} />
          </Link>
        </div>
        <div className="space-y-3">
          <StepPremium n="01" title="Estimez votre trajet" desc="Prix, distance et durée en quelques clics." />
          <StepPremium n="02" title="Demandez le devis" desc="Validation rapide, infos transmises automatiquement." />
          <StepPremium n="03" title="Livraison" desc="Convoyeur dédié, suivi à chaque étape." />
        </div>
      </section>

      {/* === PARTENAIRES === */}
      <MobilePartnersStrip />

      {/* === FOOTER MINIMAL === */}
      <footer className="px-5 pt-4 pb-6">
        <div className="rounded-2xl border border-[rgba(212,175,55,0.22)] bg-gradient-to-b from-[rgba(20,28,60,0.6)] to-[rgba(11,16,38,0.7)] p-4 flex items-center gap-3">
          <span className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl border border-[rgba(212,175,55,0.4)] bg-[rgba(212,175,55,0.08)]">
            <MapPin className="text-[#e7c76a]" size={18} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-cream text-[13px] font-heading tracking-wide">Basé à Tours (37)</p>
            <p className="text-cream/55 text-[11px] mt-0.5">07 82 45 61 81 · contact@transportsligneo.fr</p>
          </div>
        </div>
        <div className="flex items-center justify-center gap-4 mt-5 text-[11px] text-cream/45 font-heading tracking-wider uppercase">
          <Link to="/cgv" className="hover:text-[#e7c76a]">CGV</Link>
          <span className="text-cream/20">·</span>
          <Link to="/mentions-legales" className="hover:text-[#e7c76a]">Mentions</Link>
          <span className="text-cream/20">·</span>
          <Link to="/confidentialite" className="hover:text-[#e7c76a]">Privacy</Link>
        </div>
        <p className="text-center text-cream/30 text-[10px] mt-3 tracking-wider">
          © {new Date().getFullYear()} Transports LIGNEO — La tranquillité sur toute la ligne.
        </p>
      </footer>
    </div>
  );
}

/* === Sub-components === */

function ShortcutCardLight({
  to,
  icon,
  label,
  sub,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  sub: string;
}) {
  return (
    <Link
      to={to}
      className="card-premium-light p-4 flex flex-col gap-2.5 min-h-[100px] justify-between"
    >
      <div className="w-10 h-10 rounded-xl border border-[rgba(212,175,55,0.4)] bg-gradient-to-br from-[rgba(212,175,55,0.12)] to-[rgba(212,175,55,0.02)] flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="text-[#0b1026] font-heading text-[12.5px] tracking-[0.06em] uppercase leading-tight">
          {label}
        </p>
        <p className="text-[#5b6485] text-[11px] mt-1">{sub}</p>
      </div>
    </Link>
  );
}

function EngagementPremium({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="relative rounded-2xl border border-[rgba(212,175,55,0.22)] bg-gradient-to-b from-[rgba(20,28,60,0.62)] to-[rgba(11,16,38,0.72)] p-4 flex items-start gap-3 shadow-[0_18px_42px_-22px_rgba(0,0,0,0.7)]">
      <span
        aria-hidden
        className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#e7c76a]/60 to-transparent"
      />
      <span className="w-10 h-10 rounded-xl border border-[rgba(212,175,55,0.35)] bg-[rgba(212,175,55,0.08)] flex items-center justify-center text-[#e7c76a] shrink-0">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-cream text-[13px] font-heading tracking-[0.06em] uppercase">{title}</p>
        <p className="text-cream/60 text-[12px] mt-1 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function StepPremium({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="relative rounded-2xl border border-[rgba(212,175,55,0.22)] bg-gradient-to-b from-[rgba(20,28,60,0.62)] to-[rgba(11,16,38,0.72)] p-4 flex items-start gap-4">
      <span className="font-heading text-[#e7c76a] text-[26px] leading-none w-9 text-center italic">
        {n}
      </span>
      <div className="flex-1 min-w-0 pt-1">
        <p className="text-cream text-[13px] font-heading tracking-[0.06em] uppercase">{title}</p>
        <p className="text-cream/60 text-[12px] mt-1 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
