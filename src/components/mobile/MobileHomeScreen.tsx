import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Sparkles,
  MapPin,
  Phone,
  ShieldCheck,
  ChevronRight,
  Clock,
  Euro,
  Zap,
  Globe2,
  Award,
  Headphones,
  ArrowRight,
  Star,
  Users,
} from "lucide-react";
import logoLigneo from "@/assets/logo-transports-ligneo-officiel.png";
import MobilePartnersStrip from "@/components/mobile/MobilePartnersStrip";
import MobileDevisGenerator from "@/components/mobile/MobileDevisGenerator";
import { useAuth } from "@/hooks/useAuth";

/**
 * MobileHomeScreen — Electric Onyx Bento
 * Design premium mobile : bento grid, glassmorphism bleu néon, filets dorés.
 * Toutes les fonctionnalités existantes sont préservées :
 *  - Header sticky + logo Ligneo
 *  - CTA Estimer → scroll vers simulateur (#mobile-devis)
 *  - MobileDevisGenerator (simulateur devis inchangé)
 *  - MobilePartnersStrip (partenaires)
 *  - Navigation intelligente selon rôle (client / convoyeur / admin)
 *  - Footer légal complet
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
    <div className="md:hidden relative min-h-screen overflow-x-hidden bg-[#0b1026] text-[#faf7ef] pb-bottom-nav">
      {/* === Background glows (multi-layered blue neon) === */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-32 w-[420px] h-[420px] rounded-full blur-[110px] opacity-70"
        style={{ background: "radial-gradient(circle, rgba(59,111,255,0.35) 0%, transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-[38%] -left-40 w-[360px] h-[360px] rounded-full blur-[110px] opacity-60"
        style={{ background: "radial-gradient(circle, rgba(95,182,255,0.22) 0%, transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[18%] -right-24 w-[300px] h-[300px] rounded-full blur-[100px] opacity-50"
        style={{ background: "radial-gradient(circle, rgba(212,175,55,0.18) 0%, transparent 70%)" }}
      />

      {/* === HEADER STICKY === */}
      <header
        className={`safe-top sticky top-0 z-40 px-5 pt-3 pb-3 flex items-center justify-between transition-all duration-300 ${
          scrolled
            ? "bg-[#0b1026]/85 backdrop-blur-2xl border-b border-white/10 shadow-[0_8px_28px_-14px_rgba(0,0,0,0.8)]"
            : "bg-transparent"
        }`}
      >
        <Link to="/" className="flex items-center gap-2.5 tap-scale" aria-label="Accueil">
          <img
            src={logoLigneo}
            alt="Transports Ligneo"
            className="h-10 w-auto object-contain"
            loading="eager"
          />
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={handleScrollToDevis}
            aria-label="Estimer mon trajet"
            className="h-10 min-w-[44px] px-4 rounded-full text-[10.5px] tracking-[0.22em] uppercase font-heading flex items-center gap-1.5 tap-scale text-[#0b1026] active:scale-[0.97] transition-transform"
            style={{
              background: "linear-gradient(135deg, #e7c76a 0%, #d4af37 100%)",
              boxShadow:
                "0 8px 24px -8px rgba(212,175,55,0.55), 0 0 0 1px rgba(255,255,255,0.15) inset, 0 1px 0 rgba(255,255,255,0.4) inset",
            }}
          >
            <Sparkles size={13} /> Estimer
          </button>
          <button
            onClick={goEspace}
            aria-label="Mon espace"
            className="w-11 h-11 rounded-full border border-white/15 bg-white/[0.04] backdrop-blur-md flex items-center justify-center tap-scale active:scale-[0.97] transition-transform"
          >
            <ShieldCheck size={17} className="text-[#e7c76a]" />
          </button>
        </div>
      </header>

      {/* === MAIN BENTO === */}
      <main className="relative z-10 px-4 pt-2 space-y-4">
        {/* --- Hero Bento Card --- */}
        <Reveal>
          <section
            className="relative overflow-hidden rounded-[2rem] p-7 backdrop-blur-xl border border-white/10 bg-white/[0.045]"
            style={{
              boxShadow:
                "0 30px 80px -30px rgba(59,111,255,0.35), 0 0 0 1px rgba(255,255,255,0.04) inset",
            }}
          >
            <span
              aria-hidden
              className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#5fb6ff] to-transparent"
            />
            <span
              aria-hidden
              className="absolute -top-16 -right-16 w-40 h-40 rounded-full blur-3xl bg-[#3b6fff]/25"
            />

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#3b6fff]/40 bg-[#3b6fff]/10 mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#5fb6ff] animate-pulse shadow-[0_0_8px_#5fb6ff]" />
              <span className="text-[9.5px] tracking-[0.28em] uppercase text-[#5fb6ff] font-heading">
                Disponible 7j/7
              </span>
            </div>

            <h1 className="font-heading text-[36px] leading-[1.05] tracking-[-0.01em] text-cream">
              Le convoyage <br />
              <span className="italic bg-gradient-to-r from-[#e7c76a] to-[#d4af37] bg-clip-text text-transparent">
                haute couture.
              </span>
            </h1>

            <p className="text-cream/60 text-[13.5px] leading-relaxed mt-4 max-w-[22ch] font-light">
              Transport automobile premium. Tarif live en 30 secondes,
              livraison suivie à chaque étape.
            </p>

            <button
              onClick={handleScrollToDevis}
              className="mt-6 h-12 px-5 rounded-2xl inline-flex items-center gap-2 text-[12px] tracking-[0.2em] uppercase font-heading text-white active:scale-[0.97] transition-transform"
              style={{
                background: "linear-gradient(135deg, #3b6fff 0%, #5fb6ff 100%)",
                boxShadow:
                  "0 12px 32px -8px rgba(59,111,255,0.55), 0 0 0 1px rgba(255,255,255,0.18) inset",
              }}
            >
              Estimer mon trajet
              <ArrowRight size={15} />
            </button>
          </section>
        </Reveal>

        {/* --- Simulator Bento Card --- */}
        <Reveal delay={80}>
          <section
            id="mobile-devis"
            className="scroll-mt-24 relative rounded-[2rem] p-1 border border-[#3b6fff]/30 bg-[#111a3d]/70 backdrop-blur-xl"
            style={{
              boxShadow:
                "0 30px 70px -22px rgba(59,111,255,0.30), 0 0 0 1px rgba(255,255,255,0.05) inset",
            }}
          >
            <div className="flex items-end justify-between px-5 pt-5 pb-3">
              <div>
                <p className="text-[9.5px] tracking-[0.3em] uppercase text-[#e7c76a]/90 font-heading">
                  Estimation · 30 sec
                </p>
                <h2 className="font-heading text-cream text-[20px] tracking-wide mt-1.5">
                  Simulateur direct
                </h2>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-[#e7c76a]/10 border border-[#e7c76a]/35 text-[9px] tracking-[0.22em] uppercase text-[#e7c76a] font-heading">
                Gratuit
              </span>
            </div>
            {/* Simulateur inchangé — toute la logique métier préservée */}
            <MobileDevisGenerator />
          </section>
        </Reveal>

        {/* --- Trust Bento Row (2 cols) --- */}
        <Reveal delay={120}>
          <div className="grid grid-cols-2 gap-3">
            <BentoStat
              value="4.9/5"
              label={<>Note clients<br />satisfaits</>}
              icon={<Star size={13} className="text-[#e7c76a] fill-[#e7c76a]" />}
              accent="gold"
            />
            <BentoStat
              value="6+ ans"
              label={<>Expérience<br />terrain</>}
              icon={<Award size={13} className="text-[#5fb6ff]" />}
              accent="blue"
            />
          </div>
        </Reveal>

        {/* --- Trust chips (compact glassmorphism) --- */}
        <Reveal delay={160}>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { icon: Zap, label: "Réponse immédiate" },
              { icon: Euro, label: "Tarif transparent" },
              { icon: ShieldCheck, label: "Assurance incluse" },
              { icon: Globe2, label: "Service Europe" },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 px-3 py-2.5 rounded-2xl border border-white/10 bg-white/[0.035] backdrop-blur-sm"
              >
                <Icon size={14} className="text-[#e7c76a] shrink-0" />
                <span className="text-cream/85 text-[11px] tracking-wide">{label}</span>
              </div>
            ))}
          </div>
        </Reveal>

        {/* --- Comment ça marche Bento --- */}
        <Reveal delay={200}>
          <section
            className="relative rounded-[2rem] p-6 border border-white/10 bg-white/[0.045] backdrop-blur-xl"
            style={{
              boxShadow:
                "0 24px 60px -22px rgba(59,111,255,0.22), 0 0 0 1px rgba(255,255,255,0.04) inset",
            }}
          >
            <div className="flex items-end justify-between mb-6">
              <h3 className="font-heading text-cream text-[22px] leading-tight">
                Expérience{" "}
                <span className="italic text-[#e7c76a]">premium.</span>
              </h3>
              <Link
                to="/comment-ca-marche"
                className="text-[#e7c76a] text-[10.5px] tracking-[0.2em] uppercase flex items-center gap-1 font-heading"
              >
                Détails <ChevronRight size={12} />
              </Link>
            </div>
            <div className="space-y-5">
              <Step
                n="01"
                title="Réservation express"
                desc="Estimation instantanée, confirmation en 2 minutes."
                color="blue"
              />
              <Step
                n="02"
                title="Prise en charge premium"
                desc="État des lieux digitalisé, assurance incluse."
                color="gold"
              />
              <Step
                n="03"
                title="Suivi temps réel"
                desc="Tracking GPS et notifications à chaque étape."
                color="blue"
              />
            </div>
          </section>
        </Reveal>

        {/* --- Engagements Bento (single wide) --- */}
        <Reveal delay={240}>
          <section
            className="relative rounded-[2rem] p-6 border border-[#e7c76a]/25 bg-gradient-to-b from-[rgba(20,28,60,0.7)] to-[rgba(11,16,38,0.85)] backdrop-blur-xl"
            style={{
              boxShadow:
                "0 24px 60px -22px rgba(212,175,55,0.18), 0 0 0 1px rgba(255,255,255,0.04) inset",
            }}
          >
            <p className="text-[9.5px] tracking-[0.3em] uppercase text-[#e7c76a] font-heading">
              Nos engagements
            </p>
            <h3 className="font-heading text-cream text-[20px] tracking-wide mt-1.5 mb-5">
              Un service <span className="italic text-[#e7c76a]">à votre image.</span>
            </h3>
            <div className="space-y-4">
              <Engagement icon={<ShieldCheck size={16} />} title="0 annulation" desc="Chaque mission validée est assurée jusqu'au bout." />
              <Engagement icon={<Clock size={16} />} title="Prise en charge 24h" desc="Selon distance et disponibilité." />
              <Engagement icon={<Headphones size={16} />} title="7j/7 disponible" desc="Un interlocuteur dédié pour vos urgences." />
            </div>
          </section>
        </Reveal>

        {/* --- Partenaires (composant existant) --- */}
        <Reveal delay={280}>
          <div className="rounded-[2rem] overflow-hidden border border-white/10 bg-white/[0.035] backdrop-blur-xl">
            <MobilePartnersStrip />
          </div>
        </Reveal>

        {/* --- CTA Contact final --- */}
        <Reveal delay={320}>
          <section
            className="relative overflow-hidden rounded-[2rem] p-6 border border-[#3b6fff]/30"
            style={{
              background:
                "linear-gradient(135deg, rgba(59,111,255,0.18) 0%, rgba(17,26,61,0.9) 100%)",
              boxShadow:
                "0 24px 60px -22px rgba(59,111,255,0.35), 0 0 0 1px rgba(255,255,255,0.06) inset",
            }}
          >
            <div className="flex items-start gap-4">
              <span className="shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center bg-white/10 border border-white/15">
                <Phone size={20} className="text-[#5fb6ff]" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-heading text-cream text-[17px] leading-tight">
                  Une question ? <span className="italic text-[#e7c76a]">Parlons-en.</span>
                </p>
                <p className="text-cream/60 text-[12px] mt-1">
                  Devis personnalisé, urgences, flottes.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5 mt-5">
              <a
                href="tel:0782456181"
                className="h-12 rounded-2xl flex items-center justify-center gap-2 text-[11px] tracking-[0.2em] uppercase font-heading text-white active:scale-[0.97] transition-transform"
                style={{
                  background: "linear-gradient(135deg, #3b6fff 0%, #5fb6ff 100%)",
                  boxShadow: "0 10px 28px -10px rgba(59,111,255,0.6)",
                }}
              >
                <Phone size={14} /> Appeler
              </a>
              <Link
                to="/contact"
                className="h-12 rounded-2xl flex items-center justify-center gap-2 text-[11px] tracking-[0.2em] uppercase font-heading text-[#e7c76a] border border-[#e7c76a]/40 bg-[#e7c76a]/5 active:scale-[0.97] transition-transform"
              >
                <Users size={14} /> Contact
              </Link>
            </div>
          </section>
        </Reveal>
      </main>

      {/* === FOOTER === */}
      <footer className="relative z-10 px-5 pt-8 pb-6 mt-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] backdrop-blur-md p-4 flex items-center gap-3">
          <span className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl border border-[#e7c76a]/35 bg-[#e7c76a]/8">
            <MapPin className="text-[#e7c76a]" size={17} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-cream text-[13px] font-heading tracking-wide">Basé à Tours (37)</p>
            <p className="text-cream/55 text-[11px] mt-0.5 truncate">
              07 82 45 61 81 · contact@transportsligneo.fr
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center gap-4 mt-5 text-[11px] text-cream/45 font-heading tracking-wider uppercase">
          <Link to="/cgv" className="hover:text-[#e7c76a] transition-colors">CGV</Link>
          <span className="text-cream/20">·</span>
          <Link to="/mentions-legales" className="hover:text-[#e7c76a] transition-colors">Mentions</Link>
          <span className="text-cream/20">·</span>
          <Link to="/confidentialite" className="hover:text-[#e7c76a] transition-colors">Privacy</Link>
        </div>
        <p className="text-center text-cream/30 text-[10px] mt-3 tracking-wider">
          © {new Date().getFullYear()} Transports LIGNEO — La tranquillité sur toute la ligne.
        </p>
      </footer>
    </div>
  );
}

/* ============================================================
   === Sub-components ===
   ============================================================ */

/** Fade-in + translate au scroll via IntersectionObserver (CSS-only anim) */
function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        transitionDelay: `${delay}ms`,
      }}
      className={`transition-all duration-700 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
    >
      {children}
    </div>
  );
}

function BentoStat({
  value,
  label,
  icon,
  accent,
}: {
  value: string;
  label: React.ReactNode;
  icon: React.ReactNode;
  accent: "gold" | "blue";
}) {
  const isGold = accent === "gold";
  return (
    <div
      className="relative rounded-[1.6rem] p-4 border backdrop-blur-xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.035)",
        borderColor: isGold ? "rgba(231,199,106,0.28)" : "rgba(95,182,255,0.28)",
        boxShadow: isGold
          ? "0 16px 40px -20px rgba(212,175,55,0.25), 0 0 0 1px rgba(255,255,255,0.04) inset"
          : "0 16px 40px -20px rgba(59,111,255,0.28), 0 0 0 1px rgba(255,255,255,0.04) inset",
      }}
    >
      <div className="flex items-center gap-1.5 mb-3">
        {icon}
        <span
          className={`text-[9px] tracking-[0.25em] uppercase font-heading ${
            isGold ? "text-[#e7c76a]/85" : "text-[#5fb6ff]/85"
          }`}
        >
          {isGold ? "Confiance" : "Expertise"}
        </span>
      </div>
      <p
        className="font-heading text-[26px] leading-none"
        style={{ color: isGold ? "#e7c76a" : "#faf7ef" }}
      >
        {value}
      </p>
      <p className="text-[10.5px] uppercase tracking-[0.14em] text-cream/50 leading-tight mt-2 font-medium">
        {label}
      </p>
    </div>
  );
}

function Step({
  n,
  title,
  desc,
  color,
}: {
  n: string;
  title: string;
  desc: string;
  color: "blue" | "gold";
}) {
  const isBlue = color === "blue";
  return (
    <div className="flex gap-4 items-start">
      <span
        className={`w-9 h-9 shrink-0 rounded-full border flex items-center justify-center text-[11px] font-bold font-heading ${
          isBlue
            ? "border-[#3b6fff]/45 text-[#5fb6ff]"
            : "border-[#e7c76a]/45 text-[#e7c76a]"
        }`}
        style={{
          boxShadow: isBlue
            ? "0 0 20px -6px rgba(59,111,255,0.5)"
            : "0 0 20px -6px rgba(212,175,55,0.4)",
        }}
      >
        {n}
      </span>
      <div className="flex-1 min-w-0 pt-1">
        <p className="text-cream text-[13.5px] font-heading tracking-[0.04em] uppercase leading-tight">
          {title}
        </p>
        <p className="text-cream/55 text-[12px] mt-1 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function Engagement({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-10 h-10 shrink-0 rounded-xl border border-[#e7c76a]/35 bg-[#e7c76a]/10 flex items-center justify-center text-[#e7c76a]">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-cream text-[13px] font-heading tracking-[0.06em] uppercase">{title}</p>
        <p className="text-cream/60 text-[12px] mt-1 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
