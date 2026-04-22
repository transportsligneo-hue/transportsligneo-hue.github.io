import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Calendar,
  FileText,
  MapPin,
  Phone,
  ShieldCheck,
  Star,
  ChevronRight,
  Truck,
  Clock,
  Euro,
} from "lucide-react";
import logoLigneo from "@/assets/logo-transports-ligneo-officiel.png";
import ReservationModal from "@/components/ReservationModal";
import MobilePartnersStrip from "@/components/mobile/MobilePartnersStrip";
import { useAuth } from "@/hooks/useAuth";

/**
 * Écran d'accueil mobile type application native.
 * Visible uniquement sur mobile (md:hidden) — laisse la version desktop intacte.
 */
export default function MobileHomeScreen() {
  const [reserveOpen, setReserveOpen] = useState(false);
  const { isAuthenticated, role } = useAuth();
  const navigate = useNavigate();

  const goEspace = () => {
    if (!isAuthenticated) return navigate({ to: "/login" });
    if (role === "admin") return navigate({ to: "/admin" });
    if (role === "convoyeur") return navigate({ to: "/convoyeur" });
    return navigate({ to: "/dashboard-client" });
  };

  return (
    <div className="md:hidden section-bg min-h-screen pb-bottom-nav">
      {/* Header app — compact */}
      <header className="safe-top px-5 pt-4 pb-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2" aria-label="Accueil">
          <img src={logoLigneo} alt="Transports Ligneo" className="h-10 w-auto object-contain" loading="eager" />
        </Link>
        <button
          onClick={goEspace}
          className="w-10 h-10 rounded-full gold-border flex items-center justify-center tap-scale"
          aria-label="Mon espace"
        >
          <ShieldCheck size={18} className="text-primary" />
        </button>
      </header>

      {/* Hero compact */}
      <section className="px-5 pt-2 pb-6">
        <p className="font-heading text-cream/50 text-[11px] tracking-[0.2em] uppercase">
          Bienvenue chez
        </p>
        <h1 className="font-heading text-primary text-3xl tracking-[0.05em] mt-1 leading-tight">
          Transports Ligneo
        </h1>
        <p className="text-cream/65 text-sm mt-3 leading-relaxed">
          Convoyage automobile premium. <span className="text-gold-light italic">La tranquillité sur toute la ligne.</span>
        </p>

        {/* CTA principal */}
        <button
          onClick={() => setReserveOpen(true)}
          className="mt-5 w-full h-14 rounded-2xl bg-primary text-primary-foreground font-heading text-sm tracking-[0.15em] uppercase tap-scale flex items-center justify-center gap-2 shadow-[0_10px_30px_-10px_rgba(212,175,55,0.6)]"
        >
          <Calendar size={18} />
          Réserver un convoyage
        </button>
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
        <div className="mobile-card p-4">
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

      <ReservationModal open={reserveOpen} onClose={() => setReserveOpen(false)} />
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

function Review({ name, role, text, stars }: { name: string; role: string; text: string; stars: number }) {
  return (
    <div className="mobile-card p-4 min-w-[78%] snap-start">
      <div className="flex gap-1 mb-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} size={12} className={i < stars ? "text-primary fill-primary" : "text-cream/20"} />
        ))}
      </div>
      <p className="text-cream/75 text-xs leading-relaxed mb-3">"{text}"</p>
      <p className="font-heading text-primary text-xs">{name}</p>
      <p className="text-cream/45 text-[10px]">{role}</p>
    </div>
  );
}
