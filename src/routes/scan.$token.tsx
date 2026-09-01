/**
 * /scan/$token · page mobile publique appelée par le QR code depuis le PC.
 *
 * Le visiteur arrive ici après avoir scanné le QR (ou saisi le code court sur
 * /scan). Aucun compte requis : la validité est vérifiée côté serveur via la
 * route publique `/api/public/scan/handoff-session` (action `poll`).
 *
 * Le scanner utilisé est exactement celui de l'app Driver (`PremiumScanner`).
 * Un seul document actif par session : un nouveau scan remplace le précédent.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { PremiumScanner } from "@/components/scanner/PremiumScanner";
import { CheckCircle2, Smartphone, Clock, Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { DOCUMENT_LABEL, type ExtractionResult } from "@/lib/scanner/types";

export const Route = createFileRoute("/scan/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Scan document · Transports Ligneo" },
      { name: "description", content: "Envoyez instantanément vos documents scannés à Transports Ligneo." },
      { name: "robots", content: "noindex, nofollow" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
  }),
  component: ScanHandoffPage,
});

const API = "/api/public/scan/handoff-session";

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
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [sent, setSent] = useState<ExtractionResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const pinged = useRef(false);

  /* Validation de la session ------------------------------------------- */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "poll", token }),
        });
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !json?.ok) {
          setFatal(json?.error ?? "Session invalide ou expirée");
          return;
        }
        setExpiresAt(json.expires_at as string);
      } catch {
        if (!cancelled) setFatal("Connexion impossible");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  /* Compte à rebours ----------------------------------------------------- */
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const s = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setRemaining(s);
      if (s === 0) setFatal("Session expirée");
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [expiresAt]);

  const openScanner = useCallback(() => {
    setError(null);
    setScannerOpen(true);
    if (!pinged.current) {
      pinged.current = true;
      void fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status", token, status: "scanning" }),
      }).catch(() => {});
    }
  }, [token]);

  const handleCapture = useCallback(async (pages: Blob[]) => {
    setScannerOpen(false);
    const blob = pages[0];
    if (!blob) return;
    setProcessing(true);
    setError(null);
    try {
      const dataUrl = await blobToDataUrl(blob);
      const res = await fetch("/api/public/scan/handoff-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, image_data_url: dataUrl }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        if (res.status === 410) setFatal(json?.error ?? "Session expirée");
        else setError(json?.error ?? "Envoi impossible");
        return;
      }
      setSent(json.extraction as ExtractionResult);
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

  if (fatal) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0b1026] to-[#111a3d] flex items-center justify-center p-6">
        <div className="max-w-sm rounded-2xl bg-white/5 border border-red-400/40 p-6 text-center text-white">
          <AlertTriangle className="mx-auto text-red-400 mb-3" size={32} />
          <h2 className="font-semibold mb-2">Session indisponible</h2>
          <p className="text-sm text-white/70">{fatal}</p>
          <p className="text-xs text-white/50 mt-4">
            Retournez sur l'ordinateur et générez un nouveau QR code.
          </p>
          <Link to="/scan" className="inline-block mt-4 text-xs text-[#e7c76a] underline">
            Saisir un autre code
          </Link>
        </div>
      </div>
    );
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b1026] to-[#111a3d] text-white flex flex-col">
      <header className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-2 text-[#e7c76a]">
          <Smartphone size={18} />
          <span className="text-xs uppercase tracking-[0.25em]">Transports Ligneo</span>
        </div>
        <h1 className="mt-2 text-xl font-semibold" style={{ fontFamily: "'Playfair Display', serif" }}>
          Scanner votre document
        </h1>
        <p className="text-white/60 text-sm mt-1">
          Les champs se pré-remplissent instantanément sur votre ordinateur.
        </p>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
        {!sent && !processing && (
          <div className="text-center max-w-xs">
            <div className="mx-auto mb-4 w-20 h-20 rounded-full bg-[#d4af37]/15 flex items-center justify-center">
              <Sparkles className="text-[#e7c76a]" size={32} />
            </div>
            <p className="text-white/70 text-sm">
              Photographiez carte grise, bon de commande, PV… l'IA détecte automatiquement le type
              et extrait tous les champs.
            </p>
          </div>
        )}

        {processing && (
          <div className="flex flex-col items-center gap-2 text-white/70">
            <Loader2 className="animate-spin" size={28} />
            <p className="text-sm">Extraction en cours…</p>
            <p className="text-[11px] text-white/40">Ne fermez pas cette page</p>
          </div>
        )}

        {sent && !processing && (
          <div className="w-full max-w-sm space-y-3">
            <div className="flex items-center gap-3 rounded-xl bg-emerald-400/10 border border-emerald-400/40 px-4 py-3">
              <CheckCircle2 className="text-emerald-400 flex-shrink-0" size={20} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {DOCUMENT_LABEL[sent.document_type] ?? "Document"}
                </p>
                <p className="text-xs text-white/60">
                  {Object.keys(sent.fields).length} champs envoyés à votre ordinateur
                </p>
              </div>
            </div>
            <p className="text-center text-xs text-white/50">
              Vous pouvez revenir à votre ordinateur : le formulaire est pré-rempli.
            </p>
          </div>
        )}

        {error && <p className="text-red-300 text-xs text-center">{error}</p>}
      </main>

      <footer className="p-5 border-t border-white/10 bg-black/30 space-y-3">
        <button
          disabled={processing}
          onClick={openScanner}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#e7c76a] text-[#0b1026] font-semibold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Sparkles size={18} />
          {sent ? "Remplacer le document" : "Scanner un document"}
        </button>
        <p className="flex items-center justify-center gap-1.5 text-[11px] text-white/40">
          <Clock size={11} />
          Session sécurisée · expire dans {mm}:{ss}
        </p>
      </footer>

      {scannerOpen && (
        <PremiumScanner
          title="Scanner un document"
          hint="Cadrez le document"
          onCancel={() => setScannerOpen(false)}
          onCapture={handleCapture}
        />
      )}
    </div>
  );
}
