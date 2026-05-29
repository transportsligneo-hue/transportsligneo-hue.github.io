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
} from "lucide-react";
import logoLigneo from "@/assets/logo-transports-ligneo-officiel.png";
import heroChauffeur from "@/assets/hero-chauffeur-ligneo.jpg";
import MobilePartnersStrip from "@/components/mobile/MobilePartnersStrip";
import MobileDevisGenerator from "@/components/mobile/MobileDevisGenerator";
import { useAuth } from "@/hooks/useAuth";

/**
 * Écran d'accueil mobile type application native.
 * Visible uniquement sur mobile (md:hidden) — laisse la version desktop intacte.
 * L'estimation est l'action principale du site.
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
      {/* Header mobile sticky — glass premium */}
      <header
        className={`safe-top sticky top-0 z-40 px-5 pt-3 pb-3 flex items-center justify-between transition-all duration-300 ${
          scrolled
            ? "bg-[#0b1026]/85 backdrop-blur-xl border-b border-white/[0.06] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)]"
            : "bg-transparent"
        }`}
      >
        <Link to="/" className="flex items-center gap-2 tap-scale" aria-label="Accueil">
          <img src={logoLigneo} alt="Transports Ligneo" className="h-9 w-auto object-contain" loading="eager" />
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={handleScrollToDevis}
            className="h-9 px-3 rounded-full text-[10px] tracking-[0.18em] uppercase font-heading flex items-center gap-1.5 tap-scale"
            style={{
              background: "linear-gradient(135deg, #2c6bff 0%, #5fb6ff 100%)",
              color: "#fff",
              boxShadow: "0 6px 18px -6px rgba(44,107,255,0.55)",
            }}
            aria-label="Estimer"
          >
            <Sparkles size={12} /> Estimer
          </button>
          <button
            onClick={goEspace}
            className="w-9 h-9 rounded-full border border-white/15 bg-white/[0.04] flex items-center justify-center tap-scale"
            aria-label="Mon espace"
          >
            <ShieldCheck size={16} className="text-[#9bcaff]" />
          </button>
        </div>
      </header>

      {/* Hero visuel — image full-bleed premium */}
      <section className="relative mb-2">
        <div className="relative h-[380px] w-full overflow-hidden">
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
                "linear-gradient(180deg, rgba(11,16,38,0.25) 0%, rgba(11,16,38,0.05) 35%, rgba(11,16,38,0.65) 70%, var(--background) 100%)",
            }}
          />
          <div className="absolute inset-x-0 bottom-0 px-5 pb-5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/15 bg-white/[0.06] backdrop-blur-md text-[9px] tracking-[0.25em] uppercase text-cream/80">
              <span className="w-1.5 h-1.5 rounded-full bg-[#5fb6ff] animate-pulse" />
              Disponible 7j/7
            </span>
            <h1 className="font-heading text-cream text-[30px] tracking-[0.02em] mt-3 leading-[1.1]">
              La tranquillité <br /><span className="gold-gradient-text">sur toute la ligne.</span>
            </h1>
            <p className="text-cream/75 text-[13px] mt-2 leading-relaxed">
              Convoyage automobile premium. Tarif live en 30 secondes.
            </p>
          </div>
        </div>

        {/* CTA principal hors image */}
        <div className="px-5 pt-4">
          <button
            onClick={handleScrollToDevis}
            className="w-full h-14 rounded-2xl font-heading text-sm tracking-[0.18em] uppercase flex items-center justify-center gap-2 text-white tap-scale"
            style={{
              background: "linear-gradient(135deg, #2c6bff 0%, #5fb6ff 100%)",
              boxShadow: "0 14px 32px -10px rgba(44,107,255,0.55)",
            }}
          >
            <Sparkles size={18} />
            Estimer mon trajet
          </button>
          <p className="text-center text-cream/45 text-[11px] mt-2 tracking-wide">
            Réponse immédiate · Tarif transparent · Assurance incluse
          </p>
        </div>
      </section>

      {/* Estimateur — présentation aérée, sans cadre lourd */}
      <section id="mobile-devis" className="px-5 pt-4 pb-2 scroll-mt-24">
        <div className="flex items-center justify-between mb-3 px-1">
          <div>
            <p className="text-[10px] tracking-[0.25em] uppercase text-[#9bcaff]/80 font-heading">Estimation 30 sec.</p>
            <h2 className="font-heading text-cream text-lg tracking-wide mt-0.5">
              Estimer mon trajet
            </h2>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-[#5fb6ff]/12 border border-[#5fb6ff]/30 text-[10px] tracking-[0.18em] uppercase text-[#9bcaff]">
            Gratuit
          </span>
        </div>
        {/* NB: pas de backdrop-filter / filter / transform sur ce wrapper —
            cela créerait un containing block pour le bottom-sheet `fixed`
            du picker de villes et empêcherait son ouverture. */}
        <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-1">
          <MobileDevisGenerator />
        </div>

        {/* Trust chips */}
        <div className="grid grid-cols-2 gap-2 mt-4">
          {[
            { icon: Zap, label: "Réponse immédiate" },
            { icon: Euro, label: "Tarif transparent" },
            { icon: ShieldCheck, label: "Assurance incluse" },
            { icon: Globe2, label: "Service Europe" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/8 bg-white/[0.03]">
              <Icon size={14} className="text-[#9bcaff] shrink-0" />
              <span className="text-cream/80 text-[11px] tracking-wide">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Raccourcis — grille 2x2 */}
      <section className="px-5 pb-6">
        <div className="grid grid-cols-2 gap-3">
          <ShortcutCard
            to="/tarifs"
            icon={<FileText size={20} className="text-primary" />}
            label="Devis instantané"
            sub="En 30 sec."
          />
          <ShortcutCard
            to="/tarifs"
            icon={<Euro size={20} className="text-primary" />}
            label="Voir les tarifs"
            sub="Péages inclus"
          />
          <ShortcutCard
            to="/comment-ca-marche"
            icon={<Truck size={20} className="text-primary" />}
            label="Comment ça marche"
            sub="3 étapes"
          />
          <ShortcutCard
            to="/contact"
            icon={<Phone size={20} className="text-primary" />}
            label="Nous contacter"
            sub="7j/7"
          />
        </div>
      </section>

      {/* Stats / preuves */}
      <section className="px-5 pb-6">
        <div className="home-glass p-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat value="6+" label="ans d'expérience" />
            <Divider />
            <Stat value="0" label="annulation" />
            <Divider />
            <Stat value="7j/7" label="disponibilité" />
          </div>
        </div>
      </section>

      {/* Pourquoi nous — liste compacte */}
      <section className="px-5 pb-6">
        <SectionTitle title="Nos engagements" />
        <div className="space-y-2">
          <Engagement icon={<ShieldCheck size={18} />} title="Fiabilité garantie" desc="Mission assurée et suivie de bout en bout." />
          <Engagement icon={<Clock size={18} />} title="Prise en charge 24h" desc="Selon distance et disponibilité." />
          <Engagement icon={<Euro size={18} />} title="Tarifs transparents" desc="Aucun frais caché. Devis en ligne." />
        </div>
      </section>

      {/* Comment ça marche — étapes en cards */}
      <section className="px-5 pb-6">
        <SectionTitle title="En 3 étapes" link={{ label: "Détails", to: "/comment-ca-marche" }} />
        <div className="space-y-2">
          <Step n="01" title="Estimez votre trajet" desc="Prix, distance et durée en quelques clics." />
          <Step n="02" title="Demandez le devis" desc="Validation rapide, infos transmises automatiquement." />
          <Step n="03" title="Livraison" desc="Convoyeur dédié, suivi à chaque étape." />
        </div>
      </section>

      {/* Partenaires + réassurance (remplace les avis sur mobile) */}
      <MobilePartnersStrip />

      {/* Footer app — minimal */}
      <footer className="px-5 pt-2 pb-4">
        <div className="mobile-card p-4 flex items-center gap-3">
          <MapPin className="text-primary shrink-0" size={20} />
          <div className="flex-1 min-w-0">
            <p className="text-cream/80 text-sm font-heading tracking-wide">Basé à Tours (37)</p>
            <p className="text-cream/50 text-xs">07 82 45 61 81 · contact@transportsligneo.fr</p>
          </div>
        </div>
        <div className="flex items-center justify-center gap-4 mt-4 text-[11px] text-cream/40">
          <Link to="/cgv" className="hover:text-primary">CGV</Link>
          <span>·</span>
          <Link to="/mentions-legales" className="hover:text-primary">Mentions</Link>
          <span>·</span>
          <Link to="/confidentialite" className="hover:text-primary">Confidentialité</Link>
        </div>
        <p className="text-center text-cream/30 text-[10px] mt-3">
          © {new Date().getFullYear()} Transports Ligneo
        </p>
      </footer>
    </div>
  );
}

/* === Sub-components === */

function ShortcutCard({
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
    <Link to={to} className="mobile-card-pressable p-4 flex flex-col gap-2 min-h-[100px] justify-between">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="text-cream font-heading text-[13px] tracking-wide leading-tight">{label}</p>
        <p className="text-cream/45 text-[11px] mt-0.5">{sub}</p>
      </div>
    </Link>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-heading text-primary text-xl tracking-wide">{value}</p>
      <p className="text-cream/55 text-[10px] uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}

function Divider() {
  return <div className="w-px bg-primary/15 mx-auto h-full" />;
}

function SectionTitle({ title, link }: { title: string; link?: { label: string; to: string } }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="font-heading text-cream/85 text-xs tracking-[0.2em] uppercase">{title}</h2>
      {link && (
        <Link to={link.to} className="text-primary text-[11px] tracking-wide flex items-center gap-0.5">
          {link.label}
          <ChevronRight size={14} />
        </Link>
      )}
    </div>
  );
}

function Engagement({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="mobile-card p-3 flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-cream text-sm font-heading tracking-wide">{title}</p>
        <p className="text-cream/55 text-xs mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="mobile-card p-3 flex items-start gap-3">
      <span className="font-heading text-primary/80 text-2xl leading-none w-9 text-center">{n}</span>
      <div className="flex-1 min-w-0">
        <p className="text-cream text-sm font-heading tracking-wide">{title}</p>
        <p className="text-cream/55 text-xs mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

