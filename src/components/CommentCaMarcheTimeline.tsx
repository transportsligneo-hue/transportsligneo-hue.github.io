import { Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import {
  UserPlus, Calculator, FileText, PenLine, Inbox, ShieldCheck,
  UserCheck, MapPin, Car, ClipboardCheck, Receipt, CheckCircle,
  Clock, ArrowRight, Phone, LayoutDashboard, History, FolderOpen,
  Activity, Truck, Sparkles,
} from "lucide-react";

const steps = [
  { icon: UserPlus, n: "01", title: "Création de compte", desc: "Inscription en moins d'une minute. Espace sécurisé avec devis, factures et missions." },
  { icon: Calculator, n: "02", title: "Estimateur intelligent", desc: "Départ, arrivée, véhicule (recherche par plaque), date. Tarif clair en 3 secondes." },
  { icon: FileText, n: "03", title: "Devis automatique", desc: "Devis horodaté, numéroté, transmis instantanément et disponible dans votre espace." },
  { icon: PenLine, n: "04", title: "Signature électronique", desc: "Signature en ligne à valeur probante. Mise en production immédiate de la mission." },
  { icon: Inbox, n: "05", title: "Réception admin", desc: "Notre équipe reçoit le devis signé dans le dashboard avec toutes les pièces jointes." },
  { icon: ShieldCheck, n: "06", title: "Validation exploitation", desc: "Contrôle de cohérence, vérification des contraintes et validation finale." },
  { icon: UserCheck, n: "07", title: "Attribution convoyeur", desc: "Convoyeur certifié affecté selon zone, disponibilité et notation." },
  { icon: MapPin, n: "08", title: "Suivi GPS temps réel", desc: "Position live, ETA, étapes franchies, directement depuis votre espace client." },
  { icon: Car, n: "09", title: "Livraison ponctuelle", desc: "Convoyeur identifié, ponctualité contractuelle, contact direct avec le destinataire." },
  { icon: ClipboardCheck, n: "10", title: "État des lieux signé", desc: "EDL digital entrée/sortie : photos 360°, kilométrage, carburant, signature contradictoire." },
  { icon: Receipt, n: "11", title: "Facturation automatique", desc: "Facture générée dès la livraison, conforme et archivée dans votre espace." },
  { icon: CheckCircle, n: "12", title: "Historique centralisé", desc: "Devis, signatures, EDL, factures, photos, GPS — tout consultable en un clic." },
];

const fleetFeatures = [
  { icon: LayoutDashboard, title: "Tableau de bord", desc: "Véhicules disponibles, en convoyage, missions en cours, terminées et à venir. Statistiques d'activité en temps réel." },
  { icon: Truck, title: "Gestion de flotte", desc: "Centralisez tous vos véhicules, suivez les convoyages et pilotez votre parc depuis un seul écran." },
  { icon: History, title: "Historique complet", desc: "Toutes les missions, trajets, départs, arrivées, dates, convoyeurs et états des lieux archivés." },
  { icon: FolderOpen, title: "Documents centralisés", desc: "Devis, factures, EDL, signatures, photos et historiques accessibles depuis un espace unique." },
  { icon: Activity, title: "Suivi temps réel", desc: "Avancement des missions, étapes franchies, horaires, statuts et notifications instantanées." },
  { icon: ShieldCheck, title: "Alertes & sécurité", desc: "Alertes administratives, signature électronique probante et traçabilité complète des actions." },
];

/** Reveal on scroll — CSS-only via IntersectionObserver (aucune lib) */
function useReveal() {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const els = root.querySelectorAll<HTMLElement>("[data-reveal]");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-revealed");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return rootRef;
}

export default function CommentCaMarcheTimeline() {
  const rootRef = useReveal();

  return (
    <div ref={rootRef}>
      {/* ============ HERO ============ */}
      <section
        className="relative overflow-hidden pt-24 pb-20 lg:pt-32 lg:pb-28"
        style={{ background: "linear-gradient(160deg, #061238 0%, #0a1f5c 50%, #0f2d80 100%)" }}
      >
        <div aria-hidden className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(60% 50% at 50% 0%, rgba(96,165,250,0.18), transparent 70%)" }} />
        <div aria-hidden className="absolute inset-0 pointer-events-none opacity-40"
          style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="relative max-w-3xl mx-auto px-5 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] backdrop-blur px-4 py-1.5 text-[10.5px] uppercase tracking-[0.28em] text-blue-200 font-heading">
            <Sparkles size={12} /> Notre process
          </span>
          <h1 className="font-heading text-[34px] sm:text-4xl lg:text-6xl tracking-wide text-cream mt-5 leading-[1.08]">
            Comment <span className="gold-gradient-text">ça marche</span>
          </h1>
          <p className="text-cream/75 mt-4 text-[15px] lg:text-lg leading-relaxed">
            De la création de compte à la facture : <strong className="text-white">12 étapes</strong> claires, traçables et 100 % digitalisées.
          </p>
        </div>
        <div aria-hidden className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ height: "80px" }}>
          <svg viewBox="0 0 1440 120" preserveAspectRatio="none" className="w-full h-full block">
            <path d="M0,80 C320,20 760,5 1080,30 C1240,42 1360,70 1440,55 L1440,120 L0,120 Z" fill="var(--surface-cream, #faf7ef)" />
          </svg>
        </div>
      </section>

      {/* ============ TIMELINE ============ */}
      <section className="py-14 lg:py-20" style={{ background: "var(--surface-cream, #faf7ef)" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="relative">
            {/* Ligne centrale animée */}
            <div
              aria-hidden
              className="ccm-rail absolute left-[22px] md:left-1/2 top-0 bottom-0 w-[2px] -translate-x-0 md:-translate-x-1/2"
            />

            <ol className="space-y-4 md:space-y-6">
              {steps.map((step, i) => {
                const Icon = step.icon;
                const isLeft = i % 2 === 0;
                return (
                  <li
                    key={i}
                    data-reveal
                    style={{ transitionDelay: `${Math.min(i * 40, 240)}ms` }}
                    className="ccm-reveal relative md:grid md:grid-cols-2 md:gap-10 items-center"
                  >
                    {/* Pastille icône */}
                    <div className="absolute left-[22px] md:left-1/2 -translate-x-1/2 z-10 top-4 md:top-1/2 md:-translate-y-1/2">
                      <div className="ccm-node w-11 h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center">
                        <Icon className="text-[#0b1026]" size={19} strokeWidth={2.3} />
                      </div>
                    </div>

                    {/* Carte */}
                    <div
                      className={`pl-[58px] md:pl-0 ${
                        isLeft ? "md:pr-12 md:text-right" : "md:col-start-2 md:pl-12"
                      }`}
                    >
                      <article className="ccm-card group relative rounded-2xl bg-white p-5 sm:p-6 border border-[#0b1026]/[0.06] shadow-[0_1px_2px_rgba(11,16,38,0.04),0_10px_30px_-15px_rgba(11,16,38,0.15)] hover:shadow-[0_2px_4px_rgba(11,16,38,0.05),0_25px_45px_-20px_rgba(11,16,38,0.25)] hover:-translate-y-0.5 transition-all duration-300">
                        <div className={`flex items-center gap-2 mb-2 ${isLeft ? "md:justify-end" : ""}`}>
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#e7c76a]/15 to-[#d4af37]/10 border border-[#d4af37]/30 px-2.5 py-0.5">
                            <span className="text-[#b8860b] text-[10px] font-heading tracking-[0.24em] uppercase">
                              Étape {step.n}
                            </span>
                          </span>
                        </div>
                        <h2 className="font-heading text-[17px] sm:text-[19px] text-[#0b1026] tracking-wide leading-snug mb-1.5">
                          {step.title}
                        </h2>
                        <p className="text-[#0b1026]/65 text-[13.5px] leading-relaxed">
                          {step.desc}
                        </p>
                        {/* Filet doré au hover */}
                        <span aria-hidden className="pointer-events-none absolute inset-x-4 bottom-0 h-px bg-gradient-to-r from-transparent via-[#d4af37]/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </article>
                    </div>

                    <div className={isLeft ? "hidden md:block md:col-start-2" : "hidden md:block md:col-start-1 md:row-start-1"} />
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </section>

      {/* ============ GÉRER SA FLOTTE ============ */}
      <section
        className="relative py-16 lg:py-24 overflow-hidden"
        style={{ background: "linear-gradient(160deg, #061238 0%, #0a1f5c 50%, #0f2d80 100%)" }}
      >
        <div aria-hidden className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(80% 60% at 50% 0%, rgba(96,165,250,0.16), transparent 70%)" }} />

        <div className="relative max-w-6xl mx-auto px-5 sm:px-6">
          <div className="text-center mb-10 lg:mb-14" data-reveal>
            <span className="ccm-reveal inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] backdrop-blur px-4 py-1.5 text-[10.5px] uppercase tracking-[0.28em] text-blue-200 font-heading">
              <Truck size={12} /> Plateforme complète
            </span>
            <h2 className="font-heading text-[28px] sm:text-4xl lg:text-5xl text-cream mt-5 leading-[1.1]">
              🚗 Gérez votre flotte <span className="gold-gradient-text">en toute simplicité</span>
            </h2>
            <p className="text-cream/70 mt-4 text-[15px] lg:text-base max-w-2xl mx-auto leading-relaxed">
              Bien plus qu'un service de convoyage : une véritable plateforme digitale pour piloter votre parc, vos missions et vos documents depuis un seul espace.
            </p>
          </div>

          {/* Grid features */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {fleetFeatures.map((f, i) => {
              const Icon = f.icon;
              return (
                <article
                  key={i}
                  data-reveal
                  style={{ transitionDelay: `${i * 60}ms` }}
                  className="ccm-reveal ccm-glass group relative rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-400/25 to-blue-600/15 border border-blue-300/25 text-blue-100 mb-4 group-hover:scale-110 transition-transform">
                    <Icon size={20} strokeWidth={2.1} />
                  </div>
                  <h3 className="font-heading text-cream text-[17px] tracking-wide mb-1.5">{f.title}</h3>
                  <p className="text-cream/65 text-[13.5px] leading-relaxed">{f.desc}</p>
                </article>
              );
            })}
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-3 gap-3 sm:gap-5 mt-10 lg:mt-14 max-w-3xl mx-auto" data-reveal>
            {[
              { v: "100%", l: "Digitalisé" },
              { v: "7j/7", l: "Disponible" },
              { v: "0", l: "Annulation" },
            ].map((k, i) => (
              <div key={i} className="ccm-reveal text-center rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur px-3 py-5">
                <p className="font-heading text-[26px] sm:text-3xl text-cream">
                  <span className="gold-gradient-text">{k.v}</span>
                </p>
                <p className="text-cream/60 text-[10.5px] uppercase tracking-[0.22em] mt-1">{k.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ CTA FINAL ============ */}
      <section
        className="relative py-16 lg:py-20"
        style={{ background: "var(--surface-cream, #faf7ef)" }}
      >
        <div className="max-w-3xl mx-auto px-5 sm:px-6 text-center" data-reveal>
          <div className="ccm-reveal">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#d4af37]/40 bg-[#e7c76a]/10 px-4 py-1.5 text-[10.5px] uppercase tracking-[0.28em] text-[#b8860b] font-heading">
              Prêt à démarrer ?
            </span>
            <h2 className="font-heading text-[26px] sm:text-3xl lg:text-4xl text-[#0b1026] mt-5 leading-tight">
              Prêt à simplifier la gestion <span className="gold-gradient-text">de vos véhicules</span> ?
            </h2>
            <p className="text-[#0b1026]/65 mt-4 text-[15px] leading-relaxed">
              Obtenez un devis en 3 secondes ou parlez directement à un conseiller. Sans engagement.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
              <Link
                to="/tarifs"
                className="inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl bg-gradient-to-r from-[#e7c76a] via-[#d4af37] to-[#e7c76a] bg-[length:200%_100%] hover:bg-[position:100%_0] text-[#0b1026] font-heading text-[11.5px] tracking-[0.24em] uppercase shadow-[0_15px_40px_-12px_rgba(231,199,106,0.55)] transition-all duration-300"
              >
                <Car size={15} /> Demander un devis
              </Link>
              <Link
                to="/contact"
                className="inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl border border-[#0b1026]/20 bg-white text-[#0b1026] font-heading text-[11.5px] tracking-[0.24em] uppercase hover:border-[#0b1026]/60 hover:bg-[#0b1026] hover:text-[#e7c76a] transition-all duration-300"
              >
                <Phone size={15} /> Contacter un conseiller
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============ Réassurance ============ */}
      <section
        className="relative py-14 lg:py-16"
        style={{ background: "linear-gradient(160deg, #061238 0%, #0a1f5c 50%, #0f2d80 100%)" }}
      >
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e7c76a]/40 to-transparent" />
        <div className="max-w-4xl mx-auto px-5">
          <div className="grid grid-cols-3 gap-3 sm:gap-5">
            {[
              { icon: ShieldCheck, label: "Assurance incluse" },
              { icon: Clock, label: "Disponible 7j/7" },
              { icon: CheckCircle, label: "0 annulation" },
            ].map((r, i) => (
              <div
                key={i}
                data-reveal
                style={{ transitionDelay: `${i * 80}ms` }}
                className="ccm-reveal group p-4 sm:p-5 rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm text-center hover:border-[#e7c76a]/40 transition-all duration-500"
              >
                <div className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#e7c76a]/40 bg-[#e7c76a]/10 text-[#e7c76a]">
                  <r.icon size={18} />
                </div>
                <p className="text-cream/85 text-[10.5px] sm:text-[11.5px] font-heading tracking-[0.18em] uppercase leading-tight">{r.label}</p>
              </div>
            ))}
          </div>

          <p className="text-center mt-8">
            <Link
              to="/tarifs"
              className="inline-flex items-center gap-2 text-cream/80 text-sm hover:text-[#e7c76a] transition-colors"
            >
              Estimer mon trajet <ArrowRight size={14} />
            </Link>
          </p>
        </div>
      </section>

      {/* ==== Styles scoped à la page ==== */}
      <style>{`
        .ccm-reveal {
          opacity: 0;
          transform: translateY(14px);
          transition: opacity .55s cubic-bezier(.2,.7,.2,1), transform .55s cubic-bezier(.2,.7,.2,1);
          will-change: opacity, transform;
        }
        .ccm-reveal.is-revealed,
        [data-reveal].is-revealed .ccm-reveal { opacity: 1; transform: none; }
        [data-reveal].is-revealed { opacity: 1; }
        [data-reveal] > .ccm-reveal { opacity: 1; transform: none; }
        li[data-reveal].is-revealed { }
        li[data-reveal] { opacity: 0; transform: translateY(14px); transition: opacity .55s cubic-bezier(.2,.7,.2,1), transform .55s cubic-bezier(.2,.7,.2,1); }
        li[data-reveal].is-revealed { opacity: 1; transform: none; }

        .ccm-rail {
          background: linear-gradient(180deg,
            rgba(212,175,55,0) 0%,
            rgba(212,175,55,0.45) 12%,
            rgba(231,199,106,0.7) 50%,
            rgba(212,175,55,0.45) 88%,
            rgba(212,175,55,0) 100%);
          box-shadow: 0 0 12px rgba(231,199,106,0.25);
        }
        .ccm-node {
          background: linear-gradient(135deg, #e7c76a 0%, #d4af37 100%);
          box-shadow:
            0 8px 22px -6px rgba(212,175,55,0.55),
            0 0 0 4px rgba(250, 247, 239, 0.9),
            0 0 0 5px rgba(212,175,55,0.25);
          transition: transform .3s ease, box-shadow .3s ease;
        }
        li:hover .ccm-node {
          transform: scale(1.08);
          box-shadow:
            0 10px 28px -6px rgba(212,175,55,0.7),
            0 0 0 4px rgba(250, 247, 239, 0.9),
            0 0 0 6px rgba(212,175,55,0.4);
        }
        .ccm-glass {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
          backdrop-filter: blur(14px) saturate(140%);
        }
        .ccm-glass:hover {
          background: rgba(255,255,255,0.07);
          border-color: rgba(147, 197, 253, 0.25);
          box-shadow: 0 20px 45px -20px rgba(59,130,246,0.35);
        }
        @media (prefers-reduced-motion: reduce) {
          .ccm-reveal, li[data-reveal] { opacity: 1 !important; transform: none !important; transition: none !important; }
        }
      `}</style>
    </div>
  );
}
