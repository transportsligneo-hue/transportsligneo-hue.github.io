/**
 * Panneau admin « Signature électronique Ligneo » : envoi d'un document à signer
 * (PDF généré ou téléversé), suivi des statuts, relance, annulation,
 * téléchargement du document signé et du dossier de preuve.
 */
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BellRing, ChevronDown, Download, FileSignature, Loader2, Send, ShieldCheck, XCircle } from "lucide-react";
import {
  esignCancel, esignCreate, esignUploadUrl, esignDownloadUrls, esignEvents, esignList, esignRemind,
} from "@/lib/esign.functions";

type Kind = "devis" | "contrat_convoyeur" | "contrat_pro" | "autre";
const KIND_LABEL: Record<Kind, string> = {
  devis: "Devis", contrat_convoyeur: "Contrat convoyeur", contrat_pro: "Contrat client pro / flotte", autre: "Autre document",
};
const STATUS: Record<string, { label: string; cls: string }> = {
  sent: { label: "Envoyé", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  opened: { label: "Ouvert", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  signed: { label: "Signé", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  declined: { label: "Refusé", cls: "bg-red-50 text-red-700 border-red-200" },
  expired: { label: "Expiré", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  cancelled: { label: "Annulé", cls: "bg-slate-100 text-slate-600 border-slate-200" },
};
const EVENT_LABEL: Record<string, string> = {
  created: "Demande créée", invitation_sent: "Invitation envoyée", invitation_failed: "Échec d'envoi de l'invitation", opened: "Lien ouvert",
  otp_sent: "Code envoyé", otp_failed: "Code erroné", otp_verified: "Code validé", consent_given: "Consentement donné",
  signed: "Document signé", sealed: "Sceau apposé", declined: "Signature refusée", cancelled: "Annulé", reminder_sent: "Relance envoyée",
  expired: "Expiré", integrity_failure: "Alerte d'intégrité",
};

interface Row {
  id: string; kind: Kind; title: string; signer_name: string; signer_email: string; status: string;
  sent_at: string; signed_at: string | null; declined_at: string | null; decline_reason: string | null; expires_at: string;
  signed_doc_path: string | null;
}

const errMsg = (e: unknown, fallback: string) => {
  const m = (e as { message?: unknown } | null)?.message;
  return typeof m === "string" && m ? m.replace(/^.*Error:\s*/, "") : fallback;
};

function fileToBase64(f: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onerror = () => rej(new Error("Lecture du PDF impossible"));
    r.onload = () => res(String(r.result ?? "").split(",")[1] ?? "");
    r.readAsDataURL(f);
  });
}

export interface EsignPanelProps {
  kind?: Kind;
  refType?: string;
  refId?: string;
  defaults?: { title?: string; name?: string; email?: string; phone?: string; company?: string };
  /** Si fourni, le PDF est généré par l'appli (pas de téléversement). */
  getPdf?: () => Promise<Blob>;
  /** Masque la liste globale pour ne montrer que les demandes liées à refType/refId. */
  title?: string;
}

export default function EsignPanel(p: EsignPanelProps) {
  const create = useServerFn(esignCreate);
  const upUrl = useServerFn(esignUploadUrl);
  const list = useServerFn(esignList);
  const remind = useServerFn(esignRemind);
  const cancel = useServerFn(esignCancel);
  const dl = useServerFn(esignDownloadUrls);
  const events = useServerFn(esignEvents);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [log, setLog] = useState<{ events: any[]; chainOk: boolean } | null>(null);
  const [kind, setKind] = useState<Kind>(p.kind ?? "autre");
  const [title, setTitle] = useState(p.defaults?.title ?? "");
  const [name, setName] = useState(p.defaults?.name ?? "");
  const [email, setEmail] = useState(p.defaults?.email ?? "");
  const [phone, setPhone] = useState(p.defaults?.phone ?? "");
  const [company, setCompany] = useState(p.defaults?.company ?? "");
  const [days, setDays] = useState(14);
  const [file, setFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await list({ data: { refType: p.refType, refId: p.refId } });
      setRows(r.items as Row[]);
    } catch (e) { toast.error(errMsg(e, "Chargement impossible")); } finally { setLoading(false); }
  }, [list, p.refType, p.refId]);
  useEffect(() => { void load(); }, [load]);

  const uploadPdf = async (blob: Blob) => {
    const u = await upUrl();
    const { error } = await supabase.storage.from("esign-docs").uploadToSignedUrl(u.path, u.token, blob, { contentType: "application/pdf" });
    if (error) throw new Error(`Envoi du document impossible : ${error.message}`);
    return u.path;
  };
  const preview = async () => {
    if (!p.getPdf) return;
    const w = window.open("", "_blank");
    setBusy("preview");
    try {
      const blob = await p.getPdf();
      const url = URL.createObjectURL(blob);
      if (w) w.location.href = url; else window.open(url, "_blank");
    } catch (e) { w?.close(); toast.error(errMsg(e, "Aperçu impossible")); } finally { setBusy(null); }
  };
  const send = async () => {
    setBusy("send");
    try {
      const blob = p.getPdf ? await p.getPdf() : file;
      if (!blob) throw new Error("Ajoutez le PDF à faire signer.");
      const r = await create({ data: {
        kind, title, refType: p.refType ?? null, refId: p.refId ?? null,
        signerName: name, signerEmail: email, signerPhone: phone || null, signerCompany: company || null,
        pdfPath: await uploadPdf(blob), expiryDays: days,
      } });
      toast.success(r.emailSent ? "Document envoyé pour signature." : "Demande créée, mais l'e-mail n'a pas pu partir.");
      setFile(null); await load();
    } catch (e) { toast.error(errMsg(e, "Envoi impossible")); } finally { setBusy(null); }
  };
  const act = async (id: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(id);
    try { await fn(); toast.success(ok); await load(); } catch (e) { toast.error(errMsg(e, "Action impossible")); } finally { setBusy(null); }
  };
  const download = async (id: string, which: "signed" | "dossier" | "original") => {
    try { const u = await dl({ data: { id } }); const url = u[which]; if (url) window.open(url, "_blank"); else toast.error("Fichier indisponible."); }
    catch (e) { toast.error(errMsg(e, "Téléchargement impossible")); }
  };
  const toggleLog = async (id: string) => {
    if (open === id) { setOpen(null); return; }
    setOpen(id); setLog(null);
    try { setLog(await events({ data: { id } }) as any); } catch { setLog({ events: [], chainOk: false }); }
  };

  const field = "mt-1 w-full px-3 py-2 border border-pro-border rounded-lg text-sm text-pro-text bg-white";
  const canSend = title.trim() && name.trim() && /\S+@\S+\.\S+/.test(email) && (p.getPdf || file);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-pro-border bg-white p-4">
        <div className="flex items-center gap-2 font-medium text-pro-text"><FileSignature size={18} className="text-[#2F5FFF]" /> {p.title ?? "Envoyer un document à signer"}</div>
        <p className="text-xs text-pro-text-soft mt-1">Lien unique par e-mail, code de vérification (SMS ou e-mail), consentement explicite, signature au doigt, dossier de preuve horodaté.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {!p.kind && (
            <label className="text-xs text-pro-text-soft">Type
              <select className={field} value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
                {(Object.keys(KIND_LABEL) as Kind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
              </select></label>
          )}
          <label className="text-xs text-pro-text-soft">Titre du document<input className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Contrat de partenariat" /></label>
          <label className="text-xs text-pro-text-soft">Nom du signataire<input className={field} value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="text-xs text-pro-text-soft">E-mail<input className={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className="text-xs text-pro-text-soft">Mobile (pour le code SMS)<input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 12 34 56 78" /></label>
          <label className="text-xs text-pro-text-soft">Société (facultatif)<input className={field} value={company} onChange={(e) => setCompany(e.target.value)} /></label>
          <label className="text-xs text-pro-text-soft">Validité du lien (jours)<input className={field} type="number" min={1} max={60} value={days} onChange={(e) => setDays(Number(e.target.value) || 14)} /></label>
          {!p.getPdf && <label className="text-xs text-pro-text-soft">PDF à signer<input className={field} type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {p.getPdf && (
            <button onClick={() => void preview()} disabled={busy === "preview"}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#2F5FFF] text-[#2F5FFF] text-sm font-medium disabled:opacity-50">
              {busy === "preview" ? <Loader2 size={15} className="animate-spin" /> : <FileSignature size={15} />} Aperçu du contrat
            </button>
          )}
          <button onClick={() => void send()} disabled={!canSend || busy === "send"}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2F5FFF] text-white text-sm font-medium disabled:opacity-50">
            {busy === "send" ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Envoyer pour signature
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-pro-border bg-white divide-y divide-pro-border">
        {loading ? <div className="p-6 text-center"><Loader2 className="animate-spin inline text-[#2F5FFF]" /></div>
          : rows.length === 0 ? <div className="p-6 text-center text-sm text-pro-text-soft">Aucune demande de signature pour l'instant.</div>
          : rows.map((r) => {
            const st = STATUS[r.status] ?? STATUS.sent;
            const pending = ["sent", "opened", "expired"].includes(r.status);
            return (
              <div key={r.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-pro-text truncate">{r.title}</div>
                    <div className="text-xs text-pro-text-soft">{KIND_LABEL[r.kind]} · {r.signer_name} · {r.signer_email}</div>
                    <div className="text-xs text-pro-text-soft">Envoyé le {new Date(r.sent_at).toLocaleString("fr-FR")}{r.signed_at ? ` · signé le ${new Date(r.signed_at).toLocaleString("fr-FR")}` : ""}{r.decline_reason ? ` · refus : ${r.decline_reason}` : ""}</div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full border ${st.cls}`}>{st.label}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {r.status === "signed" && <>
                    <button className="btn-mini" onClick={() => void download(r.id, "signed")}><Download size={14} /> Document signé</button>
                    <button className="btn-mini" onClick={() => void download(r.id, "dossier")}><ShieldCheck size={14} /> Dossier de preuve</button>
                  </>}
                  {pending && <button className="btn-mini" disabled={busy === r.id} onClick={() => void act(r.id, () => remind({ data: { id: r.id } }), "Relance envoyée (nouveau lien).")}><BellRing size={14} /> Relancer</button>}
                  {pending && <button className="btn-mini" disabled={busy === r.id} onClick={() => void act(r.id, () => cancel({ data: { id: r.id } }), "Demande annulée.")}><XCircle size={14} /> Annuler</button>}
                  <button className="btn-mini" onClick={() => void toggleLog(r.id)}><ChevronDown size={14} className={open === r.id ? "rotate-180" : ""} /> Journal</button>
                </div>
                {open === r.id && (
                  <div className="mt-3 rounded-lg bg-slate-50 border border-pro-border p-3 text-xs">
                    {!log ? <Loader2 size={14} className="animate-spin" /> : <>
                      <div className={"mb-2 font-medium " + (log.chainOk ? "text-emerald-700" : "text-red-600")}>{log.chainOk ? "Journal intact (chaîne d'empreintes valide)" : "Journal non vérifiable"}</div>
                      <ul className="space-y-1">{log.events.map((e) => (
                        <li key={e.seq} className="flex gap-2"><span className="text-pro-text-soft w-36 shrink-0">{new Date(e.created_at).toLocaleString("fr-FR")}</span><span>{EVENT_LABEL[e.type] ?? e.type}{e.ip_address ? ` · IP ${e.ip_address}` : ""}</span></li>
                      ))}</ul></>}
                  </div>
                )}
              </div>
            );
          })}
      </div>
      <style>{`.btn-mini{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:8px;border:1px solid var(--pro-border,#dfe6fb);background:#fff;font-size:12px;font-weight:500;color:#1f3a8a}.btn-mini:disabled{opacity:.5}`}</style>
    </div>
  );
}
