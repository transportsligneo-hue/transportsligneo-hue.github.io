import { CheckCircle2, Circle, FileText, X } from "lucide-react";
import { euro, STATUS_META, type ProMission } from "@/hooks/useProMissions";
import { DemoLiveMap } from "./DemoLiveMap";
import { downloadDemoPdf } from "./demo-pdf";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const STEPS = ["Commande validée", "Convoyeur assigné", "État des lieux départ", "En route", "État des lieux arrivée", "Livré et signé"];

export function DemoMissionDetail({ m, onClose }: { m: ProMission; onClose: () => void }) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function download(kind: string) {
    setDownloading(kind);
    setError(null);
    try { await downloadDemoPdf(kind, m); }
    catch { setError("Le document n'a pas pu être téléchargé. Réessayez dans un instant."); }
    finally { setDownloading(null); }
  }
  const done = m.statut === "livree" ? 6 : m.statut === "en_cours" ? 4 : 1;
  const st = STATUS_META[m.statut] ?? { label: m.statut, cls: "pp-st-wait" };
  return (
    <section className="dpm-card demo-detail" aria-label={`Mission ${m.numero}`}>
      <div className="demo-detail-head">
        <div>
          <p className="demo-pro-eyebrow">{m.numero}</p>
          <h3>{m.ville_depart} → {m.ville_arrivee}</h3>
          <span className="demo-detail-sub">{m.marque} {m.modele} · {m.immatriculation} · {euro(m.prix_total)}</span>
        </div>
        <div className="demo-detail-actions">
          <span className={`pp-st ${st.cls}`}>{st.label}</span>
          <button type="button" className="demo-detail-close" onClick={onClose} aria-label="Fermer"><X size={16} /></button>
        </div>
      </div>
      {m.statut === "en_cours" && <DemoLiveMap />}
      <ol className="demo-steps">
        {STEPS.map((s, i) => (
          <li key={s} className={i < done ? "is-done" : ""}>
            {i < done ? <CheckCircle2 size={15} /> : <Circle size={15} />} {s}
          </li>
        ))}
      </ol>
      <div className="demo-docs">
        {["Devis", "Bon de commande", "PV de livraison", "Facture"].map((d, i) => (
          <Button variant="outline" key={d} type="button" disabled={downloading !== null || (i > 1 && m.statut !== "livree")} title="Télécharger le PDF" onClick={() => download(d)}>
            <FileText size={14} /> {downloading === d ? "Téléchargement…" : d}
          </Button>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
