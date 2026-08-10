/**
 * PremiumScanner · scanner de documents plein écran, style Adobe Scan.
 *
 * Sub-phase 1 : capture caméra premium sans OpenCV (le WASM sera ajouté en
 * itération suivante pour la détection de contours temps réel). Ici on offre :
 *  - accès caméra arrière HD dès l'ouverture (< 400 ms sur devices modernes)
 *  - overlay guide "cadrez votre document" avec grille
 *  - capture haute résolution (jusqu'à 2560×1440 selon device)
 *  - contrôle qualité local (blur = variance de Laplacien approximative)
 *  - preview + retry + validation
 *  - support multi-pages (liste des captures)
 *  - fallback complet : si getUserMedia refusé → input file capture=environment
 *
 * Ce composant ne parle JAMAIS au serveur. Il livre les captures (Blob JPEG)
 * à son parent via `onCapture`, qui décide de l'OCR / stockage.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera, X, Check, RotateCcw, Zap, ZapOff, Loader2,
  AlertTriangle, ImagePlus, Trash2, Sparkles,
} from "lucide-react";
import { enhanceDocumentCapture } from "@/lib/scanner/scanic-process";

interface Page {
  id: string;
  blob: Blob;
  preview: string; // object URL
  qualityWarning?: string;
  enhanced?: boolean;
}

interface Props {
  title?: string;
  hint?: string;
  multiPage?: boolean;
  onCancel: () => void;
  onCapture: (pages: Blob[]) => void;
}

const MAX_WIDTH = 2560;
const JPEG_QUALITY = 0.92;

/** Estimation grossière du flou via variance des différences de luminosité. */
function estimateBlur(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return 0;
  // Sous-échantillonne pour rester rapide sur mobile.
  const W = Math.min(400, canvas.width);
  const H = Math.min(300, canvas.height);
  const tmp = document.createElement("canvas");
  tmp.width = W; tmp.height = H;
  const tctx = tmp.getContext("2d", { willReadFrequently: true });
  if (!tctx) return 0;
  tctx.drawImage(canvas, 0, 0, W, H);
  const { data } = tctx.getImageData(0, 0, W, H);
  const gray = new Float32Array(W * H);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    gray[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  let sum = 0, sumSq = 0, n = 0;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      // Laplacien 4-connexe
      const lap = -4 * gray[i] + gray[i - 1] + gray[i + 1] + gray[i - W] + gray[i + W];
      sum += lap; sumSq += lap * lap; n++;
    }
  }
  const mean = sum / n;
  return sumSq / n - mean * mean; // variance
}

export function PremiumScanner({
  title = "Scanner un document",
  hint = "Cadrez le document dans la zone",
  multiPage = false,
  onCancel,
  onCapture,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileFallbackRef = useRef<HTMLInputElement | null>(null);

  const [pages, setPages] = useState<Page[]>([]);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  // ─── Caméra ─────────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: MAX_WIDTH },
          height: { ideal: 1440 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
      // Torch support ?
      const track = stream.getVideoTracks()[0];
      const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
      if (caps.torch) setTorchSupported(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[PremiumScanner] camera unavailable", msg);
      setCameraError(
        msg.includes("Permission") || msg.includes("denied")
          ? "Accès caméra refusé. Autorisez l'appareil photo dans les réglages du navigateur."
          : "Caméra indisponible. Utilisez le bouton ci-dessous pour importer une photo."
      );
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [startCamera]);

  const toggleTorch = useCallback(async () => {
    if (!streamRef.current || !torchSupported) return;
    try {
      const track = streamRef.current.getVideoTracks()[0];
      const next = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch (e) {
      console.warn("[PremiumScanner] torch toggle failed", e);
    }
  }, [torchOn, torchSupported]);

  // ─── Capture ────────────────────────────────────────────────────────────
  const capture = useCallback(async () => {
    if (!videoRef.current || capturing) return;
    setCapturing(true);
    try {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const scale = Math.min(1, MAX_WIDTH / Math.max(vw, vh));
      canvas.width = Math.round(vw * scale);
      canvas.height = Math.round(vh * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas non disponible");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Contrôle qualité (blur)
      const blurVariance = estimateBlur(canvas);
      let warning: string | undefined;
      if (blurVariance < 60) {
        warning = "Photo un peu floue · vérifiez la mise au point si possible.";
      }

      const rawBlob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
      );
      if (!rawBlob) throw new Error("Encodage JPEG échoué");

      // Post-traitement Scanic : détection de contours + correction de perspective.
      // Non bloquant — si échec, on garde la photo brute.
      const enhanced = await enhanceDocumentCapture(rawBlob);
      const finalBlob = enhanced.blob;

      const preview = URL.createObjectURL(finalBlob);
      const page: Page = {
        id: crypto.randomUUID(),
        blob: finalBlob,
        preview,
        qualityWarning: warning,
        enhanced: enhanced.enhanced,
      };
      setPages((prev) => (multiPage ? [...prev, page] : [page]));

      if (typeof navigator.vibrate === "function") navigator.vibrate(30);
    } catch (err) {
      console.error("[PremiumScanner] capture failed", err);
    } finally {
      setCapturing(false);
    }
  }, [capturing, multiPage]);

  const removePage = useCallback((id: string) => {
    setPages((prev) => {
      const p = prev.find((x) => x.id === id);
      if (p) URL.revokeObjectURL(p.preview);
      return prev.filter((x) => x.id !== id);
    });
  }, []);

  const handleFileFallback = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    // Applique scanic aussi aux imports galerie.
    const newPages: Page[] = await Promise.all(
      files.map(async (f) => {
        const enh = await enhanceDocumentCapture(f);
        return {
          id: crypto.randomUUID(),
          blob: enh.blob,
          preview: URL.createObjectURL(enh.blob),
          enhanced: enh.enhanced,
        };
      }),
    );
    setPages((prev) => (multiPage ? [...prev, ...newPages] : newPages.slice(0, 1)));
    if (fileFallbackRef.current) fileFallbackRef.current.value = "";
  }, [multiPage]);

  const validate = useCallback(() => {
    onCapture(pages.map((p) => p.blob));
  }, [pages, onCapture]);

  // ─── Rendu ──────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[90] bg-black flex flex-col text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/90 border-b border-white/10">
        <button onClick={onCancel} className="p-2 hover:bg-white/10 rounded-lg" aria-label="Fermer">
          <X size={22} />
        </button>
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/50">Scanner de documents</p>
          <p className="text-sm font-semibold">{title}</p>
        </div>
        <div className="flex items-center gap-1">
          {torchSupported && (
            <button
              onClick={toggleTorch}
              className={`p-2 rounded-lg ${torchOn ? "bg-amber-500/30 text-amber-300" : "hover:bg-white/10"}`}
              aria-label="Lampe torche"
            >
              {torchOn ? <Zap size={20} /> : <ZapOff size={20} />}
            </button>
          )}
        </div>
      </div>

      {/* Viewport */}
      <div className="flex-1 relative overflow-hidden bg-black">
        {!cameraError ? (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Guide de cadrage */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="relative w-[85%] max-w-2xl aspect-[1.414/1] border-2 border-white/70 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
                {/* coins accentués */}
                {(["tl", "tr", "bl", "br"] as const).map((c) => (
                  <span
                    key={c}
                    className={`absolute w-6 h-6 border-amber-300 ${
                      c === "tl" ? "top-0 left-0 border-t-4 border-l-4" :
                      c === "tr" ? "top-0 right-0 border-t-4 border-r-4" :
                      c === "bl" ? "bottom-0 left-0 border-b-4 border-l-4" :
                      "bottom-0 right-0 border-b-4 border-r-4"
                    }`}
                  />
                ))}
              </div>
            </div>
            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <Loader2 className="animate-spin" size={32} />
              </div>
            )}
            <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/70 bg-black/50 px-3 py-1 rounded-full">
              {hint}
            </p>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
            <AlertTriangle size={40} className="text-amber-400 mb-3" />
            <p className="text-sm text-white/80 max-w-md">{cameraError}</p>
          </div>
        )}
      </div>

      {/* Bandeau pages */}
      {pages.length > 0 && (
        <div className="bg-black/95 border-t border-white/10 px-3 py-2 flex gap-2 overflow-x-auto">
          {pages.map((p, i) => (
            <div key={p.id} className="relative shrink-0">
              <img src={p.preview} alt={`Page ${i + 1}`} className="h-16 w-12 object-cover rounded border border-white/20" />
              <button
                onClick={() => removePage(p.id)}
                className="absolute -top-1.5 -right-1.5 bg-red-600 rounded-full p-0.5"
                aria-label="Supprimer"
              >
                <Trash2 size={10} />
              </button>
              {p.qualityWarning && (
                <span className="absolute bottom-0 left-0 right-0 bg-amber-500/90 text-[8px] text-black text-center py-0.5">
                  ⚠
                </span>
              )}
              {p.enhanced && !p.qualityWarning && (
                <span className="absolute bottom-0 left-0 right-0 bg-emerald-500/90 text-[8px] text-black text-center py-0.5 flex items-center justify-center gap-0.5">
                  <Sparkles size={8} /> redressé
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="px-4 py-4 bg-black/95 border-t border-white/10 safe-bottom">
        <input
          ref={fileFallbackRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple={multiPage}
          onChange={handleFileFallback}
          className="hidden"
        />

        <div className="flex items-center gap-3">
          <button
            onClick={() => fileFallbackRef.current?.click()}
            className="flex flex-col items-center justify-center gap-1 px-3 py-2 text-xs text-white/70 hover:text-white"
            aria-label="Importer"
          >
            <ImagePlus size={22} />
            <span>Importer</span>
          </button>

          <div className="flex-1 flex justify-center">
            <button
              onClick={capture}
              disabled={!cameraReady || capturing || !!cameraError}
              className="relative w-20 h-20 rounded-full border-4 border-white flex items-center justify-center bg-white/10 hover:bg-white/20 disabled:opacity-40 active:scale-95 transition"
              aria-label="Capturer"
            >
              {capturing ? (
                <Loader2 className="animate-spin" size={26} />
              ) : (
                <span className="w-14 h-14 rounded-full bg-white" />
              )}
            </button>
          </div>

          <button
            onClick={validate}
            disabled={pages.length === 0}
            className="flex flex-col items-center justify-center gap-1 px-3 py-2 text-xs font-semibold disabled:opacity-30 text-emerald-300 hover:text-emerald-200"
            aria-label="Valider"
          >
            <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center">
              <Check size={18} />
            </div>
            <span>Valider ({pages.length})</span>
          </button>
        </div>

        {pages.length > 0 && multiPage && (
          <p className="text-[11px] text-center text-white/50 mt-2">
            {pages.length} page{pages.length > 1 ? "s" : ""} · appuyez sur le déclencheur pour ajouter la suivante
          </p>
        )}

        {pages[0]?.qualityWarning && !multiPage && (
          <p className="text-[11px] text-center text-amber-300 mt-2 flex items-center justify-center gap-1">
            <AlertTriangle size={12} /> {pages[0].qualityWarning}
            <button onClick={() => removePage(pages[0].id)} className="ml-2 underline">
              <RotateCcw size={11} className="inline" /> Reprendre
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
