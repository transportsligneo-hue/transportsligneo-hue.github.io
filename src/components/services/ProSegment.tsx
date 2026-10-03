import { Link } from "@tanstack/react-router";
import {
  Truck, Users, ArrowRight, CheckCircle2, Zap, FileText, BarChart3,
  Building2, Warehouse, Clock, LayoutDashboard, Calendar, MapPin,
} from "lucide-react";
import ProTimeline, { ProFilm } from "@/components/services/ProTimeline";
import ServicesPlateforme from "@/components/ServicesPlateforme";

const audiences = [
  { Icon: Building2, title: "Concessions", desc: "Transferts inter-sites, livraisons clients, restitutions : gagnez du temps sur vos flux quotidiens." },
  { Icon: Truck, title: "Loueurs", desc: "Repositionnement de véhicules entre agences, restitution en fin de contrat, gestion de pics saisonniers." },
  { Icon: Clock, title: "Gestionnaires de flotte", desc: "Pilotage complet du parc : missions groupées, planification récurrente, reporting par site." },
];

const features = [
  { Icon: LayoutDashboard, title: "Tableau de bord dédié", desc: "Vue d'ensemble de vos missions en cours, terminées et à venir, en temps réel." },
  { Icon: Calendar, title: "Planifiez plusieurs convoyages en une seule opération.", desc: "Missions groupées : plusieurs véhicules de votre parc en une seule commande planifiée." },
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
            <div className="v4-row-text"><div className="t">Pilotez 50, 100 ou 500 véhicules depuis un seul espace.</div><div className="s">Gestion de flotte centralisée</div></div>
          </div>
          <div className="v4-row">
            <div className="v4-row-ic v"><FileText size={17} /></div>
            <div className="v4-row-text"><div className="t">Une seule facture pour l'ensemble de vos sites.</div><div className="s">Facturation consolidée</div></div>
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

      <ProFilm />

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
<h3>{title}</h3>
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
              <h3>{title}</h3>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <ProTimeline />

      {/* Formule B2B unifiée — deux voies, un seul interlocuteur, cap sur le contact */}
      <div className="v4-section">
        <div className="v4-section-head">
          <div className="v4-hero-eyebrow v" style={{ justifyContent: "center", width: "100%" }}>
            <span className="dot" />Formules B2B
          </div>
          <h2>Deux façons de travailler ensemble</h2>
          <p>Une course immédiate ou un partenariat sur-mesure : dans les deux cas, tout commence par un échange avec notre équipe.</p>
        </div>

        <div className="pro-formule-panel">
          <div className="pro-formule-top">
            <div className="pf-eyebrow">Comptes professionnels · Transports Ligneo</div>
            <h3>Un seul interlocuteur, quel que soit votre besoin.</h3>
          </div>

          <div className="pro-formule-grid">
            <div className="pf-voie">
              <div className="pf-voie-head">
                <div className="pf-ic"><Truck size={20} /></div>
                <span className="pf-chip">À la course</span>
              </div>
              <h4>Transport ponctuel</h4>
              <p>Pour garages, concessions et professionnels auto : commandez une course en quelques minutes.</p>
              <ul>
                {["Devis instantané avec estimateur", "Paiement en ligne sécurisé", "Confirmation immédiate", "Suivi opérationnel temps réel"].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#8b3ff5]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link to="/contact" search={{ audience: "pro", formule: "ponctuel" }} className="pf-btn solid">
                Commander un transport
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/b2b/transport-ponctuel" className="pf-more">
                Voir le détail de l'offre <ArrowRight size={13} />
              </Link>
            </div>

            <div className="pf-divider" aria-hidden="true"><span>ou</span></div>

            <div className="pf-voie">
              <div className="pf-voie-head">
                <div className="pf-ic"><Users size={20} /></div>
                <span className="pf-chip">Sur-mesure</span>
              </div>
              <h4>Partenariat flotte</h4>
              <p>Pour loueurs, concessions et grands comptes : une solution récurrente pensée pour votre parc.</p>
              <ul>
                {["Étude personnalisée gratuite", "Tarifs volumes négociés", "Account manager dédié", "Facturation centralisée mensuelle"].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#8b3ff5]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link to="/contact" search={{ audience: "pro", formule: "flotte" }} className="pf-btn outline">
                Demander une étude flotte
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/b2b/partenariat-flotte" className="pf-more">
                Voir le détail de l'offre <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          <div className="pro-formule-band">
            <div className="pf-band-text">
              <strong>Un conseiller dédié vous répond sous 24 h ouvrées.</strong>
              <span>Étude gratuite, tarifs préférentiels dès le premier échange.</span>
            </div>
            <Link to="/contact" search={{ audience: "pro" }} className="pf-band-btn">
              Échanger avec un conseiller
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>

      {/* Notre plateforme — fonctionnalités */}
      <ServicesPlateforme variant="pro" />

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
