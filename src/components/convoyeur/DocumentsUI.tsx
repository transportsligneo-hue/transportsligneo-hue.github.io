/**
 * Page « Mes documents » du convoyeur : composants d'affichage (sans logique serveur).
 * Charte appli Driver : bleu nuit + vert, grandes cartes arrondies, boutons larges et lisibles.
 */
import type { ReactNode } from "react";
import {
  Plus, Trash2, AlertCircle, Camera, CheckCircle2, Clock, Download, Eye, FileSignature, FileText, Loader2,
  RotateCcw, ShieldCheck, Upload, User as UserIcon, PenLine, BadgeCheck, XCircle,
} from "lucide-react";

const NAVY = "#0a1638";

/* ------------------------------ Avancement ------------------------------ */
export function ProgressHero({ done, total, items = [] }: { done: number; total: number; items?: Array<{ label: string; status: "approved" | "pending" | "refused" | "none"; required: boolean }> }) {
  const complete = total > 0 && done >= total;
  return (
    <div className="relative overflow-hidden rounded-3xl p-5 text-white shadow-[0_18px_40px_-20px_rgba(4,27,82,.8)]"
      style={{ background: "linear-gradient(135deg,#0a1f55 0%,#0d3a8a 60%,#0b6b5a 130%)" }}>
      <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="relative flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-emerald-300/90">Dossier convoyeur</p>
          <p className="mt-1 text-4xl font-bold leading-none tracking-tight">{done}<span className="text-2xl text-white/60"> / {total}</span></p>
          <p className="mt-1.5 text-sm text-white/80">documents requis validés</p>
        </div>
        <div className={"grid h-14 w-14 shrink-0 place-items-center rounded-2xl border " + (complete ? "border-emerald-300/50 bg-emerald-400/20 text-emerald-300" : "border-white/20 bg-white/10 text-white/80")}>
          {complete ? <BadgeCheck size={28} /> : <FileText size={26} />}
        </div>
      </div>
      <div className="relative mt-4 flex gap-1.5" aria-hidden>
        {Array.from({ length: Math.max(total, 1) }, (_, i) => (
          <span key={i} className={"h-2 flex-1 rounded-full " + (i < done ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,230,140,.7)]" : "bg-white/15")} />
        ))}
      </div>
      {items.length > 0 && (
        <div className="relative mt-4 flex flex-wrap gap-1.5">
          {items.map((it) => {
            const cls = it.status === "approved" ? "bg-emerald-400/20 text-emerald-100 ring-emerald-300/40"
              : it.status === "pending" ? "bg-sky-400/20 text-sky-100 ring-sky-300/40"
              : it.status === "refused" ? "bg-red-400/25 text-red-100 ring-red-300/40"
              : "bg-white/8 text-white/55 ring-white/15";
            return (
              <span key={it.label} className={"inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 " + cls}>
                {it.status === "approved" ? <CheckCircle2 size={11} /> : it.status === "pending" ? <Clock size={11} /> : it.status === "refused" ? <XCircle size={11} /> : <span className="h-2.5 w-2.5 rounded-full border border-current opacity-70" />}
                {it.label}{!it.required && it.status === "none" ? " (facultatif)" : ""}
              </span>
            );
          })}
        </div>
      )}
      <p className="relative mt-3 text-xs text-white/70">
        {complete ? "Votre dossier est complet. Vous pouvez recevoir des missions." : `Il vous reste ${total - done} document${total - done > 1 ? "s" : ""} à faire valider.`}
      </p>
    </div>
  );
}

/* ------------------------------ Contrat ------------------------------ */
export function ContratCardView(p: {
  signed: boolean; signedAt: string | null; blocked: boolean; expired: boolean; missing: string[];
  busy: boolean; onSign: () => void; onDownload: (w: "signed" | "dossier") => void;
}) {
  const pill = p.signed
    ? <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-300/40"><ShieldCheck size={13} /> Signé le {p.signedAt ? new Date(p.signedAt).toLocaleDateString("fr-FR") : "—"}</span>
    : p.blocked
      ? <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-3 py-1 text-xs font-semibold text-amber-200 ring-1 ring-amber-300/40"><AlertCircle size={13} /> Documents manquants</span>
      : <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-400/20 px-3 py-1 text-xs font-semibold text-sky-200 ring-1 ring-sky-300/40"><Clock size={13} /> {p.expired ? "Lien expiré" : "En attente de votre signature"}</span>;
  return (
    <div className="relative overflow-hidden rounded-3xl p-5 text-white shadow-[0_18px_40px_-22px_rgba(4,27,82,.85)]"
      style={{ background: "linear-gradient(160deg,#0a1638 0%,#10286b 100%)" }}>
      <div className="pointer-events-none absolute -left-8 -bottom-10 h-36 w-36 rounded-full bg-sky-400/15 blur-3xl" />
      <div className="relative flex items-start gap-3.5">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10 text-sky-200 ring-1 ring-white/15"><FileSignature size={22} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold leading-tight">Contrat de partenariat</h2>
          <div className="mt-2">{pill}</div>
        </div>
      </div>
      <p className="relative mt-3 text-[13px] leading-relaxed text-white/75">
        {p.signed ? "Une copie signée vous a été envoyée par e-mail. Vous la retrouvez ici à tout moment."
          : p.blocked ? `Pour signer, déposez d'abord : ${p.missing.join(", ")}.`
          : p.expired ? "Demandez un nouveau lien pour signer votre contrat."
          : "Votre contrat est prêt : lisez-le, paraphez-le et signez en quelques minutes."}
      </p>
      <div className="relative mt-4 grid gap-2.5 md:grid-cols-2">
        {p.signed ? (<>
          <button type="button" onClick={() => p.onDownload("signed")} disabled={p.busy}
            className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 text-[15px] font-semibold text-white shadow-[0_10px_24px_-10px_rgba(16,185,129,.9)] active:scale-[.98] disabled:opacity-60">
            {p.busy ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />} Télécharger le contrat signé
          </button>
          <button type="button" onClick={() => p.onDownload("dossier")} disabled={p.busy}
            className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-4 text-[15px] font-semibold text-white active:scale-[.98] disabled:opacity-60">
            <ShieldCheck size={18} /> Preuve de signature
          </button>
        </>) : !p.blocked ? (
          <button type="button" onClick={p.onSign} disabled={p.busy}
            className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 text-[15px] font-semibold text-white shadow-[0_10px_24px_-10px_rgba(16,185,129,.9)] active:scale-[.98] disabled:opacity-60 md:col-span-2">
            {p.busy ? <Loader2 size={18} className="animate-spin" /> : <PenLine size={18} />} Signer mon contrat
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------ Photo de profil ------------------------------ */
export function ProfileCardView({ avatarUrl, uploading, children }: { avatarUrl: string | null; uploading: boolean; children: ReactNode }) {
  return (
    <div className="flex items-center gap-4 rounded-3xl border border-[#e3e8f2] bg-[#ffffff] p-4 shadow-[0_10px_30px_-22px_rgba(10,22,56,.45)]">
      <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-emerald-300 bg-emerald-50">
        {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : <UserIcon size={26} className="text-emerald-600" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold" style={{ color: NAVY }}>Photo de profil</p>
        <p className="text-xs leading-snug text-[#5a6788]">Visible par l'équipe et vos clients.</p>
      </div>
      <label className="inline-flex min-h-[44px] shrink-0 cursor-pointer items-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-semibold text-white active:scale-[.98]">
        {uploading ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />} Modifier
        {children}
      </label>
    </div>
  );
}

/* ------------------------------ Carte d'un document ------------------------------ */
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
  const st = {
    approved: { tile: "bg-emerald-50 text-emerald-600 ring-emerald-200", icon: CheckCircle2, label: "Approuvé", pill: "bg-emerald-50 text-emerald-700 ring-emerald-200", bar: "bg-emerald-500" },
    pending: { tile: "bg-sky-50 text-sky-600 ring-sky-200", icon: Clock, label: "En attente de validation", pill: "bg-sky-50 text-sky-700 ring-sky-200", bar: "bg-sky-400" },
    refused: { tile: "bg-red-50 text-red-600 ring-red-200", icon: XCircle, label: "Refusé", pill: "bg-red-50 text-red-700 ring-red-200", bar: "bg-red-500" },
    none: { tile: "bg-[#f1f4fa] text-[#7b88a8] ring-[#e1e7f3]", icon: FileText, label: "", pill: "", bar: "bg-[#d5dcec]" },
  }[p.status];
  const Icon = st.icon;
  const has = p.status !== "none";
  const renewCls = p.renewal?.tone === "expired" ? "bg-red-50 text-red-700 ring-red-200" : p.renewal?.tone === "soon" ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200";
  return (
    <div className="relative overflow-hidden rounded-3xl border border-[#e3e8f2] bg-[#ffffff] p-4 pl-5 shadow-[0_10px_30px_-22px_rgba(10,22,56,.45)]">
      <span className={"absolute left-0 top-0 h-full w-1.5 " + st.bar} />
      <div className="flex items-start gap-3.5">
        <span className={"grid h-12 w-12 shrink-0 place-items-center rounded-2xl ring-1 " + st.tile}><Icon size={22} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15.5px] font-semibold leading-tight" style={{ color: NAVY }}>{p.label}</h3>
            {p.required && <span className="rounded-md bg-[#eef3ff] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#2f5fff]">Requis</span>}
          </div>
          {p.hint && <p className="mt-1 text-xs leading-snug text-[#6b7aa3]">{p.hint}</p>}
          {has && p.fileName && <p className="mt-1.5 truncate text-[13px] text-[#44516f]">{p.fileName}{p.dateLabel ? ` · ${p.dateLabel}` : ""}</p>}
          {has && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className={"inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ring-1 " + st.pill}><Icon size={12} /> {st.label}</span>
              {p.renewal && <span className={"inline-flex items-center rounded-full px-2.5 py-1 text-[11.5px] font-semibold ring-1 " + renewCls}>{p.renewal.text}</span>}
            </div>
          )}
          {p.status === "refused" && p.refusMotif && <p className="mt-2 text-xs text-red-700">Motif : {p.refusMotif}</p>}
          {!has && <p className="mt-1.5 text-[13px] text-[#8793b0]">Aucun fichier envoyé</p>}
        </div>
      </div>
      {p.onDelete && (
        <button type="button" onClick={p.onDelete} className="mt-3 text-xs font-semibold text-red-600 underline underline-offset-2">Supprimer ce document</button>
      )}
      <div className={"mt-4 grid gap-2 " + (p.onPreview ? "grid-cols-[auto_1fr_1fr]" : "grid-cols-2")}>
        {p.onPreview && (
          <button type="button" onClick={p.onPreview} aria-label="Voir le document"
            className="grid min-h-[46px] w-12 place-items-center rounded-2xl border border-[#d7dff0] bg-[#ffffff] text-[#2a3a66] active:scale-[.97]"><Eye size={18} /></button>
        )}
        <label className={"inline-flex min-h-[46px] cursor-pointer items-center justify-center gap-2 rounded-2xl px-3 text-sm font-semibold active:scale-[.98] " + (has ? "border border-[#d7dff0] bg-[#ffffff] text-[#1c2c58]" : "bg-emerald-600 text-white shadow-[0_10px_22px_-12px_rgba(5,150,105,.9)]")}>
          {p.uploading ? <Loader2 size={16} className="animate-spin" /> : has ? <RotateCcw size={16} /> : <Upload size={16} />}
          {has ? (p.uploadLabels?.replace ?? "Remplacer") : (p.uploadLabels?.add ?? "Envoyer")}
          {p.uploadInput}
        </label>
        <span className="contents">{p.scanButton}</span>
      </div>
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="px-1 pt-1 text-[11px] font-bold uppercase tracking-[.2em] text-[#5a6788]">{children}</h2>;
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
          <h3 className="text-[15.5px] font-semibold leading-tight" style={{ color: NAVY }}>Autres documents</h3>
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
