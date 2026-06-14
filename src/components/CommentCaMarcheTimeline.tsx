import { Link } from "@tanstack/react-router";
import {
  UserPlus,
  Calculator,
  FileText,
  PenLine,
  Inbox,
  ShieldCheck,
  UserCheck,
  MapPin,
  Car,
  ClipboardCheck,
  Receipt,
  CheckCircle,
  Clock,
  ArrowRight,
} from "lucide-react";

const steps = [
  { icon: UserPlus, n: "01", title: "Création de compte client", desc: "Inscription en moins d'une minute. Espace personnel sécurisé avec accès à vos devis, factures, missions et documents." },
  { icon: Calculator, n: "02", title: "Commande via estimateur", desc: "Saisie du départ, de l'arrivée, du véhicule (recherche par plaque possible) et de la date. Tarif clair en 3 secondes." },
  { icon: FileText, n: "03", title: "Génération automatique du devis", desc: "Devis horodaté, numéroté, transmis instantanément par email et disponible dans votre espace client." },
  { icon: PenLine, n: "04", title: "Signature électronique du devis", desc: "Signature en ligne à valeur probante. Étape obligatoire avant la mise en production de votre mission." },
  { icon: Inbox, n: "05", title: "Réception du devis côté admin", desc: "Notre équipe reçoit le devis signé directement dans le dashboard administratif avec toutes les pièces jointes." },
  { icon: ShieldCheck, n: "06", title: "Validation admin", desc: "Contrôle de cohérence, vérification des contraintes et validation finale par notre service exploitation." },
  { icon: UserCheck, n: "07", title: "Attribution convoyeur", desc: "Affectation à un convoyeur certifié selon zone, disponibilité et notation. Notification immédiate au chauffeur." },
  { icon: MapPin, n: "08", title: "Suivi GPS en temps réel", desc: "Vous suivez le véhicule en direct depuis votre espace client : position, ETA, étapes franchies." },
  { icon: Car, n: "09", title: "Livraison du véhicule", desc: "Convoyeur identifié, ponctualité contractuelle, communication directe avec le destinataire." },
  { icon: ClipboardCheck, n: "10", title: "État des lieux signé", desc: "EDL digitalisé entrée et sortie : photos 360°, kilométrage, niveau carburant, signature contradictoire." },
  { icon: Receipt, n: "11", title: "Facturation automatique", desc: "Facture générée automatiquement à la livraison, conforme et archivée dans votre espace." },
  { icon: CheckCircle, n: "12", title: "Devis & factures centralisés", desc: "Tout votre historique consultable en un clic : devis, signatures, EDL, factures, photos, GPS." },
];

export default function CommentCaMarcheTimeline() {
  return (
    <>
      {/* HERO */}
      <section
        className="relative overflow-hidden pt-28 pb-28 lg:pt-36 lg:pb-36"
        style={{ background: "linear-gradient(180deg, #0b1026 0%, #111a3d 100%)" }}
      >
        <div aria-hidden className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(60% 50% at 50% 0%, rgba(231,199,106,0.10), transparent 70%)" }} />
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#e7c76a]/40 bg-[#e7c76a]/[0.08] px-4 py-1.5 text-[10.5px] uppercase tracking-[0.28em] text-[#e7c76a] font-heading">
            Notre process
          </span>
          <h1 className="font-heading text-4xl lg:text-6xl tracking-wide text-cream mt-6 leading-[1.1]">
            Comment <span className="gold-gradient-text">ça marche</span>
          </h1>
          <p className="text-cream/70 mt-6 text-base lg:text-lg leading-relaxed">
            De la création de compte à la facture : 12 étapes claires, traçables et 100% digitalisées.
          </p>
        </div>

        <div aria-hidden className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ height: "120px" }}>
          <svg viewBox="0 0 1440 120" preserveAspectRatio="none" className="w-full h-full block">
            <path d="M0,80 C320,20 760,5 1080,30 C1240,42 1360,70 1440,55 L1440,120 L0,120 Z"
              fill="var(--surface-cream, #faf7ef)" />
          </svg>
        </div>
      </section>

      {/* TIMELINE */}
      <section className="py-20 lg:py-24" style={{ background: "var(--surface-cream, #faf7ef)" }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="relative">
            <div
              className="absolute left-6 md:left-1/2 top-2 bottom-2 w-px bg-gradient-to-b from-[#e7c76a]/30 via-[#d4af37]/50 to-[#e7c76a]/30"
              aria-hidden
            />

            <div className="space-y-10 md:space-y-14">
              {steps.map((step, i) => {
                const Icon = step.icon;
                const isLeft = i % 2 === 0;
                return (
                  <div key={i} className="relative md:grid md:grid-cols-2 md:gap-14 items-center">
                    <div className="absolute left-6 md:left-1/2 -translate-x-1/2 z-10">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#e7c76a] to-[#d4af37] flex items-center justify-center shadow-[0_10px_30px_-8px_rgba(231,199,106,0.6)]">
                        <Icon className="text-[#0b1026]" size={22} strokeWidth={2.2} />
                      </div>
                    </div>

                    <div
                      className={`pl-24 md:pl-0 ${
                        isLeft ? "md:pr-14 md:text-right" : "md:col-start-2 md:pl-14"
                      }`}
                    >
                      <div className="card-premium-light p-7 lg:p-8 inline-block w-full">
                        <p className="font-heading text-[#b8860b] text-[10.5px] tracking-[0.3em] uppercase mb-2">
                          Étape {step.n}
                        </p>
                        <h2 className="font-heading text-xl lg:text-[24px] text-[#0b1026] tracking-wide mb-3">
                          {step.title}
                        </h2>
                        <p className="text-[#0b1026]/70 text-[14px] leading-relaxed">
                          {step.desc}
                        </p>
                      </div>
                    </div>

                    <div className={isLeft ? "hidden md:block md:col-start-2" : "hidden md:block md:col-start-1 md:row-start-1"} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Réassurance + CTA */}
      <section
        className="relative py-20 lg:py-24"
        style={{ background: "linear-gradient(180deg, #0b1026 0%, #111a3d 100%)" }}
      >
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e7c76a]/40 to-transparent" />
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid sm:grid-cols-3 gap-5 mb-12">
            {[
              { icon: ShieldCheck, label: "Assurance incluse" },
              { icon: Clock, label: "Disponible 7j/7" },
              { icon: CheckCircle, label: "0 annulation" },
            ].map((r, i) => (
              <div
                key={i}
                className="group p-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm text-center hover:border-[#e7c76a]/40 transition-all duration-500"
              >
                <div className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#e7c76a]/40 bg-[#e7c76a]/10 text-[#e7c76a]">
                  <r.icon size={20} />
                </div>
                <p className="text-cream/85 text-[11.5px] font-heading tracking-[0.22em] uppercase">{r.label}</p>
              </div>
            ))}
          </div>

          <div className="text-center">
            <p className="text-cream/80 text-lg lg:text-xl font-heading mb-6">
              Prêt à confier votre véhicule ?
            </p>
            <Link
              to="/tarifs"
              className="inline-flex items-center justify-center gap-2.5 px-10 py-4 rounded-xl bg-gradient-to-r from-[#e7c76a] via-[#d4af37] to-[#e7c76a] bg-[length:200%_100%] hover:bg-[position:100%_0] text-[#0b1026] font-heading text-[12px] tracking-[0.24em] uppercase shadow-[0_15px_40px_-10px_rgba(231,199,106,0.7)] transition-all duration-300"
            >
              Estimer mon trajet <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
