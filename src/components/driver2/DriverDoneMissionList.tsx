import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import "@/styles/driver-v2.css";
import { Ic, Plate } from "@/components/driver2/icons";
import { type MissionCardData } from "@/components/convoyeur/MissionCard";
import { MissionDocsOfficielsPanel } from "@/components/mission/MissionDocsOfficielsPanel";
import { displayNumero } from "@/lib/mission-number";

/** Ville seule : plus aucune adresse précise sur une mission terminée. */
const ville = (a?: string | null) => {
  if (!a) return "—";
  const parts = a.split(",").map((p) => p.trim()).filter(Boolean);
  const last = (parts.length >= 2 ? parts[parts.length - 1] : a).replace(/\b\d{5}\b/g, "").replace(/\s+/g, " ").trim();
  return last || "—";
};
const hhmm = (h?: string | null) => (h ? h.slice(0, 5).replace(":", "h") : "—");
const longDate = (d?: string | null) =>
  d ? new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "Date à confirmer";

function PvButton({ attributionId }: { attributionId: string }) {
  const [run, setRun] = useState(false);
  return (
    <>
      <button type="button" className="ddl-pv" disabled={run} onClick={() => setRun(true)}>
        {run ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
        Télécharger le PV de livraison
      </button>
      {run && <MissionDocsOfficielsPanel attributionId={attributionId} autoPv="livraison" onAutoDone={() => setRun(false)} />}
    </>
  );
}

/** Missions terminées : consultation seule (pas d'ouverture, pas de coordonnées), avec le PV de livraison. */
export function DriverDoneMissionList({ missions }: { missions: (MissionCardData & { leg_type?: string | null })[] }) {
  return (
    <div className="drv2"><div className="ddl">
      {missions.map((m) => {
        const t = m.trajet;
        const num = m.numero_mission ? displayNumero(m.numero_mission) : `MIS-${m.id.slice(0, 8).toUpperCase()}`;
        const veh = [t?.marque, t?.modele].filter(Boolean).join(" ");
        const liv = m.livraison_at ? new Date(m.livraison_at) : null;
        const livTxt = liv ? liv.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }).replace(":", "h") : "—";
        const livDate = liv && t?.date_trajet && liv.toISOString().slice(0, 10) !== t.date_trajet
          ? ` · ${liv.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}` : "";
        return (
          <article key={m.id} className="ddl-card">
            <header className="ddl-top">
              <span className="ddl-date">{longDate(t?.date_trajet)}</span>
              <span className="ddl-num">{num}</span>
            </header>
            <div className="ddl-times">
              <div><small>Enlèvement</small><b><Ic n="clock" s={14} sw={2.3} /> {hhmm(t?.heure_trajet)}</b></div>
              <div><small>Livraison</small><b><Ic n="clock" s={14} sw={2.3} /> {livTxt}{livDate}</b></div>
            </div>
            <p className="ddl-route">{ville(t?.depart)} <span>→</span> {ville(t?.arrivee)}</p>
            <div className="ddl-veh">
              {t?.immatriculation && <Plate p={t.immatriculation} />}
              {veh && <span>{veh}</span>}
            </div>
            <PvButton attributionId={m.id} />
          </article>
        );
      })}
    </div></div>
  );
}
