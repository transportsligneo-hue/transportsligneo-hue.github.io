/**
 * /scan/$token — page mobile publique appelée par le QR code depuis le PC.
 *
 * L'utilisateur arrive ici après avoir scanné le QR généré par
 * `QrHandoffButton`. Aucun compte requis. Il utilise `PremiumScanner` pour
 * photographier ses documents, chaque page est envoyée à la route publique
 * `/api/public/scan/handoff-extract` qui fait OCR + push realtime vers le PC.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PremiumScanner } from "@/components/scanner/PremiumScanner";
import { CheckCircle2, Smartphone, Clock, Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { DOCUMENT_LABEL, type ExtractionResult } from "@/lib/scanner/types";

export const Route = createFileRoute("/scan/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Scan document — Transports Ligneo" },
      { name: "description", content: "Envoyez instantanément vos documents scannés à Transports Ligneo." },
      { name: "robots", content: "noindex, nofollow" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
  }),
  component: ScanHandoffPage,
});

interface SessionInfo {
  session_id: string;
  context: string;
  expires_at: string;
  status: string;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function ScanHandoffPage() {
  const { token } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [sent, setSent] = useState<ExtractionResult[]>([]);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("resolve_scan_handoff_token", { _token: token });
        if (cancelled) return;
        const row = Array.isArray(data) ? data[0] : data;
        if (error) throw error;
        if (!row) { setError("Session invalide ou expirée"); return; }
        setSession(row as SessionInfo);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erreur");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const handleCapture = useCallback(async (pages: Blob[]) => {
    setScannerOpen(false);
    if (pages.length === 0) return;
    setProcessing(true);
    try {
      for (const [i, blob] of pages.entries()) {
        const dataUrl = await blobToDataUrl(blob);
        const res = await fetch("/api/public/scan/handoff-extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, image_data_url: dataUrl }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          setError(json.error || `Erreur page ${i + 1}`);
          break;
        }
        setSent((prev) => [...prev, json.extraction as ExtractionResult]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Envoi impossible");
    } finally {
      setProcessing(false);
    }
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0b1026] to-[#111a3d] flex items-center justify-center text-white">
        <Loader2 className="animate-spin" size={28} />
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0b1026] to-[#111a3d] flex items-center justify-center p-6">
        <div className="max-w-sm rounded-2xl bg-white/5 border border-red-400/40 p-6 text-center text-white">
          <AlertTriangle className="mx-auto text-red-400 mb-3" size={32} />
          <h2 className="font-semibold mb-2">Session expirée</h2>
          <p className="text-sm text-white/70">{error}</p>
          <p className="text-xs text-white/50 mt-4">
            Retournez sur l'ordinateur et générez un nouveau QR code.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b1026] to-[#111a3d] text-white flex flex-col">
      <header className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-2 text-[#e7c76a]">
          <Smartphone size={18} />
          <span className="text-xs uppercase tracking-[0.25em]">Transports Ligneo</span>
        </div>
        <h1 className="mt-2 text-xl font-semibold" style={{ fontFamily: "'Playfair Display', serif" }}>
          Scanner vos documents
        </h1>
        <p className="text-white/60 text-sm mt-1">
          Les champs se pré-remplissent instantanément sur votre ordinateur.
        </p>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
        {sent.length === 0 && !processing && (
          <div className="text-center max-w-xs">
            <div className="mx-auto mb-4 w-20 h-20 rounded-full bg-[#d4af37]/15 flex items-center justify-center">
              <Sparkles className="text-[#e7c76a]" size={32} />
            </div>
            <p className="text-white/70 text-sm">
              Photographiez carte grise, bon de commande, PV… l'IA détecte automatiquement le type et extrait tous les champs.
            </p>
          </div>
        )}

        {processing && (
          <div className="flex flex-col items-center gap-2 text-white/70">
            <Loader2 className="animate-spin" size={28} />
            <p className="text-sm">Analyse en cours…</p>
          </div>
        )}

        {sent.length > 0 && (
          <div className="w-full max-w-sm space-y-2">
            {sent.map((d, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl bg-white/5 border border-[#d4af37]/25 px-4 py-3">
                <CheckCircle2 className="text-[#e7c76a] flex-shrink-0" size={20} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{DOCUMENT_LABEL[d.document_type] ?? "Document"}</p>
                  <p className="text-xs text-white/50">{Object.keys(d.fields).length} champs envoyés au PC</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {error && session && (
          <p className="text-red-300 text-xs text-center">{error}</p>
        )}
      </main>

      <footer className="p-5 border-t border-white/10 bg-black/30 space-y-3">
        <button
          disabled={processing}
          onClick={() => setScannerOpen(true)}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#e7c76a] text-[#0b1026] font-semibold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Sparkles size={18} />
          {sent.length === 0 ? "Scanner un document" : "Scanner un autre document"}
        </button>
        {session && (
          <p className="flex items-center justify-center gap-1.5 text-[11px] text-white/40">
            <Clock size={11} />
            Session sécurisée · expire à {new Date(session.expires_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </footer>

      {scannerOpen && (
        <PremiumScanner
          title="Scanner un document"
          hint="Cadrez le document"
          multiPage
          onCancel={() => setScannerOpen(false)}
          onCapture={handleCapture}
        />
      )}
    </div>
  );
}
