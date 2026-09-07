import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import AvisSection from "@/components/public/AvisSection";
import FaqDynamique from "@/components/public/FaqDynamique";
import StoreBadges from "@/components/public/StoreBadges";
import {
  MapPin,
  Phone,
  ShieldCheck,
  ChevronRight,
  X,
  Home,
  Tag,
  Info,
  Briefcase,
  MessageSquare,
  LogIn,
  LogOut,
  Award,
  MessageCircle,
} from "lucide-react";

import heroBg from "@/assets/hero-ligneo-night.jpg";
import vroomyMascotte from "@/assets/vroomy-mascotte.png.asset.json";
import DevisGenerator from "@/components/DevisGenerator";
import { useAuth } from "@/hooks/useAuth";

/**
 * MobileHomeScreen · v3
 * Reproduction fidèle de la maquette "accueil-mobile-v3" :
 * fond navy continu avec halos bleus/or, hero photo + overlay bleu,
 * carte "Estimer mon trajet" flottante, fil de route décoratif, bento stats.
 * Toutes les routes et le vrai simulateur (MobileDevisGenerator) restent branchés.
 */
export default function MobileHomeScreen() {
  const { isAuthenticated, role, user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
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
    try {
      await logout();
    } catch {}
    navigate({ to: "/" });
  };


  const espaceLabel = isAuthenticated ? "Mon espace" : "Se connecter";

  return (
    <div
      className="mhome-root md:hidden relative min-h-screen overflow-x-hidden text-white pb-bottom-nav pt-[96px]"
      style={{
        background:
          "radial-gradient(520px 440px at 90% 0%, rgba(63,123,255,0.32), transparent 60%)," +
          "radial-gradient(420px 360px at -8% 26%, rgba(217,181,74,0.10), transparent 60%)," +
          "radial-gradient(480px 420px at 105% 60%, rgba(79,140,255,0.18), transparent 60%)," +
          "radial-gradient(460px 400px at -5% 92%, rgba(63,123,255,0.14), transparent 60%)," +
          "linear-gradient(180deg, #0a1230 0%, #0a1230 10%, #070c1f 34%, #060a1a 70%, #050813 100%)",
      }}
    >
      {/* Blobs décoratifs */}
      <div aria-hidden className="pointer-events-none absolute -right-24 top-20 w-[260px] h-[260px] rounded-full blur-[60px] bg-[rgba(63,123,255,0.20)]" />
      <div aria-hidden className="pointer-events-none absolute -left-20 top-[760px] w-[220px] h-[220px] rounded-full blur-[60px] bg-[rgba(217,181,74,0.11)]" />
      <div aria-hidden className="pointer-events-none absolute -right-16 top-[1260px] w-[230px] h-[230px] rounded-full blur-[60px] bg-[rgba(79,140,255,0.16)]" />

      {/* Fil de route décoratif */}
      <RouteThread />

      {/* Topbar retirée : la navigation est gérée par MobileNavbar */}


      <MobileMenuDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        isAuthenticated={isAuthenticated}
        userEmail={user?.email ?? null}
        onEspace={goEspace}
        onLogout={handleLogout}
      />

      {/* === HERO photo (fondu progressif vers le fond) === */}
      <section className="mhome-hero relative z-[1] h-[430px] overflow-hidden">
        <img
          src={heroBg}
          alt="Convoyeur Transports Ligneo"
          className="absolute inset-0 w-full h-full object-cover"
          loading="eager"
          decoding="async"
          fetchPriority="high"
        />
        {/* Teinte multiply bleu électrique + fondu vers navy en bas */}
        <div
          aria-hidden
          className="absolute inset-0 mix-blend-multiply"
          style={{
            background:
              "linear-gradient(180deg, rgba(6,10,26,0.35) 0%, rgba(7,12,31,0.25) 30%, rgba(6,10,26,0.75) 68%, #0a1230 96%)," +
              "linear-gradient(115deg, rgba(20,40,120,0.35) 0%, transparent 55%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, transparent 40%, rgba(7,12,31,0.55) 72%, #0a1230 100%)",
          }}
        />
        <div
          aria-hidden
          className="absolute -top-10 -right-14 w-[260px] h-[260px] rounded-full blur-[10px] mix-blend-screen"
          style={{ background: "radial-gradient(circle, rgba(63,123,255,0.55), transparent 70%)" }}
        />

        <div className="relative z-[2] h-full flex flex-col justify-end px-[22px] pb-16">
          <div
            className="flex items-center gap-2 uppercase mb-3 text-[10.5px] font-semibold tracking-[0.2em] text-[#4f8cff]"
            style={{ fontFamily: "'Space Grotesk', sans-serif", textShadow: "0 0 12px rgba(63,123,255,0.6)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#4f8cff]" style={{ boxShadow: "0 0 8px #4f8cff" }} />
            Convoyage et logistique automobile
          </div>
          <h1
            className="text-[35px] leading-[1.06] font-extrabold tracking-[-0.01em] mb-3 text-white"
            style={{ fontFamily: "'Poppins', sans-serif", textShadow: "0 4px 20px rgba(0,0,0,0.5)" }}
          >
            Convoyage automobile<br />
            sur <span className="neon-accent">toute la ligne</span>
          </h1>
          <p className="text-[13px] leading-[1.55] mb-4 max-w-[290px] text-[#dbe3ff]" style={{ textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>
            Estimez, réservez et suivez vos convoyages en quelques secondes, partout en France.
          </p>
        </div>
      </section>



      {/* === Estimateur === */}
      <div id="mobile-devis" className="relative z-[3] mx-[18px] mt-5 scroll-mt-20">
        <DevisGenerator variant="flat-mini" />
      </div>


      {/* Contact banner */}
      <div
        className="relative z-[1] mx-[18px] mt-[22px] overflow-hidden flex items-center gap-3.5 rounded-[20px] px-[18px] py-4 border border-[rgba(122,163,255,0.22)]"
        style={{ background: "rgba(255,255,255,0.04)" }}
      >
        <span
          aria-hidden
          className="absolute -top-10 -right-5 w-[120px] h-[120px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(217,181,74,0.18), transparent 70%)" }}
        />
        <Link to="/contact" className="relative z-[1] flex items-center gap-3.5 flex-1 min-w-0 active:scale-[0.98] transition-transform">
          <span className="w-11 h-11 rounded-full bg-[rgba(63,123,255,0.14)] border border-[rgba(122,163,255,0.35)] flex items-center justify-center shrink-0">
            <Phone size={18} className="text-[#4f8cff]" strokeWidth={2} />
          </span>
          <span className="flex-1 min-w-0 block">
            <span className="block text-[13.5px] font-bold text-white">Une question ?</span>
            <span className="block text-[11px] text-[#9aa6c9]">Vroomy vous répond sept jours sur sept</span>
          </span>
        </Link>
        <button
          type="button"
          aria-label="Ouvrir Vroomy, l'assistant Transports Ligneo"
          onClick={() => window.dispatchEvent(new CustomEvent("ligneo:assistant-open"))}
          className="vrm-launcher vrm-launcher--inline relative z-[1] shrink-0"
        >
          <span className="vrm-launcher-mascotte">
            <img
              src={vroomyMascotte.url}
              alt="Vroomy"
              className="vrm-mascotte object-contain"
              loading="lazy"
              decoding="async"
            />
          </span>
          <span className="vrm-chat-bubble" aria-hidden="true">
            <MessageCircle size={16} strokeWidth={2.4} />
          </span>

        </button>

      </div>

      {/* Contenu public dynamique : avis, actualités, FAQ */}
      <div className="relative z-[1] r4-page">
        <AvisSection />
        <FaqDynamique />
      </div>

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
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-[10.5px] uppercase tracking-wider text-white/45">
          <Link to="/suivi" className="hover:text-[#93c5fd] transition-colors">Suivi mission</Link>
          <span className="text-white/20">·</span>
          <Link to="/actualites" className="hover:text-[#93c5fd] transition-colors">Actualités</Link>
          <span className="text-white/20">·</span>
          <Link to="/cgv" className="hover:text-[#93c5fd] transition-colors">CGV</Link>
          <span className="text-white/20">·</span>
          <Link to="/mentions-legales" className="hover:text-[#93c5fd] transition-colors">Mentions</Link>
          <span className="text-white/20">·</span>
          <Link to="/confidentialite" className="hover:text-[#93c5fd] transition-colors">Privacy</Link>
        </div>
        <div className="mt-5 flex justify-center">
          <StoreBadges />
        </div>
        <p className="text-center text-white/30 text-[10px] mt-3 tracking-wider">
          © {new Date().getFullYear()} Transports LIGNEO
        </p>
      </footer>

      {/* Styles locaux (animations spécifiques à la maquette) */}
      <style>{`
        .neon-accent {
          color: #6ea1ff;
          text-shadow: 0 0 18px rgba(91,143,255,0.9), 0 0 38px rgba(91,143,255,0.6), 0 0 64px rgba(91,143,255,0.35);
          animation: neonPulse 2.6s ease-in-out infinite;
        }
        @keyframes neonPulse {
          0%,100% { text-shadow: 0 0 18px rgba(91,143,255,0.9), 0 0 38px rgba(91,143,255,0.6), 0 0 64px rgba(91,143,255,0.35); }
          50%     { text-shadow: 0 0 26px rgba(91,143,255,1), 0 0 50px rgba(91,143,255,0.75), 0 0 84px rgba(91,143,255,0.45); }
        }
        .pulse-dot { animation: pulseDot 1.6s ease-in-out infinite; }
        @keyframes pulseDot { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }

        .book-card {
          position: relative;
          background: rgba(14,20,44,0.94);
          border-radius: 30px;
          padding: 3px;
          box-shadow: 0 30px 60px rgba(4,8,22,0.6);
          animation: cardFloat 6s ease-in-out infinite;
        }
        @keyframes cardFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        .book-card::before {
          content: ''; position: absolute; inset: 0; border-radius: 30px; padding: 1.4px;
          background: linear-gradient(135deg, rgba(122,163,255,0.7), rgba(217,181,74,0.35), rgba(122,163,255,0.15), rgba(79,140,255,0.6));
          background-size: 280% 280%; animation: borderFlow 7s linear infinite;
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none;
        }
        @keyframes borderFlow { 0% { background-position: 0% 50%; } 100% { background-position: 280% 50%; } }
        .book-inner {
          position: relative; background: rgba(13,19,42,0.96); border-radius: 27px;
          padding: 22px 20px; backdrop-filter: blur(18px); overflow: hidden;
        }
        .book-inner::before {
          content: ''; position: absolute; top: 0; left: 8%; right: 8%; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent);
        }

        .addr-field {
          display: flex; align-items: center; gap: 12px;
          background: rgba(0,0,0,0.25);
          border: 1px solid rgba(122,163,255,0.16);
          border-radius: 16px; padding: 13px 14px;
        }
        .addr-ic {
          width: 32px; height: 32px; border-radius: 50%;
          background: linear-gradient(135deg, rgba(63,123,255,0.35), rgba(47,95,255,0.1));
          border: 1px solid rgba(122,163,255,0.4);
          box-shadow: 0 0 10px rgba(63,123,255,0.3);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }

        .connector-line {
          position: relative; width: 1.5px; height: 18px; margin-left: 15px; overflow: hidden;
          background: repeating-linear-gradient(180deg, rgba(122,163,255,0.5) 0 3px, transparent 3px 6px);
        }
        .travel-dot {
          position: absolute; left: -2.5px; top: 0; width: 6px; height: 6px; border-radius: 50%;
          background: #d9b54a; box-shadow: 0 0 8px 2px rgba(217,181,74,0.7);
          animation: connTravel 2.4s ease-in-out infinite;
        }
        @keyframes connTravel { 0% { top: 0; opacity: 0; } 15% { opacity: 1; } 85% { opacity: 1; } 100% { top: 100%; opacity: 0; } }

        .trip-type {
          position: relative; display: flex; background: rgba(0,0,0,0.25);
          border: 1px solid rgba(122,163,255,0.18); border-radius: 999px; padding: 4px;
        }
        .trip-slider {
          position: absolute; top: 4px; left: 4px; width: calc(50% - 4px); height: calc(100% - 8px);
          background: linear-gradient(120deg, #2f5fff, #4f8cff); border-radius: 999px;
          box-shadow: 0 8px 20px rgba(47,95,255,0.45);
        }
        .trip-seg {
          position: relative; z-index: 1; flex: 1; text-align: center; padding: 10px;
          border-radius: 999px; font-size: 11.5px; font-weight: 700; color: #9aa6c9;
        }
        .trip-seg-active { color: #fff; }

        .shimmer-bar {
          height: 9px; border-radius: 5px; width: 88px;
          background: linear-gradient(90deg, rgba(122,163,255,0.15) 25%, rgba(122,163,255,0.4) 50%, rgba(122,163,255,0.15) 75%);
          background-size: 200% 100%; animation: shimmerBar 1.6s ease-in-out infinite;
        }
        @keyframes shimmerBar { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

        .book-cta::after {
          content: ''; position: absolute; top: 0; left: -60%; width: 40%; height: 100%;
          background: linear-gradient(120deg, transparent, rgba(255,255,255,0.35), transparent);
          transform: skewX(-20deg); animation: ctaShine 3.4s ease-in-out infinite;
        }
        @keyframes ctaShine { 0% { left: -60%; } 45% { left: 130%; } 100% { left: 130%; } }

        .section-title::before {
          content: ''; width: 4px; height: 16px; border-radius: 3px; display: inline-block;
          background: linear-gradient(180deg, #4f8cff, #d9b54a);
          box-shadow: 0 0 8px rgba(63,123,255,0.5);
        }

        .no-scrollbar { scrollbar-width: none; }
        .no-scrollbar::-webkit-scrollbar { display: none; }

        .route-thread {
          position: absolute; left: 8px; top: 800px; bottom: 200px; width: 2px; z-index: 0;
          background: repeating-linear-gradient(180deg, rgba(122,163,255,0.55) 0 5px, transparent 5px 11px);
          pointer-events: none;
        }
        .route-thread-dot {
          position: absolute; left: -3.5px; width: 9px; height: 9px; border-radius: 50%;
          background: radial-gradient(circle, #fff, #4f8cff);
          box-shadow: 0 0 12px 3px rgba(79,140,255,0.8);
          animation: threadTravel 7s linear infinite;
        }
        @keyframes threadTravel { 0% { top: 0%; opacity: 0; } 5% { opacity: 1; } 95% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
      `}</style>
    </div>
  );
}

/* ==== Sub-components ==== */


function RouteThread() {
  return (
    <div className="route-thread" aria-hidden>
      <div className="route-thread-dot" />
    </div>
  );
}



/* ==== Drawer menu ==== */
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
          background: "linear-gradient(180deg, #050B1D 0%, #0a1638 60%, #0f2d80 100%)",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "-24px 0 60px -20px rgba(0,0,0,0.7)",
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <span className="text-[11px] tracking-[0.28em] uppercase text-[#60a5fa] font-bold">Menu</span>
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
            background: "linear-gradient(135deg, rgba(59,130,246,0.28) 0%, rgba(15,45,128,0.6) 100%)",
            boxShadow: "0 18px 40px -18px rgba(59,130,246,0.6)",
          }}
        >
          <span
            className="w-11 h-11 rounded-full flex items-center justify-center text-white"
            style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", boxShadow: "0 8px 20px -6px rgba(59,130,246,0.6)" }}
          >
            {isAuthenticated && userEmail ? userEmail[0]?.toUpperCase() : <LogIn size={18} />}
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[14px] text-white font-bold tracking-wide">
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
                  <span className="flex-1 text-white text-[14px] tracking-wide">{label}</span>
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
                <span className="flex-1 text-white/85 text-[13.5px] tracking-wide text-left">
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
            <span className="text-white text-[12.5px] tracking-wide">07 82 45 61 81</span>
          </a>
          <p className="text-center text-white/40 text-[10px] tracking-widest uppercase">Disponible 7j/7</p>
        </div>
      </aside>
    </>
  );
}
