import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, CalendarDays, Euro, Lock, Timer, Truck } from "lucide-react";
import { computePilotage, euro, STATUS_META, type ProMission } from "@/hooks/useProMissions";

export const Route = createFileRoute("/demo-pro")({
  head: () => ({
    meta: [
      { title: "Démonstration de l'espace professionnel — Transports Ligneo" },
      {
        name: "description",
        content:
          "Découvrez l'espace professionnel Transports Ligneo avec des données d'exemple : indicateurs, missions en cours et suivi des dépenses.",
      },
      { property: "og:title", content: "Démonstration de l'espace professionnel — Transports Ligneo" },
      {
        property: "og:description",
        content: "Un aperçu réaliste de l'espace pro Ligneo, avec des missions fictives, sans créer de compte.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DemoProPage,
});

const now = new Date();
const iso = (offsetDays: number) => {
  const d = new Date(now.getTime() + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
};
const ts = (offsetDays: number) => new Date(now.getTime() + offsetDays * 86400000).toISOString();

/** Missions fictives : aucune donnée réelle n'est affichée sur cette page. */
const DEMO_MISSIONS: ProMission[] = [
  { id: "d1", numero: "MIS-TLG-2026-301", ville_depart: "Tours", ville_arrivee: "Lyon", date_prise_en_charge: iso(-1), heure_prise_en_charge: "08:30", statut: "en_cours", prix_total: 420, created_at: ts(-6), updated_at: ts(-1), immatriculation: "GH-214-KL", marque: "Peugeot", modele: "3008", site_id: null },
  { id: "d2", numero: "MIS-TLG-2026-302", ville_depart: "Paris", ville_arrivee: "Tours", date_prise_en_charge: iso(0), heure_prise_en_charge: "14:00", statut: "en_cours", prix_total: 201, created_at: ts(-4), updated_at: ts(0), immatriculation: "AB-802-TR", marque: "Renault", modele: "Clio V", site_id: null },
  { id: "d3", numero: "MIS-TLG-2026-298", ville_depart: "Tours", ville_arrivee: "Bordeaux", date_prise_en_charge: iso(-3), heure_prise_en_charge: null, statut: "en_attente", prix_total: 340, created_at: ts(-5), updated_at: ts(-3), immatriculation: "FK-559-MD", marque: "Citroën", modele: "C5 Aircross", site_id: null },
  { id: "d4", numero: "MIS-TLG-2026-287", ville_depart: "Le Mans", ville_arrivee: "Tours", date_prise_en_charge: iso(-12), heure_prise_en_charge: "09:00", statut: "livree", prix_total: 120, created_at: ts(-14), updated_at: ts(-12), immatriculation: "DL-330-QP", marque: "Volkswagen", modele: "Golf 8", site_id: null },
  { id: "d5", numero: "MIS-TLG-2026-281", ville_depart: "Tours", ville_arrivee: "Nantes", date_prise_en_charge: iso(-20), heure_prise_en_charge: "10:15", statut: "livree", prix_total: 230, created_at: ts(-22), updated_at: ts(-19), immatriculation: "EM-417-ZB", marque: "Audi", modele: "A3", site_id: null },
  { id: "d6", numero: "MIS-TLG-2026-270", ville_depart: "Orléans", ville_arrivee: "Tours", date_prise_en_charge: iso(-40), heure_prise_en_charge: null, statut: "livree", prix_total: 150, created_at: ts(-42), updated_at: ts(-39), immatriculation: "CV-908-HJ", marque: "BMW", modele: "Série 1", site_id: null },
  { id: "d7", numero: "MIS-TLG-2026-265", ville_depart: "Tours", ville_arrivee: "Rennes", date_prise_en_charge: iso(-45), heure_prise_en_charge: "07:45", statut: "livree", prix_total: 260, created_at: ts(-47), updated_at: ts(-44), immatriculation: "BT-671-XW", marque: "Mercedes", modele: "Classe A", site_id: null },
];

function DemoProPage() {
  const k = computePilotage(DEMO_MISSIONS, now);
  const delta = k.lastMonth > 0 ? Math.round(((k.thisMonth - k.lastMonth) / k.lastMonth) * 100) : null;
  const sorted = [...DEMO_MISSIONS].sort((a, b) => b.date_prise_en_charge.localeCompare(a.date_prise_en_charge));

  return (
    <main className="demo-pro">
      <div className="demo-pro-banner">
        <Lock size={14} aria-hidden />
        <span>
          <strong>Mode démonstration</strong> — données fictives, lecture seule.{" "}
          <Link to="/auth">Créer mon compte professionnel</Link>
        </span>
      </div>

      <header className="demo-pro-head">
        <p className="demo-pro-eyebrow">Espace professionnel</p>
        <h1>Votre flotte, pilotée en un coup d'œil</h1>
        <p className="demo-pro-sub">
          Voici exactement ce que voient nos clients professionnels : indicateurs en temps réel, missions en cours et
          suivi des dépenses.
        </p>
      </header>

      <section className="pp-pilot" aria-label="Pilotage">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="pp-kpi">
            <Truck size={18} className="pp-kpi-ico" />
            <span className="pp-kpi-val">{k.inTransit}</span>
            <span className="pp-kpi-lbl">Véhicules en convoyage</span>
          </div>
          <div className={`pp-kpi ${k.late > 0 ? "pp-kpi-alert" : ""}`}>
            <AlertTriangle size={18} className="pp-kpi-ico" />
            <span className="pp-kpi-val">{k.late}</span>
            <span className="pp-kpi-lbl">Missions à surveiller</span>
          </div>
          <div className="pp-kpi">
            <Euro size={18} className="pp-kpi-ico" />
            <span className="pp-kpi-val">{euro(k.thisMonth)}</span>
            <span className="pp-kpi-lbl">
              Dépenses du mois
              {delta !== null && (
                <em className={delta > 0 ? "pp-up" : "pp-down"}>
                  {" "}
                  {delta > 0 ? "+" : ""}
                  {delta} % vs mois dernier
                </em>
              )}
            </span>
          </div>
          <div className="pp-kpi">
            <Timer size={18} className="pp-kpi-ico" />
            <span className="pp-kpi-val">{k.punctuality === null ? "—" : `${k.punctuality} %`}</span>
            <span className="pp-kpi-lbl">Délais respectés (30 j)</span>
          </div>
        </div>
      </section>

      <section aria-label="Missions d'exemple" className="demo-pro-list">
        <h2>
          <CalendarDays size={16} aria-hidden /> Missions récentes
        </h2>
        <ul>
          {sorted.map((m) => {
            const st = STATUS_META[m.statut] ?? { label: m.statut, cls: "pp-st-wait" };
            return (
              <li key={m.id} className="demo-pro-mission">
                <div className="demo-pro-mission-main">
                  <strong>
                    {m.ville_depart} → {m.ville_arrivee}
                  </strong>
                  <span>
                    {m.marque} {m.modele} · {m.immatriculation}
                  </span>
                </div>
                <div className="demo-pro-mission-meta">
                  <span className={`pp-st ${st.cls}`}>{st.label}</span>
                  <span className="demo-pro-mission-price">{euro(m.prix_total)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="demo-pro-cta">
        <p>Envie de piloter vos propres véhicules comme ceci ?</p>
        <Link to="/auth" className="btn-onyx">
          Créer mon compte professionnel
        </Link>
      </div>
    </main>
  );
}
