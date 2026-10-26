import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Car, Check, Clock, Download, Euro, FileText, Folder, ParkingSquare, Plus } from "lucide-react";
import { SHORT, STEPS, MOTIFS, devisEnAttente, eur, isDone, saving, statusOf, type Dossier } from "@/lib/remarketing";
import "./remarketing-ui.css";

export const Ico = { Car, Check, Clock, Download, Euro, FileText, Folder, ParkingSquare, Plus };
const LOGO = "/icons/icon-192.png";

export function Hero({ eyebrow = "Ligneo Remarketing", title, accent, text, children }: { eyebrow?: string; title: string; accent: string; text: string; children?: ReactNode }) {
  return (
    <header className="hd">
      <div className="hl">
        <span className="lg"><img src={LOGO} alt="Transports Ligneo" /></span>
        <div>
          <div className="eb"><i />{eyebrow}</div>
          <h1>{title} <span>{accent}</span></h1>
          <p>{text}</p>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{children}</div>
    </header>
  );
}

export function Kpi({ icon, label, value, sub, tone }: { icon: ReactNode; label: string; value: ReactNode; sub?: string; tone?: "warn" | "ok" }) {
  return (
    <div className={`kpi${tone ? " " + tone : ""}`}>
      <span className="ic">{icon}</span>
      <small>{label}</small>
      <b>{value}</b>
      <em>{sub}</em>
    </div>
  );
}

export const Pill = ({ tone, children }: { tone: "b" | "w" | "k" | "x" | "n"; children: ReactNode }) => <span className={`pill ${tone}`}>{children}</span>;
export const StatusPill = ({ d }: { d: Dossier }) => { const s = statusOf(d); return <Pill tone={s.tone}>{s.label}</Pill>; };

export function Prog({ d }: { d: Dossier }) {
  return <div className="prog">{STEPS.map((_, i) => <i key={i} className={isDone(d) || i + 1 < d.etape ? "d" : i + 1 === d.etape ? "c" : ""} />)}</div>;
}

export function Tabs<T extends string>({ items, value, onChange }: { items: Array<[T, string, number?]>; value: T; onChange: (v: T) => void }) {
  return (
    <div className="tabs">
      {items.map(([k, label, n]) => (
        <button key={k} type="button" className={value === k ? "on" : ""} onClick={() => onChange(k)}>
          {label}{n != null && n > 0 ? <i>{n}</i> : null}
        </button>
      ))}
    </div>
  );
}

/** Tiroir latéral et fenêtre : rendus dans <body> pour éviter tout décalage du tableau de bord. */
export function Overlay({ open, onClose, children, kind }: { open: boolean; onClose: () => void; children: ReactNode; kind: "drawer" | "modal" }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="rmkx">
      <div className={`ov${open ? " on" : ""}`} onClick={onClose} />
      {kind === "drawer" ? <aside className={`dr${open ? " on" : ""}`}>{open ? children : null}</aside> : <div className={`mod${open ? " on" : ""}`}>{open ? children : null}</div>}
    </div>,
    document.body,
  );
}

export function VehicleTile() { return <span className="vt"><Car /></span>; }

export function Timeline({ d, sub }: { d: Dossier; sub: (i: number) => string }) {
  return (
    <ul className="tl">
      {STEPS.map((s, i) => {
        const c = isDone(d) || i + 1 < d.etape ? "d" : i + 1 === d.etape ? "c" : "";
        return (
          <li key={s} className={c}>
            <span className="n">{c === "d" ? "✓" : String(i + 1).padStart(2, "0")}</span>
            <div><b>{s}</b><small>{sub(i)}</small></div>
          </li>
        );
      })}
    </ul>
  );
}

export function DevisBlock({ d, actions }: { d: Dossier; actions?: ReactNode }) {
  if (!d.devis_statut) return null;
  const lines = d.devis_lignes?.length ? d.devis_lignes : d.dommages.map((x) => ({ label: x, montant: Math.round(Number(d.devis_ligneo ?? 0) / Math.max(1, d.dommages.length)) }));
  const pct = d.devis_classique ? Math.round((saving(d) / Number(d.devis_classique)) * 100) : 0;
  return (
    <div className="card">
      <h3>Devis {d.devis_statut === "en_attente" ? <Pill tone="w">En attente du client</Pill> : d.devis_statut === "valide" ? <Pill tone="k">Validé</Pill> : <Pill tone="x">Refusé</Pill>}</h3>
      <div className="cmp">
        <div><small>Remise en état classique</small><b>{eur(d.devis_classique)}</b></div>
        <div className="l"><small>Via Ligneo</small><b>{eur(d.devis_ligneo)}</b></div>
      </div>
      <div className="sav"><span>Économie chiffrée avec vous</span><span>{eur(saving(d))} · −{pct} %</span></div>
      <div style={{ marginTop: 12 }}>
        {lines.map((l, i) => <div className="ln" key={i}><span>{l.label}</span><span>{eur(l.montant)}</span></div>)}
        <div className="ln"><span>Trajets entre prestataires</span><span style={{ color: "var(--ok)" }}>À notre charge</span></div>
      </div>
      {actions}
    </div>
  );
}

export function StepBars({ d }: { d: Dossier }) {
  return (
    <div className="stp">
      {STEPS.map((_, i) => (
        <div key={i} className={isDone(d) || i + 1 < d.etape ? "d" : i + 1 === d.etape ? "c" : ""}><i />{SHORT[i]}</div>
      ))}
    </div>
  );
}

export const motifLabel = (m: string) => MOTIFS[m] ?? m;
export { devisEnAttente };
