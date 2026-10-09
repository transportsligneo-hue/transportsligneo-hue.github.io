import { useState } from "react";
import {
  AlertTriangle, Camera, CheckCircle2, Download, FileSpreadsheet, LayoutDashboard,
  MapPin, Navigation, Shield, Users, CalendarDays, BarChart3,
} from "lucide-react";
import { euro, type ProMission } from "@/hooks/useProMissions";
import { DemoLiveMap } from "./DemoLiveMap";
import type { LiveMetricsSnapshot } from "@/components/map/types";

type Tab = "gps" | "cal" | "team";

const PHOTOS = [
  { zone: "Avant", dep: "RAS", arr: "RAS", alert: false },
  { zone: "Aile avant gauche", dep: "RAS", arr: "RAS", alert: false },
  { zone: "Porte arrière droite", dep: "RAS", arr: "Rayure 4 cm", alert: true },
  { zone: "Arrière", dep: "Micro-rayure pare-chocs", arr: "Micro-rayure pare-chocs", alert: false },
  { zone: "Jantes", dep: "RAS", arr: "RAS", alert: false },
  { zone: "Intérieur", dep: "RAS", arr: "RAS", alert: false },
];

const TEAM = [
  { nom: "Claire Martin", email: "c.martin@exemple.fr", role: "Administrateur", droits: "Tout gérer, inviter l'équipe" },
  { nom: "Julien Robert", email: "j.robert@exemple.fr", role: "Logistique", droits: "Créer et suivre les missions" },
  { nom: "Sophie Lambert", email: "s.lambert@exemple.fr", role: "Comptabilité", droits: "Factures, rapports, exports" },
];

export function DemoProModules({ missions, now }: { missions: ProMission[]; now: Date }) {
  const [tab, setTab] = useState<Tab>("gps");
  const [metrics, setMetrics] = useState<LiveMetricsSnapshot | null>(null);
  const live = missions.find((m) => m.statut === "en_cours") ?? missions[0];

  const y = now.getFullYear(), mo = now.getMonth();
  const first = new Date(y, mo, 1);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(y, mo + 1, 0).getDate();
  const byDay = new Map<number, ProMission[]>();
  missions.forEach((m) => {
    const d = new Date(m.date_prise_en_charge);
    if (d.getFullYear() === y && d.getMonth() === mo) byDay.set(d.getDate(), [...(byDay.get(d.getDate()) ?? []), m]);
  });
  const delivered = missions.filter((m) => m.statut === "livree");
  const total = delivered.reduce((s, m) => s + (m.prix_total ?? 0), 0);

  const exportCsv = () => {
    const rows = [["Numéro", "Date", "Départ", "Arrivée", "Véhicule", "Plaque", "Statut", "Montant TTC"],
      ...missions.map((m) => [m.numero, m.date_prise_en_charge, m.ville_depart, m.ville_arrivee, `${m.marque} ${m.modele}`, m.immatriculation, m.statut, String(m.prix_total)])];
    const csv = "\uFEFF" + rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "demo-ligneo-missions.csv"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const tabs: { id: Tab; label: string; Icon: typeof LayoutDashboard }[] = [
    { id: "gps", label: "Suivi GPS & photos", Icon: Navigation },
    { id: "cal", label: "Calendrier, rapports & export", Icon: CalendarDays },
    { id: "team", label: "Gestion d'équipe", Icon: Users },
  ];

  return (
    <section className="dpm" aria-label="Fonctionnalités de l'espace pro">
      <div className="dpm-tabs" role="tablist">
        {tabs.map(({ id, label, Icon }) => (
          <button key={id} role="tab" aria-selected={tab === id} className={`dpm-tab ${tab === id ? "is-on" : ""}`} onClick={() => setTab(id)}>
            <Icon size={15} aria-hidden /> {label}
          </button>
        ))}
      </div>

      {tab === "gps" && (
        <div className="dpm-grid">
          <div className="dpm-card">
            <h3><MapPin size={15} /> Suivi GPS en direct — Tours → Bordeaux</h3>
            <DemoLiveMap onMetrics={setMetrics} />
            <ul className="dpm-facts">
              <li><span>Véhicule</span><strong>{live.marque} {live.modele} · {live.immatriculation}</strong></li>
              <li><span>Progression</span><strong>{metrics ? `${Math.round(metrics.progress)} %` : "…"}</strong></li>
              <li><span>Arrivée estimée</span><strong>{metrics ? metrics.etaAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "…"}</strong></li>
            </ul>
          </div>
          <div className="dpm-card">
            <h3><Camera size={15} /> Comparaison photos départ / arrivée</h3>
            <div className="dpm-alert"><AlertTriangle size={15} /> 1 nouveau dégât détecté à l'arrivée</div>
            <table className="dpm-table">
              <thead><tr><th>Zone</th><th>Départ</th><th>Arrivée</th></tr></thead>
              <tbody>
                {PHOTOS.map((p) => (
                  <tr key={p.zone} className={p.alert ? "is-alert" : ""}>
                    <td>{p.zone}</td><td>{p.dep}</td>
                    <td>{p.alert ? <><AlertTriangle size={12} /> {p.arr}</> : <><CheckCircle2 size={12} /> {p.arr}</>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "cal" && (
        <div className="dpm-grid">
          <div className="dpm-card">
            <h3><CalendarDays size={15} /> {first.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</h3>
            <div className="dpm-cal">
              {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => <span key={i} className="dpm-cal-h">{d}</span>)}
              {Array.from({ length: offset }).map((_, i) => <span key={`e${i}`} />)}
              {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
                const ms = byDay.get(d) ?? [];
                return (
                  <span key={d} className={`dpm-cal-d ${d === now.getDate() ? "is-today" : ""}`}>
                    {d}
                    {ms.map((m) => <i key={m.id} className={`dpm-dot st-${m.statut}`} title={`${m.ville_depart} → ${m.ville_arrivee}`} />)}
                  </span>
                );
              })}
            </div>
          </div>
          <div className="dpm-card">
            <h3><BarChart3 size={15} /> Rapport — 60 derniers jours</h3>
            <ul className="dpm-facts">
              <li><span>Missions livrées</span><strong>{delivered.length}</strong></li>
              <li><span>Dépense totale</span><strong>{euro(total)}</strong></li>
              <li><span>Coût moyen</span><strong>{euro(delivered.length ? Math.round(total / delivered.length) : 0)}</strong></li>
              <li><span>Délai moyen</span><strong>2,1 jours</strong></li>
              <li><span>Trajet le plus fréquent</span><strong>Tours ↔ Le Mans</strong></li>
            </ul>
            <button type="button" className="dpm-btn" onClick={exportCsv}>
              <FileSpreadsheet size={15} /> Exporter pour la comptabilité (Excel) <Download size={14} />
            </button>
          </div>
        </div>
      )}

      {tab === "team" && (
        <div className="dpm-card">
          <h3><Shield size={15} /> Membres de l'équipe</h3>
          <ul className="dpm-team">
            {TEAM.map((t) => (
              <li key={t.email}>
                <div><strong>{t.nom}</strong><span>{t.email}</span></div>
                <div className="dpm-team-r"><em className={`dpm-role r-${t.role[0]}`}>{t.role}</em><span>{t.droits}</span></div>
              </li>
            ))}
          </ul>
          <button type="button" className="dpm-btn" disabled title="Désactivé en démonstration">
            <Users size={15} /> Inviter un membre par e-mail
          </button>
          <p className="dpm-note">En démonstration, les invitations sont désactivées.</p>
        </div>
      )}
    </section>
  );
}
