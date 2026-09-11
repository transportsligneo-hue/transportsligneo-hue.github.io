/**
 * /scan/$token · page mobile publique appelée par le QR code depuis le PC.
 *
 * Le visiteur arrive ici après avoir scanné le QR (ou saisi le code court sur
 * /scan). Aucun compte requis : la validité est vérifiée côté serveur via la
 * route publique `/api/public/scan/handoff-session` (action `poll`).
 *
 * Le scanner utilisé est le scanner automatique de l'app Driver
 * (`DocumentScanner`, accent bleu). Plusieurs scans successifs sont possibles :
 * chaque nouveau document remplace le précédent sur l'ordinateur.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { DocumentScanner } from "@/components/inspection/DocumentScanner";
import { CheckCircle2, Smartphone, Clock, ScanLine, Loader2, AlertTriangle } from "lucide-react";
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

  const handleScanned = useCallback(async (file: File) => {
    setScannerOpen(false);
    setProcessing(true);
    setError(null);
    try {
      const dataUrl = await blobToDataUrl(file);
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
      const extraction = json.extraction as ExtractionResult;
      if (Object.keys(extraction.fields ?? {}).length === 0) {
        setError("Document illisible : reprenez la photo bien à plat, sans reflet.");
        return;
      }
      setSent(extraction);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Envoi impossible");
    } finally {
      setProcessing(false);
    }
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f7ff] flex items-center justify-center text-[#2f5fff]">
        <Loader2 className="animate-spin" size={28} />
      </div>
    );
  }

  if (fatal) {
    return (
      <div className="min-h-screen bg-[#f4f7ff] flex items-center justify-center p-6">
        <div className="max-w-sm rounded-2xl bg-white border border-red-200 shadow-sm p-6 text-center">
          <AlertTriangle className="mx-auto text-red-500 mb-3" size={32} />
          <h2 className="font-semibold mb-2 text-[#0b1026]">Session indisponible</h2>
          <p className="text-sm text-slate-600">{fatal}</p>
          <p className="text-xs text-slate-400 mt-4">
            Retournez sur l'ordinateur et générez un nouveau QR code.
          </p>
          <Link to="/scan" className="inline-block mt-4 text-xs text-[#2f5fff] underline">
            Saisir un autre code
          </Link>
        </div>
      </div>
    );
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <div className="min-h-screen bg-[#f4f7ff] text-[#0b1026] flex flex-col">
      <header className="px-5 py-5 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2 text-[#2f5fff]">
          <Smartphone size={18} />
          <span className="text-xs uppercase tracking-[0.25em]">Transports Ligneo</span>
        </div>
        <h1 className="mt-2 text-xl font-semibold" style={{ fontFamily: "'Playfair Display', serif" }}>
          Scanner votre document
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Les champs se pré-remplissent instantanément sur votre ordinateur.
        </p>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
        {!sent && !processing && (
          <div className="text-center max-w-xs">
            <div className="mx-auto mb-4 w-20 h-20 rounded-full bg-[#4f8cff]/12 flex items-center justify-center">
              <ScanLine className="text-[#2f5fff]" size={32} />
            </div>
            <p className="text-slate-600 text-sm">
              Photographiez carte grise, bon de commande, PV… la détection est automatique :
              plaque, VIN, marque, modèle, énergie, couleur.
            </p>
          </div>
        )}

        {processing && (
          <div className="flex flex-col items-center gap-2 text-slate-500">
            <Loader2 className="animate-spin text-[#2f5fff]" size={28} />
            <p className="text-sm">Lecture du document…</p>
            <p className="text-[11px] text-slate-400">Ne fermez pas cette page</p>
          </div>
        )}

        {sent && !processing && (
          <div className="w-full max-w-sm space-y-3">
            <div className="flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
              <CheckCircle2 className="text-emerald-600 flex-shrink-0" size={20} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {DOCUMENT_LABEL[sent.document_type] ?? "Document"}
                </p>
                <p className="text-xs text-slate-500">
                  {Object.keys(sent.fields).length} champs envoyés à votre ordinateur
                </p>
              </div>
            </div>
            <p className="text-center text-xs text-slate-500">
              Vous pouvez revenir à votre ordinateur : le formulaire est pré-rempli.
            </p>
          </div>
        )}

        {error && <p className="text-red-600 text-xs text-center max-w-xs">{error}</p>}
      </main>

      <footer className="p-5 border-t border-slate-200 bg-white space-y-3">
        <button
          disabled={processing}
          onClick={openScanner}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-[#2f5fff] to-[#4f8cff] text-white font-semibold shadow-[0_6px_20px_rgba(79,140,255,0.35)] disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <ScanLine size={18} />
          {sent ? "Scanner un autre document" : "Scanner un document"}
        </button>
        <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <Clock size={11} />
          Session sécurisée · expire dans {mm}:{ss}
        </p>
      </footer>

      {scannerOpen && (
        <DocumentScanner
          accent="blue"
          title="Scanner un document"
          onCancel={() => setScannerOpen(false)}
          onScanned={handleScanned}
        />
      )}
    </div>
  );
}
