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
  X,
  Home,
  Tag,
  Info,
  Briefcase,
  MessageSquare,
  LogIn,
  LogOut,
  LayoutDashboard,
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
        <Link to="/" className="flex items-center gap-2.5 tap-scale min-w-0" aria-label="Accueil">
          <span
            className="shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center border border-white/15 bg-white/[0.05] overflow-hidden"
            style={{ boxShadow: "0 0 24px -8px rgba(96,165,250,0.5)" }}
          >
            <img src={logoLigneo} alt="Ligneo" className="w-9 h-9 object-contain" loading="eager" />
          </span>
          <span className="hidden sm:inline-block font-heading text-white text-[13px] leading-tight tracking-[0.18em] uppercase truncate">
            Ligneo
          </span>
        </Link>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={goEspace}
            aria-label={espaceLabel}
            className="h-11 w-11 rounded-2xl border border-[#e7c76a]/50 flex items-center justify-center tap-scale active:scale-95 transition-transform"
            style={{
              background: "linear-gradient(135deg, rgba(231,199,106,0.22) 0%, rgba(212,175,55,0.08) 100%)",
              boxShadow: "0 8px 22px -10px rgba(231,199,106,0.55)",
            }}
          >
            <span
              className="w-8 h-8 rounded-xl flex items-center justify-center text-[#0b1026] font-heading text-[13px]"
              style={{ background: "linear-gradient(135deg, #e7c76a, #d4af37)" }}
            >
              {isAuthenticated && userInitial ? userInitial : <User size={15} />}
            </span>
          </button>
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Ouvrir le menu"
            aria-expanded={menuOpen}
            className="w-11 h-11 rounded-2xl border border-white/15 bg-white/[0.05] flex items-center justify-center tap-scale active:scale-95 transition-transform"
          >
            <Menu size={18} className="text-white/85" />
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
              decoding="async"
              fetchPriority="high"
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

        {/* === Accès rapides — bento premium === */}
        <Reveal delay={100}>
          <div className="grid grid-cols-2 gap-3">
            <QuickTile
              icon={<FileText size={20} />}
              label="Mes devis"
              sublabel="Historique & suivi"
              onClick={() => navigate({ to: isAuthenticated ? "/dashboard-client/devis" : "/login" })}
            />
            <QuickTile
              icon={<Truck size={20} />}
              label="Mes missions"
              sublabel="Trajets en cours"
              onClick={() =>
                navigate({ to: isAuthenticated ? "/dashboard-client/missions" : "/login" })
              }
            />
            <QuickTile
              icon={isAuthenticated && userInitial ? <span className="font-heading text-[15px]">{userInitial}</span> : <LogIn size={20} />}
              label={espaceLabel}
              sublabel={isAuthenticated ? "Tableau de bord" : "Mon compte"}
              onClick={goEspace}
              highlight
            />
            <QuickTile
              icon={<Phone size={20} />}
              label="Contact"
              sublabel="Équipe 7j/7"
              onClick={() => navigate({ to: "/contact" })}
            />
          </div>
        </Reveal>

        {/* === Simulateur === */}
        <Reveal delay={140}>
          <section
            id="mobile-devis"
            className="scroll-mt-20 rounded-[28px] border border-white/10 bg-white/[0.04] backdrop-blur-xl overflow-hidden"
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

        {/* === Points forts — pills === */}
        <Reveal delay={220}>
          <div className="flex flex-wrap gap-2">
            {[
              { icon: Zap, label: "Réponse immédiate" },
              { icon: Euro, label: "Tarif transparent" },
              { icon: ShieldCheck, label: "Assurance incluse" },
              { icon: Headphones, label: "Support 7j/7" },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-1.5 pl-2 pr-3.5 py-1.5 rounded-full border border-white/12 bg-white/[0.04]"
              >
                <span className="w-6 h-6 rounded-full flex items-center justify-center border border-[#60a5fa]/30 bg-[#60a5fa]/10">
                  <Icon size={11} className="text-[#93c5fd]" />
                </span>
                <span className="text-white/85 text-[11.5px] tracking-wide">{label}</span>
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
  sublabel,
  onClick,
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative rounded-[26px] p-4 pb-4 border overflow-hidden active:scale-[0.97] transition-transform text-left min-h-[124px] flex flex-col justify-between ${
        highlight ? "border-[#e7c76a]/55" : "border-white/10"
      }`}
      style={
        highlight
          ? {
              background:
                "linear-gradient(155deg, rgba(231,199,106,0.22) 0%, rgba(15,45,128,0.75) 55%, rgba(11,16,38,0.9) 100%)",
              boxShadow:
                "0 22px 50px -22px rgba(231,199,106,0.55), 0 0 0 1px rgba(255,255,255,0.05) inset",
            }
          : {
              background:
                "linear-gradient(155deg, rgba(255,255,255,0.06) 0%, rgba(15,45,128,0.35) 60%, rgba(11,16,38,0.55) 100%)",
              boxShadow:
                "0 18px 42px -22px rgba(59,130,246,0.35), 0 0 0 1px rgba(255,255,255,0.04) inset",
            }
      }
    >
      {/* Halo décoratif */}
      <span
        aria-hidden
        className={`pointer-events-none absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl ${
          highlight ? "bg-[#e7c76a]/25" : "bg-[#60a5fa]/25"
        }`}
      />
      <span
        className={`relative w-11 h-11 rounded-2xl flex items-center justify-center ${
          highlight ? "text-[#0b1026]" : "text-[#93c5fd] border border-[#60a5fa]/35"
        }`}
        style={
          highlight
            ? {
                background: "linear-gradient(135deg, #e7c76a, #d4af37)",
                boxShadow: "0 10px 24px -8px rgba(231,199,106,0.65)",
              }
            : {
                background:
                  "linear-gradient(135deg, rgba(96,165,250,0.22) 0%, rgba(59,130,246,0.08) 100%)",
                boxShadow: "0 8px 22px -10px rgba(96,165,250,0.5)",
              }
        }
      >
        {icon}
      </span>
      <div className="relative mt-3">
        <div className="flex items-center gap-1.5">
          <span
            className={`block text-[14px] font-heading tracking-wide ${
              highlight ? "text-[#f4e7bf]" : "text-white"
            }`}
          >
            {label}
          </span>
          <ChevronRight
            size={13}
            className={`shrink-0 translate-x-0 group-active:translate-x-0.5 transition-transform ${
              highlight ? "text-[#e7c76a]/80" : "text-white/40"
            }`}
          />
        </div>
        {sublabel && (
          <span className="block text-[10.5px] text-white/55 mt-1 tracking-wide truncate">
            {sublabel}
          </span>
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
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={onClose}
        className={`md:hidden fixed inset-0 z-[60] bg-[#040820]/70 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />
      {/* Drawer */}
      <aside
        role="dialog"
        aria-label="Menu principal"
        aria-hidden={!open}
        className={`md:hidden fixed top-0 right-0 z-[61] h-full w-[86%] max-w-[380px] safe-top pt-3 pb-8 px-5 flex flex-col transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{
          background:
            "linear-gradient(180deg, #061238 0%, #0a1f5c 60%, #0f2d80 100%)",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "-24px 0 60px -20px rgba(0,0,0,0.6)",
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <span className="font-heading text-[11px] tracking-[0.28em] uppercase text-[#e7c76a]">
            Menu
          </span>
          <button
            onClick={onClose}
            aria-label="Fermer le menu"
            className="w-10 h-10 rounded-2xl border border-white/15 bg-white/[0.05] flex items-center justify-center active:scale-95 transition-transform"
          >
            <X size={18} className="text-white/85" />
          </button>
        </div>

        {/* Carte espace */}
        <button
          onClick={onEspace}
          className="rounded-2xl p-4 flex items-center gap-3 border border-[#e7c76a]/50 active:scale-[0.98] transition-transform text-left mb-5"
          style={{
            background:
              "linear-gradient(135deg, rgba(231,199,106,0.20) 0%, rgba(15,45,128,0.65) 100%)",
            boxShadow: "0 18px 40px -18px rgba(231,199,106,0.55)",
          }}
        >
          <span
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-[#0b1026] font-heading"
            style={{ background: "linear-gradient(135deg, #e7c76a, #d4af37)" }}
          >
            {isAuthenticated && userEmail ? userEmail[0]?.toUpperCase() : <LogIn size={18} />}
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-heading text-[14px] text-[#f4e7bf] tracking-wide">
              {isAuthenticated ? "Mon espace" : "Se connecter"}
            </span>
            <span className="block text-white/60 text-[11.5px] mt-0.5 truncate">
              {isAuthenticated ? (userEmail ?? "Tableau de bord") : "Accéder à mon compte"}
            </span>
          </span>
          <ChevronRight size={16} className="text-[#e7c76a]/70" />
        </button>

        {/* Liens de navigation */}
        <nav className="flex-1 overflow-y-auto -mx-1 px-1">
          <ul className="space-y-1">
            {links.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <Link
                  to={to}
                  onClick={onClose}
                  className="flex items-center gap-3 rounded-2xl px-3 py-3 border border-transparent hover:border-white/10 hover:bg-white/[0.03] active:scale-[0.98] transition-all"
                >
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center border border-[#60a5fa]/30 bg-[#60a5fa]/10">
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

        {/* Contact bloc */}
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
      className="relative rounded-[22px] p-4 border border-white/10 overflow-hidden"
      style={{
        background:
          "linear-gradient(155deg, rgba(255,255,255,0.05) 0%, rgba(15,45,128,0.28) 60%, rgba(11,16,38,0.45) 100%)",
        boxShadow: "0 14px 30px -18px rgba(59,130,246,0.35)",
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-8 -right-8 w-20 h-20 rounded-full blur-2xl bg-[#60a5fa]/20"
      />
      <div className="relative flex items-center gap-1.5 mb-2">
        {icon}
        <span className="text-[9px] tracking-[0.24em] uppercase text-white/55 font-heading">
          {label}
        </span>
      </div>
      <p className="relative font-heading text-[24px] leading-none text-white">{value}</p>
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
