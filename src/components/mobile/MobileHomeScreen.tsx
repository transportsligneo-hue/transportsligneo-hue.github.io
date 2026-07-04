import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  MapPin,
  Phone,
  ShieldCheck,
  ChevronRight,
  Clock,
  Euro,
  Zap,
  Award,
  Headphones,
  ArrowRight,
  Star,
  Truck,
  FileText,
  User,
  Menu,
} from "lucide-react";
import logoLigneo from "@/assets/logo-transports-ligneo-officiel.png";
import heroBg from "@/assets/hero-ligneo-night.jpg";
import MobileDevisGenerator from "@/components/mobile/MobileDevisGenerator";
import { useAuth } from "@/hooks/useAuth";

/**
 * MobileHomeScreen — App-like mobile experience
 * Palette bleu roi profond (comme la capture driver) + accents dorés discrets.
 * Style app, direct, sans emphase marketing.
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
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="md:hidden relative min-h-screen overflow-x-hidden text-white pb-bottom-nav"
      style={{
        background:
          "linear-gradient(180deg, #061238 0%, #0a1f5c 35%, #0f2d80 100%)",
      }}
    >
      {/* Halos discrets */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 w-[380px] h-[380px] rounded-full blur-[110px] opacity-60"
        style={{ background: "radial-gradient(circle, rgba(96,165,250,0.35) 0%, transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-[45%] -left-32 w-[300px] h-[300px] rounded-full blur-[100px] opacity-40"
        style={{ background: "radial-gradient(circle, rgba(125,211,252,0.25) 0%, transparent 70%)" }}
      />

      {/* === HEADER === */}
      <header
        className={`safe-top sticky top-0 z-40 px-4 pt-3 pb-3 flex items-center justify-between transition-all duration-300 ${
          scrolled
            ? "bg-[#061238]/90 backdrop-blur-xl border-b border-white/10"
            : "bg-transparent"
        }`}
      >
        <Link to="/" className="flex items-center gap-3 tap-scale min-w-0" aria-label="Accueil">
          <span
            className="shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center border border-white/15 bg-white/[0.05] overflow-hidden"
            style={{ boxShadow: "0 0 24px -8px rgba(96,165,250,0.5)" }}
          >
            <img src={logoLigneo} alt="Ligneo" className="w-9 h-9 object-contain" loading="eager" />
          </span>
          <div className="min-w-0 flex items-center">
            <p className="font-heading text-white text-[15px] leading-tight tracking-wide truncate">
              Transports Ligneo
            </p>
          </div>
        </Link>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={goEspace}
            aria-label="Mon espace"
            className="w-11 h-11 rounded-2xl border border-white/15 bg-white/[0.05] flex items-center justify-center tap-scale active:scale-95 transition-transform"
          >
            <ShieldCheck size={17} className="text-[#93c5fd]" />
          </button>
          <button
            aria-label="Menu"
            className="w-11 h-11 rounded-2xl border border-white/15 bg-white/[0.05] flex items-center justify-center tap-scale active:scale-95 transition-transform"
          >
            <Menu size={18} className="text-white/85" />
          </button>
        </div>
      </header>

      <main className="relative z-10 px-4 pt-4 space-y-5">
        {/* === Hero image + Greeting === */}
        <Reveal>
          <div
            className="relative rounded-3xl overflow-hidden border border-white/10"
            style={{
              boxShadow:
                "0 24px 60px -22px rgba(59,130,246,0.4), 0 0 0 1px rgba(255,255,255,0.05) inset",
            }}
          >
            <img
              src={heroBg}
              alt="Convoyage automobile premium Ligneo"
              className="w-full h-[260px] object-cover"
              loading="eager"
            />
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(6,18,56,0.15) 0%, rgba(6,18,56,0.55) 55%, rgba(6,18,56,0.95) 100%)",
              }}
            />
            <div className="absolute inset-x-0 bottom-0 p-5">
              <p className="text-[10px] tracking-[0.3em] uppercase text-[#93c5fd] font-heading">
                Accueil
              </p>
              <h1 className="font-heading text-[26px] leading-[1.1] mt-1.5 uppercase tracking-[0.08em] text-gold-luxe">
                Transports Ligneo
              </h1>
              <p className="text-white/75 text-[13px] mt-1.5 leading-relaxed">
                Estimez, réservez et suivez votre convoyage automobile.
              </p>
            </div>
          </div>
        </Reveal>


        {/* === CTA principal === */}
        <Reveal delay={60}>
          <button
            onClick={handleScrollToDevis}
            className="w-full text-left rounded-3xl p-5 border border-[#60a5fa]/40 relative overflow-hidden active:scale-[0.98] transition-transform"
            style={{
              background:
                "linear-gradient(135deg, rgba(59,130,246,0.35) 0%, rgba(15,45,128,0.9) 100%)",
              boxShadow:
                "0 24px 60px -20px rgba(59,130,246,0.55), 0 0 0 1px rgba(255,255,255,0.05) inset",
            }}
          >
            <span
              aria-hidden
              className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl bg-[#60a5fa]/40"
            />
            <div className="flex items-center gap-4 relative">
              <span
                className="w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, #3b82f6, #60a5fa)",
                  boxShadow: "0 10px 24px -8px rgba(59,130,246,0.6)",
                }}
              >
                <Truck size={24} className="text-white" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-heading text-white text-[17px] tracking-wide">
                  Estimer mon trajet
                </p>
                <p className="text-white/60 text-[12px] mt-0.5">
                  Tarif en 30 secondes · gratuit
                </p>
              </div>
              <ArrowRight size={20} className="text-white/70 shrink-0" />
            </div>
          </button>
        </Reveal>

        {/* === Accès rapides === */}
        <Reveal delay={100}>
          <div className="grid grid-cols-2 gap-3">
            <QuickTile
              icon={<FileText size={18} />}
              label="Mes devis"
              onClick={() => navigate({ to: isAuthenticated ? "/dashboard-client/devis" : "/login" })}
            />
            <QuickTile
              icon={<Truck size={18} />}
              label="Mes missions"
              onClick={() =>
                navigate({ to: isAuthenticated ? "/dashboard-client/missions" : "/login" })
              }
            />
            <QuickTile
              icon={<User size={18} />}
              label="Mon espace"
              onClick={goEspace}
            />
            <QuickTile
              icon={<Phone size={18} />}
              label="Contact"
              onClick={() => navigate({ to: "/contact" })}
            />
          </div>
        </Reveal>

        {/* === Simulateur === */}
        <Reveal delay={140}>
          <section
            id="mobile-devis"
            className="scroll-mt-20 rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl overflow-hidden"
            style={{
              boxShadow:
                "0 24px 60px -22px rgba(59,130,246,0.30), 0 0 0 1px rgba(255,255,255,0.04) inset",
            }}
          >
            <div className="flex items-end justify-between px-5 pt-5 pb-3">
              <div>
                <p className="text-[10px] tracking-[0.3em] uppercase text-gold-luxe font-heading">
                  Estimation
                </p>
                <h2 className="font-heading text-white text-[19px] tracking-wide mt-1">
                  Simulateur direct
                </h2>
              </div>
              <span
                className="px-2.5 py-1 rounded-full text-[9px] tracking-[0.22em] uppercase font-heading"
                style={{
                  background: "rgba(96,165,250,0.15)",
                  border: "1px solid rgba(96,165,250,0.35)",
                  color: "#93c5fd",
                }}
              >
                Gratuit
              </span>
            </div>
            <MobileDevisGenerator />
          </section>
        </Reveal>

        {/* === Stats compactes === */}
        <Reveal delay={180}>
          <div>
            <p className="text-[10px] tracking-[0.3em] uppercase text-gold-luxe font-heading mb-3">
              Vue d'ensemble
            </p>
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                icon={<Star size={13} className="text-[#e7c76a] fill-[#e7c76a]" />}
                value="4.9/5"
                label="Note clients"
              />
              <StatCard
                icon={<Award size={13} className="text-[#93c5fd]" />}
                value="6+ ans"
                label="D'expérience"
              />
              <StatCard
                icon={<ShieldCheck size={13} className="text-[#93c5fd]" />}
                value="0"
                label="Annulation"
              />
              <StatCard
                icon={<Clock size={13} className="text-[#e7c76a]" />}
                value="7j/7"
                label="Disponibilité"
              />
            </div>
          </div>
        </Reveal>

        {/* === Points forts === */}
        <Reveal delay={220}>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { icon: Zap, label: "Réponse immédiate" },
              { icon: Euro, label: "Tarif transparent" },
              { icon: ShieldCheck, label: "Assurance incluse" },
              { icon: Headphones, label: "Support 7j/7" },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 px-3 py-2.5 rounded-2xl border border-white/10 bg-white/[0.04]"
              >
                <Icon size={14} className="text-[#93c5fd] shrink-0" />
                <span className="text-white/85 text-[11.5px]">{label}</span>
              </div>
            ))}
          </div>
        </Reveal>

        {/* === Comment ça marche === */}
        <Reveal delay={260}>
          <section
            className="rounded-3xl p-5 border border-white/10 bg-white/[0.04] backdrop-blur-xl"
          >
            <div className="flex items-end justify-between mb-5">
              <h3 className="font-heading text-[18px] tracking-wide text-gold-luxe">
                Comment ça marche
              </h3>
              <Link
                to="/comment-ca-marche"
                className="text-[#93c5fd] text-[10.5px] tracking-[0.2em] uppercase flex items-center gap-1 font-heading"
              >
                Détails <ChevronRight size={12} />
              </Link>
            </div>
            <div className="space-y-4">
              <Step n="01" title="Réservation" desc="Estimation instantanée, confirmation rapide." />
              <Step n="02" title="Prise en charge" desc="État des lieux digitalisé, assurance incluse." />
              <Step n="03" title="Suivi temps réel" desc="Tracking GPS et notifications à chaque étape." />
            </div>
          </section>
        </Reveal>

        {/* === CTA Contact === */}
        <Reveal delay={300}>
          <section
            className="rounded-3xl p-5 border border-[#60a5fa]/30"
            style={{
              background:
                "linear-gradient(135deg, rgba(59,130,246,0.18) 0%, rgba(15,45,128,0.85) 100%)",
            }}
          >
            <div className="flex items-start gap-4">
              <span className="shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center bg-white/10 border border-white/15">
                <Phone size={20} className="text-[#93c5fd]" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-heading text-[16px] text-gold-luxe">Une question ?</p>
                <p className="text-white/60 text-[12px] mt-0.5">
                  Devis personnalisé, urgences, flottes.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5 mt-4">
              <a
                href="tel:0782456181"
                className="h-12 rounded-2xl flex items-center justify-center gap-2 text-[11px] tracking-[0.2em] uppercase font-heading text-white active:scale-[0.97] transition-transform"
                style={{
                  background: "linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)",
                  boxShadow: "0 10px 28px -10px rgba(59,130,246,0.6)",
                }}
              >
                <Phone size={14} /> Appeler
              </a>
              <Link
                to="/contact"
                className="h-12 rounded-2xl flex items-center justify-center gap-2 text-[11px] tracking-[0.2em] uppercase font-heading text-[#93c5fd] border border-[#60a5fa]/40 bg-white/[0.03] active:scale-[0.97] transition-transform"
              >
                Message
              </Link>
            </div>
          </section>
        </Reveal>
      </main>

      {/* === FOOTER === */}
      <footer className="relative z-10 px-4 pt-8 pb-6 mt-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 flex items-center gap-3">
          <span className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl border border-[#60a5fa]/35 bg-[#60a5fa]/10">
            <MapPin className="text-[#93c5fd]" size={17} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-white text-[13px] font-heading tracking-wide">Basé à Tours (37)</p>
            <p className="text-white/55 text-[11px] mt-0.5 truncate">
              07 82 45 61 81 · contact@transportsligneo.fr
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center gap-4 mt-5 text-[11px] text-white/50 font-heading tracking-wider uppercase">
          <Link to="/cgv" className="hover:text-[#93c5fd] transition-colors">CGV</Link>
          <span className="text-white/20">·</span>
          <Link to="/mentions-legales" className="hover:text-[#93c5fd] transition-colors">Mentions</Link>
          <span className="text-white/20">·</span>
          <Link to="/confidentialite" className="hover:text-[#93c5fd] transition-colors">Privacy</Link>
        </div>
        <p className="text-center text-white/35 text-[10px] mt-3 tracking-wider">
          © {new Date().getFullYear()} Transports LIGNEO
        </p>
      </footer>
    </div>
  );
}

/* ==== Sub-components ==== */

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
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-500 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
      }`}
    >
      {children}
    </div>
  );
}

function QuickTile({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl p-4 border border-white/10 bg-white/[0.04] flex items-center gap-3 active:scale-[0.97] transition-transform text-left"
    >
      <span
        className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center border border-[#60a5fa]/30 text-[#93c5fd]"
        style={{ background: "rgba(96,165,250,0.12)" }}
      >
        {icon}
      </span>
      <span className="text-white text-[13px] font-heading tracking-wide">{label}</span>
    </button>
  );
}

function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-2xl p-4 border border-white/10 bg-white/[0.04]">
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <span className="text-[9px] tracking-[0.24em] uppercase text-white/50 font-heading">
          {label}
        </span>
      </div>
      <p className="font-heading text-[24px] leading-none text-white">{value}</p>
    </div>
  );
}

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="flex gap-4 items-start">
      <span
        className="w-9 h-9 shrink-0 rounded-full border border-[#60a5fa]/45 text-[#93c5fd] flex items-center justify-center text-[11px] font-bold font-heading"
        style={{ boxShadow: "0 0 20px -6px rgba(96,165,250,0.5)" }}
      >
        {n}
      </span>
      <div className="flex-1 min-w-0 pt-1">
        <p className="text-white text-[13.5px] font-heading tracking-[0.04em] uppercase leading-tight">
          {title}
        </p>
        <p className="text-white/60 text-[12px] mt-1 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
