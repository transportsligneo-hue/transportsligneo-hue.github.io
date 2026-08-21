import { Link } from "@tanstack/react-router";
import {
  Truck, Users, ArrowRight, CheckCircle2, Zap, FileText, BarChart3,
  Building2, Warehouse, Clock, LayoutDashboard, Calendar, MapPin,
} from "lucide-react";
import ProTimeline from "@/components/services/ProTimeline";

const audiences = [
  { Icon: Building2, title: "Concessions", desc: "Transferts inter-sites, livraisons clients, restitutions : gagnez du temps sur vos flux quotidiens." },
  { Icon: Truck, title: "Loueurs", desc: "Repositionnement de véhicules entre agences, restitution en fin de contrat, gestion de pics saisonniers." },
  { Icon: Clock, title: "Gestionnaires de flotte", desc: "Pilotage complet du parc : missions groupées, planification récurrente, reporting par site." },
];

const features = [
  { Icon: LayoutDashboard, title: "Tableau de bord dédié", desc: "Vue d'ensemble de vos missions en cours, terminées et à venir, en temps réel." },
  { Icon: Calendar, title: "Missions groupées", desc: "Déplacez plusieurs véhicules de votre parc en une seule commande planifiée." },
  { Icon: Users, title: "Utilisateurs & sites", desc: "Gérez les accès par site : chaque responsable ne voit que son périmètre." },
  { Icon: BarChart3, title: "Reporting détaillé", desc: "Coûts, délais et volumes par site, exportables en un clic." },
  { Icon: MapPin, title: "Suivi temps réel", desc: "Position GPS, statut et ETA pour chaque mission, accessibles à tout moment." },
  { Icon: FileText, title: "Documents centralisés", desc: "Devis, factures, états des lieux et signatures, tous archivés au même endroit." },
];

/** Bloc « Professionnels » de la page Services — accent violet néon électrique. */
export default function ProSegment() {
  return (
    <div className="pro-seg">
      {/* HERO split */}
      <div className="v4-b2b-hero">
        <div>
          <div className="v4-hero-eyebrow v"><span className="dot" />Solutions professionnelles</div>
          <h1>Le convoyage à l'échelle de <span className="v4-accent v">votre flotte</span>.</h1>
          <p>Concessions, loueurs, gestionnaires de parc : une plateforme dédiée pour piloter vos convoyages, votre facturation et vos équipes depuis un seul espace.</p>
          <div className="v4-hero-actions">
            <Link to="/contact" className="v4-btn-primary v">Devenir partenaire</Link>
            <Link to="/contact" className="v4-btn-outline v">Parler à un conseiller</Link>
          </div>
        </div>
        <div className="v4-hero-panel">
          <div className="v4-row">
            <div className="v4-row-ic v"><Warehouse size={17} /></div>
            <div className="v4-row-text"><div className="t">Gestion de flotte centralisée</div><div className="s">Tous vos véhicules, un seul tableau de bord</div></div>
          </div>
          <div className="v4-row">
            <div className="v4-row-ic v"><FileText size={17} /></div>
            <div className="v4-row-text"><div className="t">Facturation consolidée</div><div className="s">Une facture mensuelle, par site</div></div>
          </div>
          <div className="v4-row">
            <div className="v4-row-ic v"><Users size={17} /></div>
            <div className="v4-row-text"><div className="t">Interlocuteur dédié</div><div className="s">Un contact unique, joignable 7j/7</div></div>
          </div>
          <div className="v4-row">
            <div className="v4-row-ic v"><Zap size={17} /></div>
            <div className="v4-row-text"><div className="t">Tarifs préférentiels</div><div className="s">Selon volume et récurrence</div></div>
          </div>
        </div>
      </div>

      {/* Pour qui */}
      <div className="v4-section">
        <div className="v4-section-head">
          <div className="v4-hero-eyebrow v" style={{ justifyContent: "center", width: "100%" }}>
            <span className="dot" />Pour qui ?
          </div>
          <h2>Une solution pour chaque professionnel</h2>
        </div>
        <div className="v4-audience-grid">
          {audiences.map(({ Icon, title, desc }) => (
            <div key={title} className="v4-aud-card">
              <div className="v4-aud-ic v"><Icon size={21} /></div>
              <h4>{title}</h4>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Fonctionnalités */}
      <div className="v4-section">
        <div className="v4-section-head">
          <div className="v4-hero-eyebrow v" style={{ justifyContent: "center", width: "100%" }}>
            <span className="dot" />Fonctionnalités
          </div>
          <h2>Une plateforme pensée pour les pros</h2>
        </div>
        <div className="v4-feat-grid">
          {features.map(({ Icon, title, desc }) => (
            <div key={title} className="v4-feat-card">
              <div className="v4-feat-ic v"><Icon size={19} /></div>
              <h4>{title}</h4>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <ProTimeline />

      {/* Deux solutions */}
      <div className="v4-section">
        <div className="v4-section-head">
          <div className="v4-hero-eyebrow v" style={{ justifyContent: "center", width: "100%" }}>
            <span className="dot" />Deux solutions
          </div>
          <h2>Choisissez votre formule</h2>
          <p>Transport ponctuel avec paiement en ligne, ou partenariat flotte sur-mesure pour grands comptes, concessions et loueurs.</p>
        </div>
        <div className="grid gap-7 lg:grid-cols-2">
          <article className="card-premium-light group relative flex flex-col overflow-hidden p-9 transition-all duration-500 hover:-translate-y-1">
            <div className="pro-card-topline" />
            <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-full border border-[#8b3ff5]/40 bg-[#8b3ff5]/10 text-[#8b3ff5]">
              <Truck className="h-6 w-6" />
            </div>
            <div className="mb-3 text-[10px] font-heading uppercase tracking-[0.28em] text-[#8b3ff5]">Solution 1</div>
            <h3 className="font-heading text-2xl lg:text-[26px] text-[#0b1026]">Transport ponctuel B2B</h3>
            <p className="mt-4 text-[#0b1026]/65 leading-relaxed">
              Pour garages, concessions et professionnels auto qui veulent commander une course rapidement avec paiement en ligne sécurisé.
            </p>
            <ul className="mt-7 space-y-3 text-[14px] text-[#0b1026]/80">
              {["Devis instantané avec estimateur", "Paiement en ligne sécurisé", "Confirmation immédiate", "Suivi opérationnel temps réel"].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#8b3ff5]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-9 flex-1" />
            <Link to="/b2b/transport-ponctuel" className="pro-btn-solid">
              Demander un transport
              <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="mt-4 text-center text-[11px] text-[#0b1026]/50 tracking-wide">Estimation et paiement en moins de 3 minutes</p>
          </article>

          <article className="card-premium-light group relative flex flex-col overflow-hidden p-9 transition-all duration-500 hover:-translate-y-1">
            <div className="pro-card-topline" />
            <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-full border border-[#8b3ff5]/40 bg-[#8b3ff5]/10 text-[#8b3ff5]">
              <Users className="h-6 w-6" />
            </div>
            <div className="mb-3 text-[10px] font-heading uppercase tracking-[0.28em] text-[#8b3ff5]">Solution 2</div>
            <h3 className="font-heading text-2xl lg:text-[26px] text-[#0b1026]">Partenariat flotte B2B</h3>
            <p className="mt-4 text-[#0b1026]/65 leading-relaxed">
              Pour entreprises, loueurs, concessions et grands comptes qui souhaitent une solution récurrente avec tarifs négociés.
            </p>
            <ul className="mt-7 space-y-3 text-[14px] text-[#0b1026]/80">
              {["Étude personnalisée gratuite", "Tarifs volumes négociés", "Account manager dédié", "Facturation centralisée mensuelle"].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#8b3ff5]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-9 flex-1" />
            <Link to="/b2b/partenariat-flotte" className="pro-btn-outline">
              Demander une étude flotte
              <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="mt-4 text-center text-[11px] text-[#0b1026]/50 tracking-wide">Réponse commerciale sous 24h ouvrées</p>
          </article>
        </div>
      </div>

      {/* CTA */}
      <div className="v4-cta-box v">
        <div className="v4-hero-eyebrow v" style={{ justifyContent: "center", width: "100%" }}>
          <span className="dot" />Devenir partenaire
        </div>
        <h2>Discutons de vos besoins de convoyage</h2>
        <p>Un conseiller dédié vous accompagne pour construire une offre adaptée à votre volume et à vos contraintes.</p>
        <Link to="/contact" className="v4-btn-primary v">Demander un rendez-vous</Link>
      </div>
    </div>
  );
}
