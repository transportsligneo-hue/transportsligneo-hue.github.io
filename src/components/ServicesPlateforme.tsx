import { useState } from "react";
import {
  FileText, MousePointerClick, Layers, CalendarClock, Repeat, Users, Star, BadgeEuro,
  MapPin, Bell, History, LineChart, UserCheck, BellRing,
  Camera, PenLine, FolderCheck, ScanLine, ShieldCheck, Search, AlertTriangle,
  LayoutDashboard, Building2, Receipt, Headphones, PhoneCall,
  Bot, Code2, Wrench, Calculator, IdCard, Hash, ChevronDown,
} from "lucide-react";

type Feat = { Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; label: string };


const CATS: { title: string; items: Feat[] }[] = [
  {
    title: "Réservation & devis",
    items: [
      { Icon: FileText, label: "Devis instantané" },
      { Icon: MousePointerClick, label: "Commande en 2 clics" },
      { Icon: Layers, label: "Missions groupées (flotte)" },
      { Icon: CalendarClock, label: "Planification à l'avance" },
      { Icon: Repeat, label: "Livraison simple / + restitution" },
      { Icon: Users, label: "Multi-comptes (Perso/Pro/Flotte)" },
      { Icon: Star, label: "Adresses favorites" },
      { Icon: BadgeEuro, label: "Tarifs transparents" },
      { Icon: Hash, label: "Numéro de commande (PO) archivé" },
    ],
  },

  {
    title: "Suivi & traçabilité",
    items: [
      { Icon: MapPin, label: "Suivi GPS en direct" },
      { Icon: Bell, label: "Notifications en temps réel" },
      { Icon: History, label: "Historique complet des missions" },
      { Icon: LineChart, label: "Rapports & exports en direct" },
      { Icon: UserCheck, label: "Convoyeur dédié" },
      { Icon: BellRing, label: "Notification à chaque étape" },
    ],
  },
  {
    title: "Documents & sécurité",
    items: [
      { Icon: Camera, label: "État des lieux photo 360°" },
      { Icon: PenLine, label: "Signature électronique" },
      { Icon: FolderCheck, label: "Devis & factures archivés" },
      { Icon: ScanLine, label: "Scan de documents" },
      { Icon: ShieldCheck, label: "Assurance tous risques incluse" },
      { Icon: Search, label: "Recherche par plaque" },
      { Icon: AlertTriangle, label: "Identification des dégâts" },
    ],
  },
  {
    title: "Gestion de compte",
    items: [
      { Icon: LayoutDashboard, label: "Tableau de bord dédié" },
      { Icon: Building2, label: "Accès par site (flotte)" },
      { Icon: Receipt, label: "Facturation consolidée" },
      { Icon: Headphones, label: "Support dédié 7j/7" },
      { Icon: PhoneCall, label: "Joignable rapidement" },
      { Icon: IdCard, label: "Gestion des conducteurs par flotte" },
    ],
  },
  {
    title: "Gestion de parc & pilotage",
    items: [
      { Icon: Wrench, label: "Gestion de parc avec alertes (CT, entretien, documents)" },
      { Icon: Calculator, label: "TCO par véhicule" },
      { Icon: LineChart, label: "Suivi des coûts et des mouvements" },
    ],
  },
  {
    title: "Intelligence & intégrations",
    items: [
      { Icon: Bot, label: "Vroomy, l'assistant IA Ligneo 24/7 (devis, suivi, missions)" },
      { Icon: Code2, label: "API développeurs" },
    ],
  },

];

export default function ServicesPlateforme() {
  const [open, setOpen] = useState(false);
  const total = CATS.reduce((n, c) => n + c.items.length, 0);

  return (
    <div className="r4-page" style={{ minHeight: 0 }}>
      <section className="plateforme-section">
        <div className="plateforme-head">
          <div className="v4-hero-eyebrow" style={{ justifyContent: "center", width: "100%" }}>
            <span className="dot" />Notre plateforme
          </div>
          <h2>Des dizaines de fonctionnalités pour un convoyage <span className="v4-accent">sans effort</span></h2>
          <p>Réservation, suivi, documents, comptabilité : tout est centralisé dans votre espace Transports Ligneo.</p>
        </div>

        <button
          type="button"
          className={`feat-toggle${open ? " is-open" : ""}`}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="plateforme-features"
        >
          <span className="feat-toggle-label">
            {open ? "Réduire les fonctionnalités" : "Déplier toutes les fonctionnalités"}
            <span className="feat-toggle-count">{total}</span>
          </span>
          <span className="feat-toggle-chevron" aria-hidden="true">
            <ChevronDown size={18} strokeWidth={2.4} />
          </span>
        </button>

        <div
          id="plateforme-features"
          className={`feat-collapse${open ? " is-open" : ""}`}
          hidden={!open}
        >
          {CATS.map((cat) => (
            <div key={cat.title} className="feat-category">
              <div className="feat-cat-title">{cat.title}</div>
              <div className="feat-grid2">
                {cat.items.map(({ Icon, label }) => (
                  <div key={label} className="feat-item">
                    <div className="feat-item-ic"><Icon size={17} strokeWidth={2} /></div>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
