/**
 * QrHandoffButton · bouton "Scanner depuis mon téléphone".
 *
 * Ouvre une modale premium contenant un QR code + un code court à 6 caractères.
 * Le téléphone arrive sur `/scan/$token` (ou saisit le code sur `/scan`),
 * photographie SON document avec le scanner Driver, et l'extraction remonte au
 * PC par polling de la route publique `/api/public/scan/handoff-session`.
 *
 * Fonctionne pour un visiteur non connecté (devis public) comme pour un admin :
 * tout passe par la route publique, le token étant le seul secret.
 *
 * Contrat identique à `ScanToPrefill` : `onExtracted(fields, docs)`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { QrCode, X, Loader2, Smartphone, Check, RefreshCw, Copy } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import {
  mergeExtractions, DOCUMENT_LABEL,
  type ExtractedFields, type ExtractionResult,
} from "@/lib/scanner/types";

interface Props {
  context?: "admin_mission" | "client_reservation" | "pro_demande";
  onExtracted: (fields: ExtractedFields, docs: ExtractionResult[]) => void;
  className?: string;
  variant?: "blue" | "purple";
}

interface Session {
  id: string;
  token: string;
  short_code: string;
  expires_at: string;
  url: string;
}

const API = "/api/public/scan/handoff-session";

type Phase = "waiting" | "scanning" | "received";

export function QrHandoffButton({
  context = "admin_mission",
  onExtracted,
  className = "",
  variant = "blue",
}: Props) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [received, setReceived] = useState<ExtractionResult[]>([]);
  const [remaining, setRemaining] = useState<number>(1800);
  const [phase, setPhase] = useState<Phase>("waiting");
  const seenIdsRef = useRef<Set<string>>(new Set());
  const receivedRef = useRef<ExtractionResult[]>([]);

  // `onExtracted` est souvent une closure recréée à chaque rendu : on la garde
  // dans une ref pour ne jamais relancer la boucle de polling.
  const onExtractedRef = useRef(onExtracted);
  useEffect(() => { onExtractedRef.current = onExtracted; }, [onExtracted]);

  const post = useCallback(async (payload: Record<string, unknown>) => {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => null);
    return { ok: res.ok && json?.ok === true, status: res.status, json } as const;
  }, []);

  // ─── Créer la session ────────────────────────────────────────────────────
  const startSession = useCallback(async () => {
    setCreating(true);
    try {
      const { ok, json } = await post({ action: "create", context });
      if (!ok || !json?.session) throw new Error(json?.error ?? "create failed");
      const s = json.session as Omit<Session, "url">;
      // Le téléphone doit atterrir sur un domaine public joignable : les URLs
      // de preview / localhost ne le sont pas.
      const host = window.location.hostname;
      const isPublic =
        !/localhost|127\.0\.0\.1|(^|\.)id-preview|lovableproject\.com|\.sandbox\./i.test(host);
      const origin = isPublic ? window.location.origin : "https://www.transportsligneo.fr";
      const url = `${origin}/scan/${s.token}`;
      const qr = await QRCode.toDataURL(url, {
        width: 320,
        margin: 1,
        color: { dark: "#0b1026", light: "#ffffff" },
      });
      setSession({ ...s, url });
      setQrDataUrl(qr);
      setReceived([]);
      receivedRef.current = [];
      seenIdsRef.current = new Set();
      setPhase("waiting");
      setRemaining(Math.max(0, Math.floor((new Date(s.expires_at).getTime() - Date.now()) / 1000)));
    } catch (err) {
      console.error(err);
      toast.error("Impossible de créer la session de scan");
      setOpen(false);
    } finally {
      setCreating(false);
    }
  }, [post, context]);

  useEffect(() => {
    if (open && !session && !creating) void startSession();
  }, [open, session, creating, startSession]);

  // ─── Timer ───────────────────────────────────────────────────────────────
  const expiresAt = session?.expires_at ?? null;
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      setRemaining(Math.max(0, Math.floor(ms / 1000)));
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [expiresAt]);

  // ─── Réception des extractions (polling de la route publique) ────────────
  const token = session?.token ?? null;
  useEffect(() => {
    if (!token) return;
    let stopped = false;

    const ingest = (rows: { id: string; extraction: ExtractionResult }[]) => {
      const fresh = rows.filter((r) => r.id && !seenIdsRef.current.has(r.id) && r.extraction);
      if (fresh.length === 0) return;
      fresh.forEach((r) => seenIdsRef.current.add(r.id));
      const next = [...receivedRef.current, ...fresh.map((r) => r.extraction)];
      receivedRef.current = next;
      setReceived(next);
      setPhase("received");
      onExtractedRef.current(mergeExtractions(next), next);
      fresh.forEach((r) => {
        const n = Object.keys(r.extraction.fields ?? {}).length;
        toast.success(
          `📱 ${DOCUMENT_LABEL[r.extraction.document_type] ?? "Document"} reçu · ${n} champ${n > 1 ? "s" : ""} pré-rempli${n > 1 ? "s" : ""}`,
        );
      });
    };

    const poll = async () => {
      const { ok, status, json } = await post({ action: "poll", token });
      if (stopped) return;
      if (!ok) {
        if (status === 410 || status === 404) setRemaining(0);
        return;
      }
      if (json.status === "scanning" && receivedRef.current.length === 0) setPhase("scanning");
      ingest((json.extractions ?? []) as { id: string; extraction: ExtractionResult }[]);
    };

    void poll();
    const iv = setInterval(() => { void poll(); }, 2000);
    return () => { stopped = true; clearInterval(iv); };
  }, [token, post]);

  // La session reste ouverte après réception : le téléphone peut envoyer
  // un autre document, l'utilisateur ferme lui-même la fenêtre.

  // ─── Fermeture / cleanup ─────────────────────────────────────────────────
  const handleClose = useCallback(async () => {
    if (session) { void post({ action: "close", token: session.token }); }
    setOpen(false);
    setSession(null);
    setQrDataUrl(null);
    setReceived([]);
    receivedRef.current = [];
    setPhase("waiting");
  }, [session, post]);

  const handleRegenerate = useCallback(async () => {
    if (session) { void post({ action: "close", token: session.token }); }
    setSession(null); setQrDataUrl(null); setReceived([]); receivedRef.current = [];
    await startSession();
  }, [session, post, startSession]);

  const copyLink = () => {
    if (!session) return;
    navigator.clipboard.writeText(session.url).then(() => toast.success("Lien copié"));
  };

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const expired = remaining <= 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          variant === "purple"
            ? `inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition border border-[#a78bfa]/60 text-[#7c5cff] hover:bg-[#a78bfa]/10 ${className}`
            : `inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition border border-[#4f8cff]/60 text-[#2f5fff] hover:bg-[#4f8cff]/10 ${className}`
        }
      >
        <QrCode size={16} />
        Scanner depuis mon téléphone
        <Smartphone size={13} className="opacity-70" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[9999] bg-[#0b1026]/55 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) void handleClose(); }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div>
                <h3 className="text-[#0b1026] font-semibold tracking-wide">Scanner depuis mon téléphone</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Pré-remplissage instantané du véhicule</p>
              </div>
              <button onClick={handleClose} aria-label="Fermer" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 flex flex-col items-center gap-4">
              {creating || !qrDataUrl ? (
                <div className="h-[320px] flex flex-col items-center justify-center gap-3 text-slate-500">
                  <Loader2 className="animate-spin" size={28} />
                  <p className="text-sm">Génération du QR code…</p>
                </div>
              ) : (
                <>
                  <div className="relative rounded-xl bg-white border border-slate-200 p-3 shadow-[0_10px_40px_rgba(79,140,255,0.20)]">
                    <img src={qrDataUrl} alt="QR code de handoff" width={280} height={280} />
                    {expired && (
                      <div className="absolute inset-0 bg-[#0b1026]/85 rounded-xl flex flex-col items-center justify-center text-white gap-2">
                        <p className="text-sm">Session expirée</p>
                        <button onClick={handleRegenerate} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2f5fff] text-white text-xs font-semibold">
                          <RefreshCw size={12} /> Régénérer
                        </button>
                      </div>
                    )}
                    {phase === "received" && (
                      <div className="absolute inset-0 bg-emerald-500/85 rounded-xl flex flex-col items-center justify-center text-white gap-2">
                        <Check size={40} />
                        <p className="text-sm font-semibold">Document reçu</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-center gap-1 text-center">
                    <p className="text-slate-600 text-xs">
                      Scannez le QR, ou allez sur <span className="text-[#2f5fff] font-medium">transportsligneo.fr/scan</span> et entrez le code :
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1.5 rounded-md bg-[#f4f7ff] border border-[#4f8cff]/30 text-[#2f5fff] font-mono tracking-[0.35em] text-lg">
                        {session?.short_code}
                      </span>
                      <button
                        onClick={copyLink}
                        title="Copier le lien"
                        className="p-2 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                    <p className={`text-[11px] mt-1 ${expired ? "text-red-500" : "text-slate-400"}`}>
                      {expired ? "Expirée" : `Expire dans ${mm}:${ss}`}
                    </p>
                  </div>

                  {/* Statut */}
                  <div className="w-full mt-2 border-t border-slate-200 pt-3">
                    {received.length === 0 ? (
                      <p className="text-slate-500 text-xs text-center flex items-center justify-center gap-2">
                        {phase === "scanning" ? (
                          <>
                            <Loader2 size={12} className="animate-spin text-[#2f5fff]" />
                            Téléphone connecté · scan en cours…
                          </>
                        ) : (
                          <>
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#4f8cff] animate-pulse" />
                            En attente du téléphone…
                          </>
                        )}
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {received.map((d, i) => (
                          <li key={i} className="flex items-center gap-2 text-slate-700 text-xs">
                            <Check size={14} className="text-emerald-500" />
                            <span className="flex-1">
                              {DOCUMENT_LABEL[d.document_type] ?? "Document"} · {Object.keys(d.fields).length} champs pré-remplis
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-slate-50">
              <button
                onClick={handleRegenerate}
                disabled={creating}
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 disabled:opacity-50"
              >
                <RefreshCw size={12} /> Nouveau QR
              </button>
              <button
                onClick={handleClose}
                className="px-4 py-1.5 rounded-md bg-[#2f5fff] text-white text-xs font-semibold hover:bg-[#4f8cff]"
              >
                {received.length > 0 ? "Terminer" : "Fermer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
