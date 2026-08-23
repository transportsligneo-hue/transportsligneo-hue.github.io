/**
 * QrHandoffButton · bouton "Scanner depuis mon téléphone".
 *
 * Ouvre une modale premium contenant un QR code + code court. L'utilisateur
 * scanne le QR avec l'appareil photo natif de son téléphone → il arrive sur
 * `/scan/$token` (page publique), photographie ses documents, et chaque
 * extraction remonte au PC en temps réel via Supabase Realtime.
 *
 * Contrat identique à `ScanToPrefill` : `onExtracted(fields, docs)` · donc
 * branchement zéro-friction sur tout formulaire qui utilise déjà ScanToPrefill.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { QrCode, X, Loader2, Smartphone, Check, RefreshCw, Copy } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createHandoffSession, closeHandoffSession } from "@/lib/scanner/handoff.functions";
import {
  mergeExtractions, DOCUMENT_LABEL,
  type ExtractedFields, type ExtractionResult,
} from "@/lib/scanner/types";

interface Props {
  context?: "admin_mission" | "client_reservation" | "pro_demande";
  onExtracted: (fields: ExtractedFields, docs: ExtractionResult[]) => void;
  className?: string;
}

interface Session {
  id: string;
  token: string;
  short_code: string;
  expires_at: string;
  url: string;
}

export function QrHandoffButton({
  context = "admin_mission",
  onExtracted,
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [received, setReceived] = useState<ExtractionResult[]>([]);
  const [remaining, setRemaining] = useState<number>(1800);
  const [live, setLive] = useState(false);
  const create = useServerFn(createHandoffSession);
  const close = useServerFn(closeHandoffSession);
  const receivedRef = useRef<ExtractionResult[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());

  // `onExtracted` est souvent une closure recréée à chaque rendu : on la garde
  // dans une ref pour ne JAMAIS relancer la souscription Realtime (sinon le
  // canal se détruit/recrée en boucle et n'a jamais le temps de se connecter).
  const onExtractedRef = useRef(onExtracted);
  useEffect(() => { onExtractedRef.current = onExtracted; }, [onExtracted]);

  // ─── Créer la session ────────────────────────────────────────────────────
  const startSession = useCallback(async () => {
    setCreating(true);
    try {
      const s = await create({ data: { context } });
      // Le téléphone doit atterrir sur un domaine public accessible : les URLs
      // de preview / localhost ne sont pas joignables depuis le mobile.
      const host = window.location.hostname;
      const isPublic =
        !/localhost|127\.0\.0\.1|(^|\.)id-preview|lovableproject\.com|\.sandbox\./i.test(host);
      const origin = isPublic ? window.location.origin : "https://www.transportsligneo.fr";
      const url = `${origin}/scan/${s.token}`;
      const qr = await QRCode.toDataURL(url, {
        width: 320,
        margin: 1,
        color: { dark: "#0b1026", light: "#fdfcf8" },
      });
      setSession({ ...s, url });
      setQrDataUrl(qr);
      setReceived([]);
      receivedRef.current = [];
      seenIdsRef.current = new Set();
      setRemaining(Math.max(0, Math.floor((new Date(s.expires_at).getTime() - Date.now()) / 1000)));
    } catch (err) {
      console.error(err);
      toast.error("Impossible de créer la session de scan");
      setOpen(false);
    } finally {
      setCreating(false);
    }
  }, [create, context]);

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

  // ─── Réception des extractions (Realtime + polling de secours) ───────────
  const sessionId = session?.id ?? null;
  useEffect(() => {
    if (!sessionId) return;
    let stopped = false;

    const ingest = (rows: { id: string; extraction: ExtractionResult }[]) => {
      const fresh = rows.filter((r) => r.id && !seenIdsRef.current.has(r.id) && r.extraction);
      if (fresh.length === 0) return;
      fresh.forEach((r) => seenIdsRef.current.add(r.id));
      const next = [...receivedRef.current, ...fresh.map((r) => r.extraction)];
      receivedRef.current = next;
      setReceived(next);
      onExtractedRef.current(mergeExtractions(next), next);
      fresh.forEach((r) => {
        toast.success(`📱 Reçu : ${DOCUMENT_LABEL[r.extraction.document_type] ?? "Document"}`);
      });
    };

    const channel = supabase
      .channel(`scan-handoff-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "scan_handoff_extractions",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as { id: string; extraction: ExtractionResult };
          ingest([row]);
        },
      )
      .subscribe((status) => {
        if (stopped) return;
        setLive(status === "SUBSCRIBED");
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn("[handoff] realtime status", status);
        }
      });

    // Filet de sécurité : certains réseaux/navigateurs (Safari iOS en
    // arrière-plan, proxys d'entreprise) coupent le WebSocket. On interroge
    // la table toutes les 3 s : le parcours fonctionne même sans Realtime.
    const poll = setInterval(async () => {
      const { data, error } = await supabase
        .from("scan_handoff_extractions")
        .select("id, extraction")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });
      if (error || !data || stopped) return;
      ingest(data as unknown as { id: string; extraction: ExtractionResult }[]);
    }, 3000);

    return () => {
      stopped = true;
      clearInterval(poll);
      setLive(false);
      supabase.removeChannel(channel);
    };
  }, [sessionId]);


  // ─── Fermeture / cleanup ─────────────────────────────────────────────────
  const handleClose = useCallback(async () => {
    if (session) {
      try { await close({ data: { id: session.id } }); } catch { /* ignore */ }
    }
    setOpen(false);
    setSession(null);
    setQrDataUrl(null);
    setReceived([]);
    receivedRef.current = [];
  }, [session, close]);

  const handleRegenerate = useCallback(async () => {
    if (session) { try { await close({ data: { id: session.id } }); } catch { /* ignore */ } }
    setSession(null); setQrDataUrl(null); setReceived([]); receivedRef.current = [];
    await startSession();
  }, [session, close, startSession]);

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
        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition border border-[#d4af37]/60 text-[#d4af37] hover:bg-[#d4af37]/10 ${className}`}
      >
        <QrCode size={16} />
        Scanner depuis mon téléphone
        <Smartphone size={13} className="opacity-70" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[9999] bg-[#0b1026]/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) void handleClose(); }}
        >
          <div className="w-full max-w-md rounded-2xl bg-gradient-to-b from-[#111a3d] to-[#0b1026] border border-[#d4af37]/40 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div>
                <h3 className="text-white font-semibold tracking-wide">Scanner depuis mon téléphone</h3>
                <p className="text-[11px] text-white/50 mt-0.5">Pré-remplissage instantané par IA</p>
              </div>
              <button onClick={handleClose} aria-label="Fermer" className="p-2 rounded-lg hover:bg-white/10 text-white/70">
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 flex flex-col items-center gap-4">
              {creating || !qrDataUrl ? (
                <div className="h-[320px] flex flex-col items-center justify-center gap-3 text-white/60">
                  <Loader2 className="animate-spin" size={28} />
                  <p className="text-sm">Génération du QR code…</p>
                </div>
              ) : (
                <>
                  <div className="relative rounded-xl bg-[#fdfcf8] p-3 shadow-[0_10px_40px_rgba(212,175,55,0.25)]">
                    <img src={qrDataUrl} alt="QR code de handoff" width={280} height={280} />
                    {expired && (
                      <div className="absolute inset-0 bg-[#0b1026]/80 rounded-xl flex flex-col items-center justify-center text-white gap-2">
                        <p className="text-sm">Session expirée</p>
                        <button onClick={handleRegenerate} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#d4af37] text-[#0b1026] text-xs font-semibold">
                          <RefreshCw size={12} /> Régénérer
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-center gap-1 text-center">
                    <p className="text-white/70 text-xs">Scannez avec votre téléphone, ou entrez le code :</p>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1.5 rounded-md bg-white/10 text-[#e7c76a] font-mono tracking-[0.35em] text-lg">
                        {session?.short_code}
                      </span>
                      <button
                        onClick={copyLink}
                        title="Copier le lien"
                        className="p-2 rounded-md border border-white/20 text-white/70 hover:bg-white/10"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                    <p className={`text-[11px] mt-1 ${expired ? "text-red-400" : "text-white/50"}`}>
                      {expired ? "Expirée" : `Expire dans ${mm}:${ss}`}
                    </p>
                  </div>

                  {/* Reçus */}
                  <div className="w-full mt-2 border-t border-white/10 pt-3">
                    {received.length === 0 ? (
                      <p className="text-white/50 text-xs text-center">
                        En attente d'un document depuis le téléphone…
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {received.map((d, i) => (
                          <li key={i} className="flex items-center gap-2 text-white/80 text-xs">
                            <Check size={14} className="text-[#e7c76a]" />
                            <span className="flex-1">
                              {DOCUMENT_LABEL[d.document_type] ?? "Document"} · {Object.keys(d.fields).length} champs
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
            <div className="flex items-center justify-between px-5 py-3 border-t border-white/10 bg-black/20">
              <button
                onClick={handleRegenerate}
                disabled={creating}
                className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white/90 disabled:opacity-50"
              >
                <RefreshCw size={12} /> Nouveau QR
              </button>
              <button
                onClick={handleClose}
                className="px-4 py-1.5 rounded-md bg-[#d4af37] text-[#0b1026] text-xs font-semibold hover:bg-[#e7c76a]"
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
