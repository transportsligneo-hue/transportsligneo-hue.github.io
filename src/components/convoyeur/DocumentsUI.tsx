/**
 * Page « Mes documents » du convoyeur : composants d'affichage (sans logique serveur).
 * Charte appli Driver : bleu nuit + vert, grandes cartes arrondies, boutons larges et lisibles.
 */
import { useState, type ReactNode } from "react";
import {
  Plus, Trash2, AlertCircle, Camera, CheckCircle2, ChevronDown, Clock, Download, Eye, FileText, Loader2,
  RotateCcw, ShieldCheck, Upload, User as UserIcon, PenLine, XCircle,
} from "lucide-react";


/* ------------------------------ Avancement ------------------------------ */
const INK = "#08243f";
const MUT = "#5d7a72";
const LINE = "rgba(8,90,60,.13)";
const CARD = "rounded-[20px] border bg-white shadow-[0_10px_26px_-18px_rgba(8,90,60,.35)]";
const GREEN_BTN = "linear-gradient(135deg,#14B866,#4FE8A0)";

export function ProgressHero({ done, total, items = [] }: { done: number; total: number; items?: Array<{ label: string; status: "approved" | "pending" | "refused" | "none"; required: boolean }> }) {
  const complete = total > 0 && done >= total;
  const C = 176;
  const off = C - (C * Math.min(done, Math.max(total, 1))) / Math.max(total, 1);
  const todo = items.filter((i) => i.required && i.status !== "approved");
  return (
    <div className={CARD + " flex items-center gap-3.5 p-4"} style={{ borderColor: LINE }}>
      <div className="relative h-[66px] w-[66px] shrink-0">
        <svg width="66" height="66" viewBox="0 0 66 66" style={{ transform: "rotate(-90deg)" }} aria-hidden>
          <defs><linearGradient id="docRing" x1="0" x2="1"><stop stopColor="#14B866" /><stop offset="1" stopColor="#4FE8A0" /></linearGradient></defs>
          <circle cx="33" cy="33" r="28" fill="none" stroke="#e3f1ea" strokeWidth="7" />
          <circle cx="33" cy="33" r="28" fill="none" stroke="url(#docRing)" strokeWidth="7" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={off} />
        </svg>
        <b className="absolute inset-0 grid place-items-center text-[17px] font-extrabold" style={{ color: INK }}>{done}/{total}</b>
      </div>
      <div className="min-w-0">
        <h2 className="text-[15px] font-bold leading-tight" style={{ color: INK }}>{complete ? "Dossier complet" : "Dossier à compléter"}</h2>
        <p className="mt-0.5 text-[12px] leading-snug" style={{ color: MUT }}>
          {complete ? "Tous vos documents sont validés. Vous pouvez recevoir des missions." : `Il vous reste ${total - done} document${total - done > 1 ? "s" : ""} à faire valider pour recevoir des missions.`}
        </p>
        {todo.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {todo.map((t) => <span key={t.label} className="rounded-full bg-[#fff1d6] px-2.5 py-0.5 text-[10.5px] font-bold text-[#c27a00]">{t.label}</span>)}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ Contrat ------------------------------ */
export function ContratCardView(p: {
  signed: boolean; signedAt: string | null; blocked: boolean; expired: boolean; missing: string[];
  busy: boolean; onSign: () => void; onDownload: (w: "signed" | "dossier") => void;
}) {
  const title = p.signed ? "Contrat signé" : "Contrat de partenariat";
  const sub = p.signed ? `Le ${p.signedAt ? new Date(p.signedAt).toLocaleDateString("fr-FR") : "—"}`
    : p.blocked ? `Déposez d'abord : ${p.missing.join(", ")}`
    : p.expired ? "Lien expiré, demandez-en un nouveau" : "À lire et signer";
  const btn = "inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-[12.5px] font-bold active:scale-[.98] disabled:opacity-60";
  return (
    <div className={CARD + " flex min-w-0 flex-1 basis-0 flex-col gap-2 p-3"} style={{ borderColor: LINE }}>
      <div className="flex items-center gap-2.5">
        <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[11px] text-[#04261a]" style={{ background: p.blocked ? "#fff1d6" : GREEN_BTN, color: p.blocked ? "#c27a00" : "#04261a" }}>
          {p.signed ? <ShieldCheck size={18} /> : p.blocked ? <AlertCircle size={18} /> : <PenLine size={18} />}
        </span>
        <div className="min-w-0">
          <b className="block text-[13px] leading-tight" style={{ color: INK }}>{title}</b>
          <small className="block text-[11px] leading-snug" style={{ color: MUT }}>{sub}</small>
        </div>
      </div>
      {p.signed ? (
        <div className="flex gap-1.5">
          <button type="button" onClick={() => p.onDownload("signed")} disabled={p.busy} className={btn + " text-[#04261a]"} style={{ background: GREEN_BTN }}>
            <Download size={15} /> Contrat
          </button>
          <button type="button" onClick={() => p.onDownload("dossier")} disabled={p.busy} className={btn + " border-[1.5px] bg-white text-[#0b7a45]"} style={{ borderColor: "rgba(20,184,102,.4)" }}>
            Preuve
          </button>
        </div>
      ) : !p.blocked ? (
        <button type="button" onClick={p.onSign} disabled={p.busy} className={btn + " text-[#04261a]"} style={{ background: GREEN_BTN }}>
          <PenLine size={15} /> {p.busy ? "Ouverture…" : "Signer"}
        </button>
      ) : null}
    </div>
  );
}

/* ------------------------------ Photo de profil ------------------------------ */
export function ProfileCardView({ avatarUrl, uploading, children }: { avatarUrl: string | null; uploading: boolean; children: ReactNode }) {
  return (
    <div className={CARD + " flex items-center gap-3 px-3.5 py-3"} style={{ borderColor: LINE }}>
      <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-[#e1f7ec] text-[#0b7a45]">
        {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : <UserIcon size={20} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-bold" style={{ color: INK }}>Photo de profil</p>
        <p className="text-[11px]" style={{ color: MUT }}>Visible par l'équipe et vos clients</p>
      </div>
      <label className="inline-flex min-h-[38px] shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border-[1.5px] bg-white px-3.5 text-[12.5px] font-bold text-[#0b7a45] active:scale-[.98]" style={{ borderColor: "rgba(20,184,102,.4)" }}>
        {uploading ? "Envoi…" : <><Camera size={14} /> Modifier</>}
        {children}
      </label>
    </div>
  );
}

/* ------------------------------ Rubrique repliable ------------------------------ */
export function CollapsibleSection({ title, count, warn, defaultOpen = true, children }: { title: string; count?: string | number; warn?: boolean; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex w-full items-center gap-2 px-1 py-1.5 text-left text-[11px] font-extrabold uppercase tracking-[.14em]" style={{ color: "#3b5c53" }}>
        <ChevronDown size={14} className={"transition-transform " + (open ? "" : "-rotate-90")} />
        {title}
        {count !== undefined && (
          <span className="ml-auto rounded-full border bg-white px-2.5 py-0.5 text-[11px] tracking-normal" style={{ borderColor: warn ? "#f1dca0" : LINE, color: warn ? "#c27a00" : "#0b7a45", background: warn ? "#fff7e6" : "#fff" }}>{count}</span>
        )}
      </button>
      {open && <div className={CARD + " mt-1 divide-y overflow-hidden"} style={{ borderColor: LINE }}>{children}</div>}
    </section>
  );
}

/* ------------------------------ Ligne d'un document (dépliable) ------------------------------ */
export type DocStatus = "approved" | "pending" | "refused" | "none";
export function DocCardView(p: {
  label: string; required: boolean; hint?: string;
  status: DocStatus; fileName?: string; dateLabel?: string; refusMotif?: string | null;
  renewal?: { tone: "ok" | "soon" | "expired"; text: string } | null;
  uploading: boolean;
  onPreview?: () => void;
  onDelete?: () => void;
  uploadLabels?: { add: string; replace: string };
  uploadInput: ReactNode;      // <input type="file" …> (à l'intérieur du label)
  scanButton: ReactNode;       // <DocScanButton className=… />
  scanClass: string;
}) {
  const [open, setOpen] = useState(false);
  const st = {
    approved: { tile: "#e1f7ec", fg: "#0b7a45", icon: CheckCircle2, label: "Approuvé" },
    pending: { tile: "#e6eeff", fg: "#2147c9", icon: Clock, label: "En validation" },
    refused: { tile: "#ffe4e9", fg: "#d92d4a", icon: XCircle, label: "Refusé" },
    none: { tile: "#f0f4f2", fg: "#5d7a72", icon: FileText, label: "À envoyer" },
  }[p.status];
  const Icon = st.icon;
  const has = p.status !== "none";
  const addRow = !!p.uploadLabels;
  const renewCls = p.renewal?.tone === "expired" ? "bg-[#ffe4e9] text-[#d92d4a]" : p.renewal?.tone === "soon" ? "bg-[#fff1d6] text-[#c27a00]" : "bg-[#e1f7ec] text-[#0b7a45]";
  const outBtn = "inline-flex min-h-[42px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border-[1.5px] bg-white px-2 text-[12.5px] font-bold text-[#0b7a45] active:scale-[.98]";
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 px-3.5 py-3 text-left">
        <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[11px]" style={{ background: st.tile, color: st.fg }}><Icon size={18} /></span>
        <span className="min-w-0 flex-1">
          <b className="block truncate text-[13.5px] leading-tight" style={{ color: INK }}>{p.label}</b>
          <small className="block truncate text-[11px]" style={{ color: MUT }}>{has && p.fileName ? `${p.fileName}${p.dateLabel ? ` · ${p.dateLabel}` : ""}` : addRow ? "Diplôme, attestation, justificatif…" : "Aucun fichier envoyé"}</small>
        </span>
        <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold" style={{ background: st.tile, color: st.fg }}>{addRow && !has ? "Ajouter" : st.label}</span>
        <ChevronDown size={16} className={"shrink-0 text-[#9bb0a8] transition-transform " + (open ? "rotate-180" : "")} />
      </button>
      {open && (
        <div className="px-3.5 pb-3.5 pl-[58px]">
          {p.hint && <p className="text-[11.5px] leading-snug" style={{ color: MUT }}>{p.hint}</p>}
          {p.renewal && <span className={"mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold " + renewCls}>{p.renewal.text}</span>}
          {p.status === "refused" && p.refusMotif && <p className="mt-1.5 text-[12px] font-semibold text-[#d92d4a]">Motif : {p.refusMotif}</p>}
          <div className="mt-2.5 flex gap-2">
            {p.onPreview && (
              <button type="button" onClick={p.onPreview} className={outBtn} style={{ borderColor: "rgba(20,184,102,.4)" }}><Eye size={15} /> Voir</button>
            )}
            <label className={has ? outBtn : "inline-flex min-h-[42px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-2 text-[12.5px] font-bold text-[#04261a] active:scale-[.98]"}
              style={has ? { borderColor: "rgba(20,184,102,.4)" } : { background: GREEN_BTN, boxShadow: "0 8px 18px -10px rgba(20,184,102,.8)" }}>
              {has ? <RotateCcw size={15} /> : <Upload size={15} />}
              {p.uploading ? "Envoi…" : has ? (p.uploadLabels?.replace ?? "Remplacer") : (p.uploadLabels?.add ?? "Envoyer")}
              {p.uploadInput}
            </label>
            <span className="contents">{p.scanButton}</span>
          </div>
          {p.onDelete && (
            <button type="button" onClick={p.onDelete} className="mt-2 text-xs font-bold text-[#d92d4a] underline underline-offset-2">Supprimer ce document</button>
          )}
        </div>
      )}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="px-1 pt-1 text-[11px] font-extrabold uppercase tracking-[.14em]" style={{ color: "#3b5c53" }}>{children}</h2>;
}

/* ------------------------------ Autres documents (plusieurs fichiers) ------------------------------ */
export function OtherDocsView(p: {
  items: Array<{ id: string; name: string; dateLabel: string; status: DocStatus; onPreview: () => void; onDelete: () => void }>;
  uploading: boolean;
  hint?: string;
  addInput: ReactNode;      // <input type="file" multiple …> dans le label
  scanButton: ReactNode;
}) {
  const badge = (st: DocStatus) =>
    st === "approved" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : st === "refused" ? "bg-red-50 text-red-700 ring-red-200" : "bg-sky-50 text-sky-700 ring-sky-200";
  const lab = (st: DocStatus) => (st === "approved" ? "Approuvé" : st === "refused" ? "Refusé" : "En attente");
  return (
    <div className="rounded-3xl border border-[#e3e8f2] bg-[#ffffff] p-4 shadow-[0_10px_30px_-22px_rgba(10,22,56,.45)]">
      <div className="flex items-start gap-3.5">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#eef3ff] text-[#2f5fff] ring-1 ring-[#d6e0ff]"><FileText size={22} /></span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15.5px] font-semibold leading-tight" style={{ color: INK }}>Autres documents</h3>
          <p className="mt-1 text-xs leading-snug text-[#6b7aa3]">{p.hint ?? "Ajoutez autant de documents que vous voulez : diplômes, attestations, contrats…"}</p>
        </div>
      </div>
      {p.items.length > 0 && (
        <ul className="mt-3 space-y-2">
          {p.items.map((it) => (
            <li key={it.id} className="flex items-center gap-2 rounded-2xl border border-[#e3e8f2] bg-[#f8faff] p-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-[#1c2c58]">{it.name}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-[#6b7aa3]">{it.dateLabel}
                  <span className={"rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1 " + badge(it.status)}>{lab(it.status)}</span></p>
              </div>
              <button type="button" onClick={it.onPreview} aria-label="Voir" className="grid h-10 w-10 place-items-center rounded-xl border border-[#d7dff0] bg-[#ffffff] text-[#2a3a66]"><Eye size={16} /></button>
              <button type="button" onClick={it.onDelete} aria-label="Supprimer" className="grid h-10 w-10 place-items-center rounded-xl border border-red-200 bg-[#ffffff] text-red-600"><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <label className="inline-flex min-h-[46px] cursor-pointer items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-3 text-sm font-semibold text-white shadow-[0_10px_22px_-12px_rgba(5,150,105,.9)] active:scale-[.98]">
          {p.uploading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Ajouter
          {p.addInput}
        </label>
        {p.scanButton}
      </div>
    </div>
  );
}
