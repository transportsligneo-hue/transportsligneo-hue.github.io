import { Link } from "@tanstack/react-router";
import { Shield, Clock, CheckCircle2, Zap, Phone, Mail, Globe, ArrowRight, ArrowUp, Linkedin } from "lucide-react";
import logoLigneo from "@/assets/logo-transports-ligneo-officiel.png";
import { openCookiePreferences } from "@/lib/cookie-consent";
import NewsletterForm from "@/components/public/NewsletterForm";
import StoreBadges from "@/components/public/StoreBadges";
import ThemePreference from "@/components/ThemePreference";


const trustItems = [
  { icon: Shield, label: "Assurance incluse" },
  { icon: Clock, label: "Disponible 7j/7" },
  { icon: CheckCircle2, label: "0 frais caché" },
  { icon: Zap, label: "Devis en 30s" },
];

const navLinks: { label: string; to: string }[] = [
  { label: "Accueil", to: "/" },
  { label: "Services", to: "/services" },
  { label: "Tarifs", to: "/tarifs" },
  { label: "Suivre ma mission", to: "/suivi" },
  { label: "Actualités", to: "/actualites" },
  { label: "À propos", to: "/a-propos" },
  { label: "Contact", to: "/contact" },
];

const legalLinks: { label: string; to: string }[] = [
  { label: "Espace professionnels", to: "/pro" },
  { label: "Conditions Générales de Vente", to: "/cgv" },
  { label: "Mentions Légales", to: "/mentions-legales" },
  { label: "Politique de Confidentialité", to: "/confidentialite" },
  { label: "Devenir convoyeur", to: "/devenir-convoyeur" },
  { label: "Espace pro", to: "/login" },
];

export default function Footer() {
  const scrollTop = () => {
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer
      className="relative overflow-hidden"
      style={{ background: "linear-gradient(180deg,#132a6b 0%,#102153 45%,#0c1c4a 100%)" }}
    >
      {/* Halos flottants */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-36 left-[10%] h-[360px] w-[360px] rounded-full blur-2xl animate-[ligneoBlob_8s_ease-in-out_infinite]"
        style={{ background: "radial-gradient(circle, rgba(63,123,255,0.25), transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 right-[5%] h-[380px] w-[380px] rounded-full blur-2xl animate-[ligneoBlob_9s_ease-in-out_infinite_reverse]"
        style={{ background: "radial-gradient(circle, rgba(217,181,74,0.14), transparent 70%)" }}
      />

      {/* Ligne lumineuse en haut */}
      <div
        className="relative h-[2px] w-full animate-[ligneoLineDrift_6s_linear_infinite]"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(122,163,255,0.6), rgba(217,181,74,0.6), rgba(122,163,255,0.6), transparent)",
          backgroundSize: "200% 100%",
        }}
      />

      {/* Particules */}
      {[
        { top: 40, left: "15%", delay: 0 },
        { top: 90, left: "60%", delay: 1.5 },
        { top: 150, left: "85%", delay: 3 },
        { top: 200, left: "35%", delay: 2 },
      ].map((p, i) => (
        <span
          key={i}
          aria-hidden
          className="pointer-events-none absolute h-[3px] w-[3px] rounded-full animate-[ligneoDriftUp_7s_ease-in-out_infinite]"
          style={{
            top: p.top,
            left: p.left,
            animationDelay: `${p.delay}s`,
            background: "rgba(180,205,255,0.6)",
            filter: "blur(0.5px)",
          }}
        />
      ))}

      {/* Bande confiance */}
      <div className="relative z-10 flex flex-wrap justify-center gap-6 md:gap-10 border-b border-[#7aa3ff]/15 px-8 py-6">
        {trustItems.map((t, i) => (
          <div key={t.label} className="flex items-center gap-2 text-[12.5px] font-semibold text-[#9aa6c9]">
            <t.icon
              size={15}
              className="shrink-0 text-[#d9b54a] animate-[ligneoIconPulse_2.6s_ease-in-out_infinite]"
              style={{ animationDelay: `${i * 0.4}s` }}
            />
            {t.label}
          </div>
        ))}
      </div>

      {/* Colonnes */}
      <div className="relative z-10 mx-auto grid max-w-[1180px] grid-cols-1 gap-9 px-8 pb-8 pt-12 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
        {/* Bloc marque */}
        <div>
          <div className="mb-4 flex items-center gap-3">
            <div
              className="h-11 w-11 overflow-hidden rounded-xl animate-[ligneoLogoGlow_3s_ease-in-out_infinite]"
              style={{ boxShadow: "0 0 0 1px rgba(122,163,255,0.4), 0 0 16px rgba(63,123,255,0.4)" }}
            >
              <img src={logoLigneo} alt="Transports Ligneo" className="h-full w-full object-cover" loading="lazy" />
            </div>
            <span
              className="font-heading text-[15px] font-extrabold tracking-[0.03em] text-white"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              TRANSPORTS <span className="text-[#6ea1ff] [text-shadow:0_0_10px_rgba(91,143,255,0.6)]">LIGNEO</span>
            </span>
          </div>
          <p className="mb-5 max-w-[260px] text-[13px] leading-relaxed text-[#9aa6c9]">
            Convoyage et Logistique Automobile.<br />
            Basé à Tours (37) · France et Europe.
          </p>
          <div className="flex gap-2.5">
            <a
              href="https://www.linkedin.com/company/transports-ligneo/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn Transports Ligneo"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#7aa3ff]/30 bg-white/[0.03] text-[#9aa6c9] transition-all duration-300 hover:-translate-y-0.5 hover:scale-110 hover:border-[#0a66c2] hover:bg-[#0a66c2] hover:text-white hover:shadow-[0_8px_18px_rgba(10,102,194,0.4)]"
            >
              <Linkedin size={16} />
            </a>
          </div>
        </div>

        {/* Navigation */}
        <div>
          <p
            className="mb-4 text-[11.5px] font-bold uppercase tracking-[0.1em] text-[#d9b54a]"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Navigation
          </p>
          <ul className="flex flex-col gap-3">
            {navLinks.map((l) => (
              <li key={l.label}>
                <Link to={l.to} className="group relative inline-flex w-fit items-center text-[13.5px] text-[#9aa6c9] transition-all duration-300 hover:translate-x-1 hover:text-white">
                  <span className="absolute -left-4 text-[#4f8cff] opacity-0 transition-all duration-300 group-hover:-left-3.5 group-hover:opacity-100">›</span>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Infos légales */}
        <div>
          <p
            className="mb-4 text-[11.5px] font-bold uppercase tracking-[0.1em] text-[#d9b54a]"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Informations légales
          </p>
          <ul className="flex flex-col gap-3">
            {legalLinks.map((l) => (
              <li key={l.label}>
                <Link to={l.to} className="group relative inline-flex w-fit items-center text-[13.5px] text-[#9aa6c9] transition-all duration-300 hover:translate-x-1 hover:text-white">
                  <span className="absolute -left-4 text-[#4f8cff] opacity-0 transition-all duration-300 group-hover:-left-3.5 group-hover:opacity-100">›</span>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Coordonnées */}
        <div>
          <p
            className="mb-4 text-[11.5px] font-bold uppercase tracking-[0.1em] text-[#d9b54a]"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Coordonnées
          </p>
          <a href="tel:+33782456181" className="mb-3.5 flex items-center gap-2.5 text-[13.5px] text-[#9aa6c9] transition-colors hover:text-white">
            <Phone size={15} className="shrink-0 text-[#4f8cff]" /> 07 82 45 61 81
          </a>
          <a href="mailto:contact@transportsligneo.fr" className="mb-3.5 flex items-center gap-2.5 text-[13.5px] text-[#9aa6c9] transition-colors hover:text-white">
            <Mail size={15} className="shrink-0 text-[#4f8cff]" /> contact@transportsligneo.fr
          </a>
          <div className="mb-4 flex items-center gap-2.5 text-[13.5px] text-[#9aa6c9]">
            <Globe size={15} className="shrink-0 text-[#4f8cff]" /> www.transportsligneo.fr
          </div>
          <Link
            to="/contact"
            className="relative mt-2 inline-flex items-center gap-2 overflow-hidden rounded-full px-4.5 py-2.5 text-[12.5px] font-bold text-white shadow-[0_10px_22px_rgba(47,95,255,0.35)]"
            style={{ background: "linear-gradient(120deg,#2f5fff,#2450e0 60%,#4f8cff)", padding: "10px 18px" }}
          >
            <span
              aria-hidden
              className="absolute inset-y-0 -left-[60%] h-full w-[40%] -skew-x-12 animate-[ligneoShine_3.4s_ease-in-out_infinite]"
              style={{ background: "linear-gradient(120deg,transparent,rgba(255,255,255,0.35),transparent)" }}
            />
            <span className="relative flex items-center gap-2">
              Nous contacter <ArrowRight size={13} />
            </span>
          </Link>
        </div>
      </div>

      {/* Newsletter + application */}
      <div className="relative z-10 mx-auto grid max-w-[1180px] gap-8 border-t border-[#7aa3ff]/15 px-8 py-8 md:grid-cols-2">
        <div>
          <p
            className="mb-4 text-[11.5px] font-bold uppercase tracking-[0.1em] text-[#d9b54a]"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Newsletter
          </p>
          <NewsletterForm />
        </div>
        <div>
          <p
            className="mb-4 text-[11.5px] font-bold uppercase tracking-[0.1em] text-[#d9b54a]"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Application convoyeur
          </p>
          <p className="mb-3 text-[13.5px] text-[#9aa6c9]">
            Missions, états des lieux et suivi GPS depuis votre mobile.
          </p>
          <StoreBadges />
        </div>
      </div>


      {/* Bas */}
      <div className="relative z-10 mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 border-t border-[#7aa3ff]/15 px-8 py-5">
        <p className="text-xs text-[#9aa6c9]">
          © {new Date().getFullYear()} <b className="text-white">Transports Ligneo</b> · Tous droits réservés
          <span className="mx-2 opacity-40">·</span>
          <button
            type="button"
            onClick={() => openCookiePreferences()}
            className="underline underline-offset-2 transition-colors hover:text-white"
          >
            Gérer mes cookies
          </button>
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <ThemePreference />
          <button
            onClick={scrollTop}
            type="button"
            className="flex items-center gap-1.5 rounded-full border border-[#7aa3ff]/30 bg-[#3f7bff]/10 px-4 py-2 text-xs font-bold text-[#4f8cff] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#3f7bff]/20"
          >
            <ArrowUp size={13} className="animate-[ligneoFloatUp_2s_ease-in-out_infinite]" />
            Haut de page
          </button>
        </div>

      </div>
    </footer>
  );
}
