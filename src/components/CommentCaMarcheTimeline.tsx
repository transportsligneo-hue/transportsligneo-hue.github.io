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
    <div ref={rootRef} className="ccm-root">
      {/* ============ HERO ============ */}
      <section
        className="ccm-hero relative overflow-hidden pt-24 pb-24 lg:pt-32 lg:pb-32"
      >
        {/* Aurora animée */}
        <div aria-hidden className="ccm-aurora" />
        {/* Grille technique */}
        <div aria-hidden className="ccm-grid" />
        {/* Scanning beam horizontal */}
        <div aria-hidden className="ccm-scanline" />
        {/* Halo central */}
        <div aria-hidden className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(60% 50% at 50% 0%, rgba(96,165,250,0.22), transparent 70%)" }} />

        <div className="relative max-w-3xl mx-auto px-5 text-center">
          <span className="ccm-chip inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[10.5px] uppercase tracking-[0.3em] font-heading">
            <Sparkles size={12} className="text-blue-300" /> Notre process
          </span>
          <h1 className="ccm-title font-heading text-[36px] sm:text-5xl lg:text-6xl tracking-wide text-cream mt-6 leading-[1.05]">
            Comment <span className="ccm-title-accent">ça marche</span>
          </h1>
          <p className="text-cream/75 mt-5 text-[15px] lg:text-lg leading-relaxed">
            De la création de compte à la facture&nbsp;: <strong className="text-white">12 étapes</strong> claires, traçables et 100 % digitalisées.
          </p>
          <div className="mt-6 inline-flex items-center gap-3 text-cream/60 text-[11px] tracking-[0.22em] uppercase font-heading">
            <span className="h-px w-8 bg-gradient-to-r from-transparent to-blue-300/60" />
            Plateforme digitale nouvelle génération
            <span className="h-px w-8 bg-gradient-to-l from-transparent to-blue-300/60" />
          </div>
        </div>

      </section>

      {/* ============ TIMELINE ============ */}
      <section className="ccm-hero py-14 lg:py-20 relative overflow-hidden">
        <div aria-hidden className="ccm-aurora" />
        <div aria-hidden className="ccm-grid opacity-40" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="relative">
            {/* Ligne centrale : bleu électrique + doré */}
            <div
              aria-hidden
              className="ccm-rail absolute left-[22px] md:left-1/2 top-0 bottom-0 w-[2px] md:-translate-x-1/2"
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
                      <article className="ccm-card group relative rounded-2xl p-5 sm:p-6 transition-all duration-300">
                        <div className={`flex items-center gap-2 mb-2 ${isLeft ? "md:justify-end" : ""}`}>
                          <span className="ccm-step-chip inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5">
                            <span className="text-[10px] font-heading tracking-[0.24em] uppercase">
                              Étape {step.n}
                            </span>
                          </span>
                        </div>
                        <h2 className="font-heading text-[17px] sm:text-[19px] text-cream tracking-wide leading-snug mb-1.5">
                          {step.title}
                        </h2>
                        <p className="text-cream/70 text-[13.5px] leading-relaxed">
                          {step.desc}
                        </p>
                        {/* Filet iridescent au hover */}
                        <span aria-hidden className="ccm-card-underline pointer-events-none absolute inset-x-4 bottom-0 h-px opacity-0 group-hover:opacity-100 transition-opacity" />
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
      <section className="ccm-hero relative py-16 lg:py-24 overflow-hidden">
        <div aria-hidden className="ccm-aurora" />
        <div aria-hidden className="ccm-grid opacity-60" />

        <div className="relative max-w-6xl mx-auto px-5 sm:px-6">
          <div className="text-center mb-10 lg:mb-14" data-reveal>
            <span className="ccm-reveal ccm-chip inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[10.5px] uppercase tracking-[0.3em] font-heading">
              <Truck size={12} className="text-blue-300" /> Plateforme complète
            </span>
            <h2 className="font-heading text-[28px] sm:text-4xl lg:text-5xl text-cream mt-5 leading-[1.1]">
              Gérez votre flotte <span className="ccm-title-accent">en toute simplicité</span>
            </h2>
            <p className="text-cream/70 mt-4 text-[15px] lg:text-base max-w-2xl mx-auto leading-relaxed">
              Bien plus qu'un service de convoyage&nbsp;: une véritable plateforme digitale pour piloter votre parc, vos missions et vos documents depuis un seul espace.
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
                  className="ccm-reveal ccm-fleet-card group relative rounded-2xl p-6 transition-all duration-500 hover:-translate-y-1"
                >
                  <div className="ccm-fleet-icon inline-flex h-11 w-11 items-center justify-center rounded-xl mb-4 transition-transform duration-500 group-hover:scale-110">
                    <Icon size={20} strokeWidth={2.1} />
                  </div>
                  <h3 className="font-heading text-cream text-[17px] tracking-wide mb-1.5">{f.title}</h3>
                  <p className="text-cream/65 text-[13.5px] leading-relaxed">{f.desc}</p>
                  <span aria-hidden className="ccm-fleet-corner" />
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
              <div key={i} className="ccm-reveal ccm-kpi text-center rounded-2xl px-3 py-5">
                <p className="font-heading text-[26px] sm:text-3xl">
                  <span className="ccm-kpi-value">{k.v}</span>
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
                className="ccm-btn-primary group inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl font-heading text-[11.5px] tracking-[0.24em] uppercase transition-all duration-300"
              >
                <Car size={15} /> Demander un devis
              </Link>
              <Link
                to="/contact"
                className="ccm-btn-ghost inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl font-heading text-[11.5px] tracking-[0.24em] uppercase transition-all duration-300"
              >
                <Phone size={15} /> Contacter un conseiller
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============ Réassurance ============ */}
      <section className="ccm-hero relative py-14 lg:py-16 overflow-hidden">
        <div aria-hidden className="ccm-aurora opacity-70" />
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e7c76a]/50 to-transparent" />
        <div className="relative max-w-4xl mx-auto px-5">
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
                className="ccm-reveal ccm-reass group p-4 sm:p-5 rounded-2xl text-center transition-all duration-500"
              >
                <div className="ccm-reass-icon mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full">
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

      {/* ==== Styles scoped ==== */}
      <style>{`
        .ccm-root { --ccm-blue-1: #061238; --ccm-blue-2: #0a1f5c; --ccm-blue-3: #0f2d80; --ccm-electric: #3b82f6; --ccm-cyan: #38bdf8; --ccm-gold: #d4af37; --ccm-gold-light: #e7c76a; }

        /* ---------- HERO / SECTIONS SOMBRES ---------- */
        .ccm-hero {
          background:
            radial-gradient(120% 80% at 50% 0%, rgba(59,130,246,0.20), transparent 60%),
            linear-gradient(160deg, var(--ccm-blue-1) 0%, var(--ccm-blue-2) 50%, var(--ccm-blue-3) 100%);
          isolation: isolate;
        }
        .ccm-aurora {
          position: absolute; inset: -20%;
          background:
            radial-gradient(35% 35% at 20% 30%, rgba(56,189,248,0.18), transparent 60%),
            radial-gradient(30% 30% at 80% 20%, rgba(99,102,241,0.20), transparent 60%),
            radial-gradient(45% 45% at 60% 90%, rgba(59,130,246,0.22), transparent 60%);
          filter: blur(20px);
          animation: ccm-aurora 22s ease-in-out infinite alternate;
          pointer-events: none;
          z-index: 0;
        }
        @keyframes ccm-aurora {
          0%   { transform: translate3d(-2%, -1%, 0) scale(1); }
          50%  { transform: translate3d(3%, 2%, 0) scale(1.05); }
          100% { transform: translate3d(-1%, 3%, 0) scale(1.02); }
        }
        .ccm-grid {
          position: absolute; inset: 0; pointer-events: none; z-index: 0;
          background-image:
            linear-gradient(to right, rgba(147,197,253,0.07) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(147,197,253,0.07) 1px, transparent 1px);
          background-size: 56px 56px;
          mask-image: radial-gradient(ellipse at 50% 40%, black 40%, transparent 80%);
          -webkit-mask-image: radial-gradient(ellipse at 50% 40%, black 40%, transparent 80%);
        }
        .ccm-scanline {
          position: absolute; left: 0; right: 0; top: 0; height: 1px; z-index: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(147,197,253,0.75) 50%, transparent 100%);
          box-shadow: 0 0 22px rgba(96,165,250,0.6);
          animation: ccm-scan 6s linear infinite;
        }
        @keyframes ccm-scan {
          0%   { transform: translateY(0); opacity: 0; }
          8%   { opacity: 1; }
          92%  { opacity: 1; }
          100% { transform: translateY(90vh); opacity: 0; }
        }

        /* ---------- CHIP HOLOGRAPHIQUE ---------- */
        .ccm-chip {
          color: #dbeafe;
          background: linear-gradient(135deg, rgba(59,130,246,0.14), rgba(56,189,248,0.06));
          border: 1px solid rgba(147,197,253,0.28);
          box-shadow: 0 0 0 1px rgba(255,255,255,0.03) inset, 0 8px 28px -12px rgba(59,130,246,0.55);
          backdrop-filter: blur(10px) saturate(140%);
          position: relative;
        }

        /* ---------- TITRE ---------- */
        .ccm-title { text-shadow: 0 6px 40px rgba(59,130,246,0.35); }
        .ccm-title-accent {
          background: linear-gradient(90deg, #e7c76a 0%, #fff2c2 30%, #d4af37 55%, #e7c76a 80%, #fff2c2 100%);
          background-size: 200% 100%;
          -webkit-background-clip: text; background-clip: text; color: transparent;
          animation: ccm-shine 6s linear infinite;
        }
        @keyframes ccm-shine { to { background-position: 200% 0; } }

        /* ---------- REVEAL ---------- */
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
        li[data-reveal] { opacity: 0; transform: translateY(14px); transition: opacity .55s cubic-bezier(.2,.7,.2,1), transform .55s cubic-bezier(.2,.7,.2,1); }
        li[data-reveal].is-revealed { opacity: 1; transform: none; }

        /* ---------- TIMELINE ---------- */
        .ccm-rail {
          background: linear-gradient(180deg,
            rgba(59,130,246,0) 0%,
            rgba(59,130,246,0.55) 12%,
            rgba(231,199,106,0.85) 50%,
            rgba(59,130,246,0.55) 88%,
            rgba(59,130,246,0) 100%);
          box-shadow: 0 0 16px rgba(59,130,246,0.35), 0 0 22px rgba(231,199,106,0.20);
        }
        .ccm-node {
          background: linear-gradient(135deg, #e7c76a 0%, #d4af37 100%);
          box-shadow:
            0 0 0 4px rgba(250, 247, 239, 0.9),
            0 0 0 5px rgba(59,130,246,0.35),
            0 10px 28px -6px rgba(59,130,246,0.55),
            0 8px 22px -6px rgba(212,175,55,0.45);
          transition: transform .3s ease, box-shadow .3s ease;
        }
        li:hover .ccm-node {
          transform: scale(1.1) rotate(-3deg);
          box-shadow:
            0 0 0 4px rgba(250, 247, 239, 0.95),
            0 0 0 6px rgba(59,130,246,0.55),
            0 14px 34px -6px rgba(59,130,246,0.7),
            0 10px 26px -6px rgba(231,199,106,0.5);
        }

        /* ---------- CARTE ÉTAPE ---------- */
        .ccm-card {
          background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.02));
          border: 1px solid rgba(122,163,255,0.18);
          box-shadow:
            0 1px 2px rgba(4,8,22,0.4),
            0 20px 40px -22px rgba(4,8,22,0.6);
          position: relative;
          overflow: hidden;
          backdrop-filter: blur(10px);
        }
        .ccm-card::before {
          content: ""; position: absolute; inset: 0; border-radius: inherit; padding: 1px;
          background: linear-gradient(135deg, rgba(122,163,255,0.55), rgba(217,181,74,0.5));
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor; mask-composite: exclude;
          opacity: 0; transition: opacity .35s ease; pointer-events: none;
        }
        .ccm-card:hover {
          transform: translateY(-3px);
          border-color: rgba(122,163,255,0.4);
          box-shadow:
            0 30px 55px -22px rgba(47,95,255,0.35),
            0 20px 40px -22px rgba(212,175,55,0.2);
        }
        .ccm-card:hover::before { opacity: 1; }
        .ccm-step-chip {
          background: linear-gradient(90deg, rgba(47,95,255,0.18), rgba(217,181,74,0.18));
          border: 1px solid rgba(217,181,74,0.4);
          color: #e7c76a;
        }
        .ccm-card-underline {
          background: linear-gradient(90deg, transparent, rgba(59,130,246,0.7), rgba(231,199,106,0.8), rgba(59,130,246,0.7), transparent);
        }

        /* ---------- FLEET CARDS ---------- */
        .ccm-fleet-card {
          background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
          border: 1px solid rgba(255,255,255,0.09);
          backdrop-filter: blur(16px) saturate(140%);
          position: relative; overflow: hidden;
        }
        .ccm-fleet-card::before {
          content: ""; position: absolute; inset: 0; border-radius: inherit; padding: 1px;
          background: conic-gradient(from 120deg, rgba(59,130,246,0), rgba(59,130,246,0.55), rgba(56,189,248,0.5), rgba(231,199,106,0.5), rgba(59,130,246,0));
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor; mask-composite: exclude;
          opacity: 0; transition: opacity .5s ease; pointer-events: none;
        }
        .ccm-fleet-card:hover {
          background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03));
          border-color: rgba(147,197,253,0.25);
          box-shadow: 0 30px 60px -25px rgba(59,130,246,0.55);
        }
        .ccm-fleet-card:hover::before { opacity: 1; }
        .ccm-fleet-icon {
          background: linear-gradient(135deg, rgba(59,130,246,0.30), rgba(56,189,248,0.14));
          border: 1px solid rgba(147,197,253,0.35);
          color: #dbeafe;
          box-shadow: 0 0 22px -6px rgba(59,130,246,0.55), inset 0 0 12px rgba(255,255,255,0.06);
        }
        .ccm-fleet-corner {
          position: absolute; top: 10px; right: 10px; width: 18px; height: 18px;
          border-top: 1px solid rgba(231,199,106,0.5);
          border-right: 1px solid rgba(231,199,106,0.5);
          opacity: 0.55;
        }

        /* ---------- KPI ---------- */
        .ccm-kpi {
          background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
          border: 1px solid rgba(255,255,255,0.09);
          backdrop-filter: blur(14px);
          position: relative;
        }
        .ccm-kpi::after {
          content: ""; position: absolute; inset: auto 20% -1px 20%; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(231,199,106,0.6), transparent);
        }
        .ccm-kpi-value {
          background: linear-gradient(90deg, #e7c76a, #fff2c2, #d4af37);
          -webkit-background-clip: text; background-clip: text; color: transparent;
          text-shadow: 0 0 30px rgba(231,199,106,0.25);
        }

        /* ---------- CTA ---------- */
        .ccm-btn-primary {
          color: #0b1026;
          background: linear-gradient(90deg, #e7c76a, #d4af37, #e7c76a);
          background-size: 200% 100%;
          border: 1px solid rgba(212,175,55,0.55);
          box-shadow:
            0 18px 40px -12px rgba(231,199,106,0.55),
            0 0 0 1px rgba(255,255,255,0.6) inset;
          position: relative; overflow: hidden;
        }
        .ccm-btn-primary::after {
          content: ""; position: absolute; inset: -1px; border-radius: inherit;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent);
          transform: translateX(-120%); transition: transform .8s ease;
        }
        .ccm-btn-primary:hover { background-position: 100% 0; transform: translateY(-1px); }
        .ccm-btn-primary:hover::after { transform: translateX(120%); }
        .ccm-btn-ghost {
          background: #fff; color: #0b1026;
          border: 1px solid rgba(11,16,38,0.15);
        }
        .ccm-btn-ghost:hover {
          background: #0b1026; color: #e7c76a; border-color: #0b1026;
          box-shadow: 0 18px 40px -14px rgba(11,16,38,0.5);
          transform: translateY(-1px);
        }

        /* ---------- RÉASSURANCE ---------- */
        .ccm-reass {
          background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015));
          border: 1px solid rgba(255,255,255,0.09);
          backdrop-filter: blur(12px);
        }
        .ccm-reass:hover {
          border-color: rgba(231,199,106,0.45);
          background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
          box-shadow: 0 22px 45px -22px rgba(59,130,246,0.4);
        }
        .ccm-reass-icon {
          background: radial-gradient(circle at 30% 30%, rgba(231,199,106,0.25), rgba(231,199,106,0.05));
          border: 1px solid rgba(231,199,106,0.45);
          color: #e7c76a;
          box-shadow: 0 0 18px -4px rgba(231,199,106,0.4);
        }

        @media (prefers-reduced-motion: reduce) {
          .ccm-reveal, li[data-reveal] { opacity: 1 !important; transform: none !important; transition: none !important; }
          .ccm-aurora, .ccm-scanline, .ccm-title-accent { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
