import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  MapPin,
  Phone,
  ShieldCheck,
  ChevronRight,
  Clock,
  Zap,
  Award,
  ArrowRight,
  Star,
  Truck,
  FileText,
  User,
  Menu,
  X,
  Home,
  Tag,
  Info,
  Briefcase,
  MessageSquare,
  LogIn,
  LogOut,
} from "lucide-react";

import logoLigneo from "@/assets/logo-transports-ligneo-officiel.png";
import heroBg from "@/assets/hero-ligneo-night.jpg";
import MobileDevisGenerator from "@/components/mobile/MobileDevisGenerator";
import { useAuth } from "@/hooks/useAuth";

/**
 * MobileHomeScreen — App-like mobile experience (2026 SaaS premium)
 * Palette : fond profond #050B1D + dégradés bleus électriques.
 * Icônes Lucide modernes, cartes glassmorphism, halos lumineux discrets.
 */
export default function MobileHomeScreen() {
  const { isAuthenticated, role, user, logout } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const goEspace = () => {
    setMenuOpen(false);
    if (!isAuthenticated) return navigate({ to: "/login" });
    if (role === "admin" || role === "super_admin") return navigate({ to: "/admin" });
    if (role === "convoyeur") return navigate({ to: "/convoyeur" });
    return navigate({ to: "/dashboard-client" });
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    try { await logout(); } catch {}
    navigate({ to: "/" });
  };

  const handleScrollToDevis = () => {
    const el = document.getElementById("mobile-devis");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const espaceLabel = isAuthenticated ? "Mon espace" : "Se connecter";
  const userInitial = user?.email?.[0]?.toUpperCase() ?? "";

  return (
    <div
      className="md:hidden relative min-h-screen overflow-x-hidden text-white pb-bottom-nav"
      style={{
        background:
          "radial-gradient(120% 80% at 50% 0%, #0a1638 0%, #050B1D 55%, #030816 100%)",
      }}
    >
      {/* Halos lumineux */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -right-24 w-[420px] h-[420px] rounded-full blur-[130px] opacity-60"
        style={{ background: "radial-gradient(circle, rgba(59,130,246,0.45) 0%, transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-[38%] -left-32 w-[340px] h-[340px] rounded-full blur-[110px] opacity-40"
        style={{ background: "radial-gradient(circle, rgba(56,189,248,0.35) 0%, transparent 70%)" }}
      />

      {/* === HEADER === */}
      <header
        className={`safe-top sticky top-0 z-40 px-5 pt-3 pb-3 flex items-center justify-between transition-all duration-300 ${
          scrolled
            ? "bg-[#050B1D]/85 backdrop-blur-xl border-b border-white/[0.06]"
            : "bg-transparent"
        }`}
      >
        <Link to="/" className="flex items-center gap-2.5 tap-scale min-w-0" aria-label="Accueil">
          <span className="shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center overflow-hidden">
            <img src={logoLigneo} alt="Ligneo" className="w-9 h-9 object-contain" loading="eager" />
          </span>
          <span className="flex flex-col leading-tight min-w-0">
            <span className="font-heading text-white text-[13px] tracking-[0.18em] uppercase">
              Transports
            </span>
            <span className="font-heading text-[#3b82f6] text-[13px] tracking-[0.22em] uppercase">
              Ligneo
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={goEspace}
            aria-label={espaceLabel}
            className="h-11 w-11 rounded-full flex items-center justify-center active:scale-95 transition-transform"
            style={{
              background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
              boxShadow:
                "0 10px 28px -8px rgba(59,130,246,0.75), inset 0 1px 0 rgba(255,255,255,0.25)",
            }}
          >
            {isAuthenticated && userInitial ? (
              <span className="text-white font-heading text-[14px]">{userInitial}</span>
            ) : (
              <User size={18} className="text-white" strokeWidth={2} />
            )}
          </button>
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Ouvrir le menu"
            aria-expanded={menuOpen}
            className="w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition-transform"
          >
            <Menu size={22} className="text-white/85" strokeWidth={2} />
          </button>
        </div>
      </header>

      {/* === DRAWER MENU === */}
      <MobileMenuDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        isAuthenticated={isAuthenticated}
        userEmail={user?.email ?? null}
        onEspace={goEspace}
        onLogout={handleLogout}
      />

      <main className="relative z-10 px-5 pt-3 space-y-7">
        {/* === HERO === */}
        <Reveal>
          <div
            className="relative rounded-[32px] overflow-hidden"
            style={{
              boxShadow:
                "0 30px 70px -30px rgba(59,130,246,0.5), 0 0 0 1px rgba(255,255,255,0.08) inset",
            }}
          >
            {/* Image de fond */}
            <img
              src={heroBg}
              alt="Convoyage automobile premium Ligneo"
              className="absolute inset-0 w-full h-full object-cover"
              loading="eager"
              decoding="async"
              fetchPriority="high"
            />
            {/* Overlays */}
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(5,11,29,0.05) 0%, rgba(5,11,29,0.55) 45%, rgba(5,11,29,0.96) 92%)",
              }}
            />
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(200deg, rgba(59,130,246,0.15) 0%, transparent 55%)",
              }}
            />
            {/* Bord lumineux */}
            <div
              aria-hidden
              className="absolute inset-0 rounded-[32px] pointer-events-none"
              style={{
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
              }}
            />

            {/* Contenu */}
            <div className="relative pt-[220px] px-6 pb-6">
              <p className="text-[10px] tracking-[0.35em] uppercase text-[#60a5fa] font-heading font-bold">
                Accueil
              </p>
              <h1 className="font-heading mt-2 leading-[0.95] tracking-[0.02em]">
                <span className="block text-white text-[34px] font-black uppercase">Transports</span>
                <span className="block text-[#3b82f6] text-[34px] font-black uppercase">Ligneo</span>
              </h1>
              <p className="text-white/70 text-[13.5px] mt-3 leading-relaxed max-w-[92%]">
                Estimez, réservez et suivez vos convoyages en quelques secondes.
              </p>

              {/* Capsules glassmorphism */}
              <div className="mt-5 grid grid-cols-3 gap-2 rounded-2xl p-2.5 border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl">
                <HeroChip icon={<Zap size={15} />} title="Rapide" sub="Estimation 30s" />
                <HeroChip icon={<ShieldCheck size={15} />} title="Sécurisé" sub="Convoyeurs vérifiés" />
                <HeroChip icon={<MapPin size={15} />} title="France" sub="Interventions 24/48h" />
              </div>
            </div>
          </div>
        </Reveal>

        {/* === CTA principal — Estimer mon trajet === */}
        <Reveal delay={60}>
          <button
            onClick={handleScrollToDevis}
            className="w-full text-left rounded-[28px] p-5 relative overflow-hidden active:scale-[0.98] transition-transform"
            style={{
              background:
                "linear-gradient(135deg, #2563eb 0%, #3b82f6 50%, #1d4ed8 100%)",
              boxShadow:
                "0 30px 60px -20px rgba(59,130,246,0.7), 0 0 0 1px rgba(255,255,255,0.12) inset",
            }}
          >
            {/* Halo */}
            <span
              aria-hidden
              className="absolute -top-16 -right-10 w-40 h-40 rounded-full blur-3xl bg-white/25"
            />
            <span
              aria-hidden
              className="absolute -bottom-20 -left-10 w-40 h-40 rounded-full blur-3xl bg-cyan-300/20"
            />
            <div className="flex items-center gap-4 relative">
              <span
                className="w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center border border-white/25 backdrop-blur-xl"
                style={{
                  background: "rgba(255,255,255,0.15)",
                }}
              >
                <Truck size={26} className="text-white" strokeWidth={2} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-heading text-white text-[18px] font-bold tracking-wide">
                  Estimer mon trajet
                </p>
                <p className="text-white/75 text-[12.5px] mt-0.5">
                  Tarif en 30 secondes · gratuit
                </p>
              </div>
              <span
                className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center bg-white"
                style={{ boxShadow: "0 8px 20px -6px rgba(0,0,0,0.25)" }}
              >
                <ArrowRight size={18} className="text-[#1d4ed8]" strokeWidth={2.5} />
              </span>
            </div>
          </button>
        </Reveal>

        {/* === Accès rapides === */}
        <Reveal delay={100}>
          <div>
            <h2 className="font-heading text-white text-[18px] font-bold tracking-[0.01em] mb-4 px-1">
              Gérez en toute simplicité
            </h2>
            <div className="grid grid-cols-2 gap-3.5">
              <QuickTile
                icon={<FileText size={22} strokeWidth={2} />}
                label="Mes devis"
                sublabel="Consultez et gérez vos devis"
                onClick={() => navigate({ to: isAuthenticated ? "/dashboard-client/devis" : "/login" })}
              />
              <QuickTile
                icon={<Truck size={22} strokeWidth={2} />}
                label="Mes missions"
                sublabel="Suivez vos missions en cours"
                onClick={() =>
                  navigate({ to: isAuthenticated ? "/dashboard-client/missions" : "/login" })
                }
              />
              <QuickTile
                icon={
                  isAuthenticated && userInitial ? (
                    <span className="font-heading text-[15px] font-bold">{userInitial}</span>
                  ) : (
                    <LogIn size={22} strokeWidth={2} />
                  )
                }
                label={espaceLabel}
                sublabel={isAuthenticated ? "Tableau de bord" : "Accéder à mon compte"}
                onClick={goEspace}
              />
              <QuickTile
                icon={<Phone size={22} strokeWidth={2} />}
                label="Contact"
                sublabel="Notre équipe 7j/7"
                onClick={() => navigate({ to: "/contact" })}
              />
            </div>
          </div>
        </Reveal>

        {/* === Simulateur === */}
        <Reveal delay={140}>
          <section
            id="mobile-devis"
            className="scroll-mt-20 rounded-[28px] border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl overflow-hidden"
            style={{
              boxShadow:
                "0 30px 70px -30px rgba(59,130,246,0.35), 0 0 0 1px rgba(255,255,255,0.05) inset",
            }}
          >
            <div className="flex items-end justify-between px-5 pt-5 pb-3">
              <div>
                <p className="text-[10px] tracking-[0.32em] uppercase text-[#60a5fa] font-heading font-bold">
                  Estimation
                </p>
                <h2 className="font-heading text-white text-[20px] font-bold tracking-wide mt-1">
                  Simulateur direct
                </h2>
              </div>
              <span
                className="px-3 py-1 rounded-full text-[9.5px] tracking-[0.22em] uppercase font-heading font-bold"
                style={{
                  background: "rgba(59,130,246,0.18)",
                  border: "1px solid rgba(96,165,250,0.4)",
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
            <p className="text-[10px] tracking-[0.32em] uppercase text-[#60a5fa] font-heading font-bold mb-3 px-1">
              Vue d'ensemble
            </p>
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                icon={<Star size={13} className="text-[#60a5fa] fill-[#60a5fa]" />}
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
                icon={<Clock size={13} className="text-[#60a5fa]" />}
                value="7j/7"
                label="Disponibilité"
              />
            </div>
          </div>
        </Reveal>

        {/* === Comment ça marche === */}
        <Reveal delay={260}>
          <section className="rounded-[28px] p-5 border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl">
            <div className="flex items-end justify-between mb-5">
              <h3 className="font-heading text-[19px] font-bold tracking-wide text-white">
                Comment ça marche
              </h3>
              <Link
                to="/comment-ca-marche"
                className="text-[#60a5fa] text-[10.5px] tracking-[0.2em] uppercase flex items-center gap-1 font-heading font-bold"
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
            className="rounded-[28px] p-5 border border-white/[0.08]"
            style={{
              background:
                "linear-gradient(135deg, rgba(59,130,246,0.22) 0%, rgba(15,45,128,0.5) 100%)",
              boxShadow: "0 24px 60px -24px rgba(59,130,246,0.4)",
            }}
          >
            <div className="flex items-start gap-4">
              <span className="shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center bg-white/10 border border-white/15">
                <Phone size={20} className="text-[#93c5fd]" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-heading text-[17px] font-bold text-white">Une question ?</p>
                <p className="text-white/65 text-[12.5px] mt-0.5">
                  Devis personnalisé, urgences, flottes.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5 mt-4">
              <a
                href="tel:0782456181"
                className="h-12 rounded-2xl flex items-center justify-center gap-2 text-[11px] tracking-[0.2em] uppercase font-heading font-bold text-white active:scale-[0.97] transition-transform"
                style={{
                  background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                  boxShadow: "0 12px 28px -10px rgba(59,130,246,0.7)",
                }}
              >
                <Phone size={14} /> Appeler
              </a>
              <Link
                to="/contact"
                className="h-12 rounded-2xl flex items-center justify-center gap-2 text-[11px] tracking-[0.2em] uppercase font-heading font-bold text-[#93c5fd] border border-[#60a5fa]/40 bg-white/[0.03] active:scale-[0.97] transition-transform"
              >
                Message
              </Link>
            </div>
          </section>
        </Reveal>
      </main>

      {/* === FOOTER === */}
      <footer className="relative z-10 px-5 pt-8 pb-6 mt-4">
        <div className="rounded-[22px] border border-white/[0.08] bg-white/[0.03] p-4 flex items-center gap-3 backdrop-blur-xl">
          <span className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-2xl border border-[#60a5fa]/35 bg-[#60a5fa]/10">
            <MapPin className="text-[#93c5fd]" size={17} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-white text-[13px] font-heading font-bold tracking-wide">Basé à Tours (37)</p>
            <p className="text-white/55 text-[11px] mt-0.5 truncate">
              07 82 45 61 81 · contact@transportsligneo.fr
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center gap-4 mt-5 text-[10.5px] text-white/45 font-heading tracking-wider uppercase">
          <Link to="/cgv" className="hover:text-[#93c5fd] transition-colors">CGV</Link>
          <span className="text-white/20">·</span>
          <Link to="/mentions-legales" className="hover:text-[#93c5fd] transition-colors">Mentions</Link>
          <span className="text-white/20">·</span>
          <Link to="/confidentialite" className="hover:text-[#93c5fd] transition-colors">Privacy</Link>
        </div>
        <p className="text-center text-white/30 text-[10px] mt-3 tracking-wider">
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

function HeroChip({
  icon,
  title,
  sub,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <div className="flex flex-col items-start gap-1.5 rounded-xl px-2 py-2">
      <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#3b82f6]/15 border border-[#60a5fa]/25 text-[#60a5fa]">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-white text-[11.5px] font-heading font-bold leading-tight">{title}</p>
        <p className="text-white/55 text-[9.5px] leading-tight mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

function QuickTile({
  icon,
  label,
  sublabel,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative rounded-[26px] p-4 border border-white/[0.07] overflow-hidden active:scale-[0.97] transition-transform text-left min-h-[160px] flex flex-col"
      style={{
        background:
          "linear-gradient(160deg, rgba(255,255,255,0.05) 0%, rgba(10,22,56,0.6) 60%, rgba(5,11,29,0.85) 100%)",
        boxShadow:
          "0 22px 50px -26px rgba(59,130,246,0.35), 0 0 0 1px rgba(255,255,255,0.04) inset",
      }}
    >
      {/* Halo */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-10 w-28 h-28 rounded-full blur-2xl bg-[#3b82f6]/25"
      />

      <span
        className="relative w-12 h-12 rounded-2xl flex items-center justify-center text-[#60a5fa] border border-[#60a5fa]/25"
        style={{
          background:
            "linear-gradient(135deg, rgba(59,130,246,0.20) 0%, rgba(30,64,175,0.08) 100%)",
          boxShadow: "0 10px 24px -10px rgba(59,130,246,0.5)",
        }}
      >
        {icon}
      </span>

      <div className="relative mt-auto pt-4">
        <p className="text-white text-[15px] font-heading font-bold tracking-tight">
          {label}
        </p>
        {sublabel && (
          <div className="flex items-end justify-between gap-2 mt-1">
            <p className="text-white/55 text-[11.5px] leading-snug flex-1">{sublabel}</p>
            <span className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-white/[0.06] border border-white/[0.08] group-active:translate-x-0.5 transition-transform">
              <ArrowRight size={14} className="text-[#60a5fa]" strokeWidth={2.2} />
            </span>
          </div>
        )}
      </div>
    </button>
  );
}

/* ==== Drawer menu mobile ==== */
function MobileMenuDrawer({
  open,
  onClose,
  isAuthenticated,
  userEmail,
  onEspace,
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  isAuthenticated: boolean;
  userEmail: string | null;
  onEspace: () => void;
  onLogout: () => void;
}) {
  const links: { to: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
    { to: "/", label: "Accueil", icon: Home },
    { to: "/tarifs", label: "Tarifs", icon: Tag },
    { to: "/services", label: "Nos services", icon: Briefcase },
    { to: "/comment-ca-marche", label: "Comment ça marche", icon: Info },
    { to: "/a-propos", label: "À propos", icon: Award },
    { to: "/b2b", label: "Solutions pros", icon: ShieldCheck },
    { to: "/contact", label: "Contact", icon: MessageSquare },
  ];

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={`md:hidden fixed inset-0 z-[60] bg-[#020614]/80 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />
      <aside
        role="dialog"
        aria-label="Menu principal"
        aria-hidden={!open}
        className={`md:hidden fixed top-0 right-0 z-[61] h-full w-[86%] max-w-[380px] safe-top pt-3 pb-8 px-5 flex flex-col transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{
          background:
            "linear-gradient(180deg, #050B1D 0%, #0a1638 60%, #0f2d80 100%)",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "-24px 0 60px -20px rgba(0,0,0,0.7)",
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <span className="font-heading text-[11px] tracking-[0.28em] uppercase text-[#60a5fa] font-bold">
            Menu
          </span>
          <button
            onClick={onClose}
            aria-label="Fermer le menu"
            className="w-10 h-10 rounded-full border border-white/[0.08] bg-white/[0.04] flex items-center justify-center active:scale-95 transition-transform"
          >
            <X size={18} className="text-white/85" />
          </button>
        </div>

        <button
          onClick={onEspace}
          className="rounded-[22px] p-4 flex items-center gap-3 border border-white/[0.08] active:scale-[0.98] transition-transform text-left mb-5"
          style={{
            background:
              "linear-gradient(135deg, rgba(59,130,246,0.28) 0%, rgba(15,45,128,0.6) 100%)",
            boxShadow: "0 18px 40px -18px rgba(59,130,246,0.6)",
          }}
        >
          <span
            className="w-11 h-11 rounded-full flex items-center justify-center text-white font-heading"
            style={{
              background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
              boxShadow: "0 8px 20px -6px rgba(59,130,246,0.6)",
            }}
          >
            {isAuthenticated && userEmail ? userEmail[0]?.toUpperCase() : <LogIn size={18} />}
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-heading text-[14px] text-white font-bold tracking-wide">
              {isAuthenticated ? "Mon espace" : "Se connecter"}
            </span>
            <span className="block text-white/60 text-[11.5px] mt-0.5 truncate">
              {isAuthenticated ? (userEmail ?? "Tableau de bord") : "Accéder à mon compte"}
            </span>
          </span>
          <ChevronRight size={16} className="text-[#93c5fd]" />
        </button>

        <nav className="flex-1 overflow-y-auto -mx-1 px-1">
          <ul className="space-y-1">
            {links.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <Link
                  to={to}
                  onClick={onClose}
                  className="flex items-center gap-3 rounded-2xl px-3 py-3 border border-transparent hover:border-white/10 hover:bg-white/[0.03] active:scale-[0.98] transition-all"
                >
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center border border-[#60a5fa]/25 bg-[#3b82f6]/10">
                    <Icon size={16} className="text-[#93c5fd]" />
                  </span>
                  <span className="flex-1 text-white text-[14px] font-heading tracking-wide">{label}</span>
                  <ChevronRight size={14} className="text-white/30" />
                </Link>
              </li>
            ))}
          </ul>

          {isAuthenticated && (
            <>
              <div className="my-4 h-px bg-white/10" />
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-3 rounded-2xl px-3 py-3 border border-white/10 bg-white/[0.03] active:scale-[0.98] transition-all"
              >
                <span className="w-9 h-9 rounded-xl flex items-center justify-center border border-red-400/30 bg-red-400/10">
                  <LogOut size={16} className="text-red-300" />
                </span>
                <span className="flex-1 text-white/85 text-[13.5px] font-heading tracking-wide text-left">
                  Se déconnecter
                </span>
              </button>
            </>
          )}
        </nav>

        <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
          <a
            href="tel:0782456181"
            className="flex items-center gap-3 rounded-2xl px-3 py-2.5 border border-[#60a5fa]/30"
            style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.18), rgba(15,45,128,0.5))" }}
          >
            <Phone size={15} className="text-[#93c5fd]" />
            <span className="text-white text-[12.5px] font-heading tracking-wide">07 82 45 61 81</span>
          </a>
          <p className="text-center text-white/40 text-[10px] tracking-widest uppercase">
            Disponible 7j/7
          </p>
        </div>
      </aside>
    </>
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
    <div
      className="relative rounded-[22px] p-4 border border-white/[0.07] overflow-hidden"
      style={{
        background:
          "linear-gradient(160deg, rgba(255,255,255,0.04) 0%, rgba(10,22,56,0.45) 60%, rgba(5,11,29,0.7) 100%)",
        boxShadow: "0 14px 30px -18px rgba(59,130,246,0.35)",
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-8 -right-8 w-20 h-20 rounded-full blur-2xl bg-[#3b82f6]/25"
      />
      <div className="relative flex items-center gap-1.5 mb-2">
        {icon}
        <span className="text-[9px] tracking-[0.24em] uppercase text-white/55 font-heading font-bold">
          {label}
        </span>
      </div>
      <p className="relative font-heading text-[24px] font-black leading-none text-white">{value}</p>
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
        <p className="text-white text-[13.5px] font-heading font-bold tracking-[0.04em] uppercase leading-tight">
          {title}
        </p>
        <p className="text-white/60 text-[12px] mt-1 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
