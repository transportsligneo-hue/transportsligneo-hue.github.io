/**
 * DocumentScanner · scanner intelligent de documents (carte grise, PV livraison, PV restitution).
 *
 * API STABLE (ne pas changer) :
 *   props: { onCancel(), onScanned(file: File) }
 *   sortie: File JPEG haute qualité prêt à uploader.
 *
 * Améliorations vs version précédente :
 *  - Flux caméra live (getUserMedia) avec cadre guide + capture manuelle
 *  - Auto-capture par détection de stabilité (frames peu variantes pendant ~800ms)
 *  - Torch (flash) si supporté
 *  - Fallback natif <input capture="environment"> si getUserMedia indisponible (iOS PWA, permissions)
 *  - Recadrage 4 coins (auto-init 6% marges) + correction de perspective (homographie)
 *  - Rotation ±90° avant recadrage
 *  - Post-traitement : contraste étiré + unsharp mask léger + gamma → document net, lisible, prêt PDF/archivage
 *  - Sortie ratio A4 (1240x1754) JPEG q=0.92
 *
 * Aucune dépendance externe. Aucun changement de workflow métier / stockage / PDF.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  X, ScanLine, RotateCw, Check, Loader2, Camera as CameraIcon,
  Zap, ZapOff, Sparkles, RefreshCw,
} from "lucide-react";

interface Props {
  onCancel: () => void;
  onScanned: (file: File) => void | Promise<void>;
}

interface Pt { x: number; y: number }

const OUT_W = 1240;
const OUT_H = 1754; // A4
const AUTO_STABLE_MS = 800;
const AUTO_DIFF_THRESHOLD = 6; // moyenne différence luminance/pixel pour "stable"

/* ─────────────────────── Géométrie / homographie ─────────────────────── */

function solveLinear(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < n; i++) {
    let max = Math.abs(M[i][i]);
    let row = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > max) { max = Math.abs(M[k][i]); row = k; }
    }
    if (max < 1e-10) throw new Error("Matrice singulière");
    [M[i], M[row]] = [M[row], M[i]];
    for (let k = 0; k < n; k++) {
      if (k === i) continue;
      const f = M[k][i] / M[i][i];
      for (let j = i; j <= n; j++) M[k][j] -= f * M[i][j];
    }
  }
  return M.map((r, i) => r[n] / r[i]);
}

function computeHomography(src: Pt[], dst: Pt[]): number[] {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x: sx, y: sy } = src[i];
    const { x: dx, y: dy } = dst[i];
    A.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]);
    b.push(dx);
    A.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]);
    b.push(dy);
  }
  return solveLinear(A, b);
}

function warpPerspective(srcCanvas: HTMLCanvasElement, corners: Pt[]): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = OUT_W;
  out.height = OUT_H;
  const octx = out.getContext("2d")!;
  const sctx = srcCanvas.getContext("2d")!;
  const srcImg = sctx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
  const dstImg = octx.createImageData(OUT_W, OUT_H);
  const dst: Pt[] = [
    { x: 0, y: 0 },
    { x: OUT_W - 1, y: 0 },
    { x: OUT_W - 1, y: OUT_H - 1 },
    { x: 0, y: OUT_H - 1 },
  ];
  const h = computeHomography(dst, corners);
  const sw = srcCanvas.width, sh = srcCanvas.height;
  const sData = srcImg.data;
  const dData = dstImg.data;
  for (let y = 0; y < OUT_H; y++) {
    for (let x = 0; x < OUT_W; x++) {
      const denom = h[6] * x + h[7] * y + 1;
      const sx = (h[0] * x + h[1] * y + h[2]) / denom;
      const sy = (h[3] * x + h[4] * y + h[5]) / denom;
      const di = (y * OUT_W + x) * 4;
      if (sx < 0 || sy < 0 || sx >= sw - 1 || sy >= sh - 1) {
        dData[di] = 255; dData[di + 1] = 255; dData[di + 2] = 255; dData[di + 3] = 255;
        continue;
      }
      const x0 = sx | 0, y0 = sy | 0;
      const dx = sx - x0, dy = sy - y0;
      const i00 = (y0 * sw + x0) * 4;
      const i10 = i00 + 4;
      const i01 = i00 + sw * 4;
      const i11 = i01 + 4;
      const w00 = (1 - dx) * (1 - dy);
      const w10 = dx * (1 - dy);
      const w01 = (1 - dx) * dy;
      const w11 = dx * dy;
      for (let c = 0; c < 3; c++) {
        dData[di + c] =
          sData[i00 + c] * w00 +
          sData[i10 + c] * w10 +
          sData[i01 + c] * w01 +
          sData[i11 + c] * w11;
      }
      dData[di + 3] = 255;
    }
  }
  octx.putImageData(dstImg, 0, 0);
  return out;
}

/* ─────────────────────── Post-traitement document ─────────────────────── */

/**
 * Enhancement doux orienté document :
 *  - étirement de contraste (percentiles 2/98)
 *  - correction gamma légère (0.95)
 *  - unsharp mask très léger pour netteté sans halos
 * Ne fait pas de binarisation : préserve les tampons/couleurs du PV.
 */
function enhanceDocument(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d")!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const n = d.length;

  // Histogramme luminance
  const hist = new Uint32Array(256);
  for (let i = 0; i < n; i += 4) {
    const lum = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 | 0;
    hist[lum]++;
  }
  const total = (n / 4) | 0;
  const lowC = total * 0.02, highC = total * 0.98;
  let acc = 0, lo = 0, hi = 255;
  for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= lowC) { lo = i; break; } }
  acc = 0;
  for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc >= (total - highC)) { hi = i; break; } }
  if (hi - lo < 20) { lo = 0; hi = 255; }
  const range = hi - lo;
  const gamma = 0.92;
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) {
    let v = (i - lo) / range;
    v = Math.max(0, Math.min(1, v));
    v = Math.pow(v, gamma);
    lut[i] = (v * 255) | 0;
  }
  for (let i = 0; i < n; i += 4) {
    d[i] = lut[d[i]];
    d[i + 1] = lut[d[i + 1]];
    d[i + 2] = lut[d[i + 2]];
  }
  ctx.putImageData(img, 0, 0);

  // Unsharp mask léger : blur puis mix (1+a)·src − a·blur
  const blur = document.createElement("canvas");
  blur.width = canvas.width; blur.height = canvas.height;
  const bctx = blur.getContext("2d")!;
  bctx.filter = "blur(1.2px)";
  bctx.drawImage(canvas, 0, 0);
  bctx.filter = "none";
  const bImg = bctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const sharpImg = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const s = sharpImg.data;
  const a = 0.35;
  for (let i = 0; i < s.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const v = (1 + a) * s[i + c] - a * bImg[i + c];
      s[i + c] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
  }
  ctx.putImageData(sharpImg, 0, 0);
}

/* ─────────────────────── Composant ─────────────────────── */

type Mode = "live" | "review";

export function DocumentScanner({ onCancel, onScanned }: Props) {
  // fallback natif
  const fileRef = useRef<HTMLInputElement>(null);
  // caméra live
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const rafRef = useRef<number | null>(null);
  const stableSinceRef = useRef<number | null>(null);
  const prevFrameRef = useRef<ImageData | null>(null);
  const [liveReady, setLiveReady] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [autoCapture, setAutoCapture] = useState(true);
  const [stability, setStability] = useState(0); // 0..1
  const [useNativeFallback, setUseNativeFallback] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // review
  const [mode, setMode] = useState<Mode>("live");
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [corners, setCorners] = useState<Pt[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [scale, setScale] = useState(1);
  const [processing, setProcessing] = useState(false);

  /* ── caméra live ── */
  const stopStream = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    prevFrameRef.current = null;
    stableSinceRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      trackRef.current = null;
    }
  }, []);

  const startStream = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setUseNativeFallback(true);
      setTimeout(() => fileRef.current?.click(), 60);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      trackRef.current = track;
      const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
      setTorchSupported(!!caps.torch);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
        setLiveReady(true);
      }
    } catch (err) {
      console.warn("[DocumentScanner] getUserMedia refusée, fallback natif", err);
      setInitError("Permission caméra refusée");
      setUseNativeFallback(true);
      setTimeout(() => fileRef.current?.click(), 60);
    }
  }, []);

  useEffect(() => {
    if (mode === "live" && !useNativeFallback) startStream();
    return () => { stopStream(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // torch
  useEffect(() => {
    const track = trackRef.current;
    if (!track || !torchSupported) return;
    (async () => {
      try {
        await track.applyConstraints({
          advanced: [{ torch: torchOn } as unknown as MediaTrackConstraintSet],
        });
      } catch { /* noop */ }
    })();
  }, [torchOn, torchSupported]);

  // détection de stabilité (auto-capture)
  useEffect(() => {
    if (!liveReady || mode !== "live") return;
    const video = videoRef.current;
    if (!video) return;
    const small = document.createElement("canvas");
    small.width = 160; small.height = 90;
    const sctx = small.getContext("2d", { willReadFrequently: true })!;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      if (video.readyState >= 2) {
        sctx.drawImage(video, 0, 0, small.width, small.height);
        const cur = sctx.getImageData(0, 0, small.width, small.height);
        const prev = prevFrameRef.current;
        if (prev) {
          let diff = 0;
          const a = cur.data, b = prev.data;
          for (let i = 0; i < a.length; i += 4) {
            const la = (a[i] + a[i + 1] + a[i + 2]) / 3;
            const lb = (b[i] + b[i + 1] + b[i + 2]) / 3;
            diff += Math.abs(la - lb);
          }
          diff /= (a.length / 4);
          const stable = diff < AUTO_DIFF_THRESHOLD;
          if (stable) {
            if (stableSinceRef.current == null) stableSinceRef.current = performance.now();
            const held = performance.now() - stableSinceRef.current;
            setStability(Math.min(1, held / AUTO_STABLE_MS));
            if (autoCapture && held >= AUTO_STABLE_MS) {
              captureFromVideo();
              return;
            }
          } else {
            stableSinceRef.current = null;
            setStability(0);
          }
        }
        prevFrameRef.current = cur;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { cancelled = true; if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveReady, mode, autoCapture]);

  const captureFromVideo = () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) return;
    const src = document.createElement("canvas");
    const maxSide = 1800;
    const ratio = Math.min(1, maxSide / Math.max(vw, vh));
    src.width = Math.round(vw * ratio);
    src.height = Math.round(vh * ratio);
    src.getContext("2d")!.drawImage(video, 0, 0, src.width, src.height);
    stopStream();
    setLiveReady(false);
    goToReview(src);
  };

  const goToReview = (src: HTMLCanvasElement) => {
    sourceCanvasRef.current = src;
    const m = 0.06;
    setCorners([
      { x: src.width * m, y: src.height * m },
      { x: src.width * (1 - m), y: src.height * m },
      { x: src.width * (1 - m), y: src.height * (1 - m) },
      { x: src.width * m, y: src.height * (1 - m) },
    ]);
    setMode("review");
  };

  /* ── fallback natif ── */
  const handleNativeFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) { onCancel(); return; }
    const img = new Image();
    img.onload = () => {
      const src = document.createElement("canvas");
      const maxSide = 1800;
      const ratio = Math.min(1, maxSide / Math.max(img.width, img.height));
      src.width = Math.round(img.width * ratio);
      src.height = Math.round(img.height * ratio);
      src.getContext("2d")!.drawImage(img, 0, 0, src.width, src.height);
      goToReview(src);
    };
    img.onerror = () => onCancel();
    img.src = URL.createObjectURL(f);
  };

  /* ── review : dessin poignées ── */
  const draw = useCallback(() => {
    const src = sourceCanvasRef.current;
    const canvas = previewCanvasRef.current;
    if (!src || !canvas) return;
    const parent = canvas.parentElement!;
    const maxW = parent.clientWidth;
    const maxH = Math.min(window.innerHeight * 0.58, 700);
    const s = Math.min(maxW / src.width, maxH / src.height);
    setScale(s);
    canvas.width = src.width * s;
    canvas.height = src.height * s;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 2;
    ctx.fillStyle = "rgba(212,175,55,0.10)";
    ctx.beginPath();
    corners.forEach((c, i) => {
      const x = c.x * s, y = c.y * s;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    corners.forEach((c) => {
      const x = c.x * s, y = c.y * s;
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.fillStyle = "#0b1026";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#d4af37";
      ctx.stroke();
    });
  }, [corners]);

  useEffect(() => { if (mode === "review") draw(); }, [mode, draw]);
  useEffect(() => {
    const onResize = () => { if (mode === "review") draw(); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [mode, draw]);

  const pointFromEvent = (e: React.PointerEvent<HTMLCanvasElement>): Pt => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale };
  };
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pointFromEvent(e);
    let best = -1, bestD = Infinity;
    corners.forEach((c, i) => {
      const d = (c.x - p.x) ** 2 + (c.y - p.y) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    });
    if (Math.sqrt(bestD) * scale < 44) setDragIdx(best);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragIdx === null) return;
    const src = sourceCanvasRef.current!;
    const p = pointFromEvent(e);
    setCorners((prev) => prev.map((c, i) => i === dragIdx
      ? { x: Math.max(0, Math.min(src.width, p.x)), y: Math.max(0, Math.min(src.height, p.y)) }
      : c));
  };
  const onPointerUp = () => setDragIdx(null);

  const rotate90 = () => {
    const src = sourceCanvasRef.current;
    if (!src) return;
    const rot = document.createElement("canvas");
    rot.width = src.height;
    rot.height = src.width;
    const ctx = rot.getContext("2d")!;
    ctx.translate(rot.width, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(src, 0, 0);
    sourceCanvasRef.current = rot;
    // repositionne les coins par rotation aussi
    setCorners((prev) => prev.map((p) => ({ x: src.height - p.y, y: p.x })));
  };

  const retake = () => {
    sourceCanvasRef.current = null;
    setCorners([]);
    setMode("live");
    // stream redémarre via useEffect
  };

  const validate = async () => {
    if (!sourceCanvasRef.current) return;
    setProcessing(true);
    try {
      const cx = corners.reduce((s, p) => s + p.x, 0) / 4;
      const cy = corners.reduce((s, p) => s + p.y, 0) / 4;
      const sorted = [...corners]
        .map((p) => ({ p, a: Math.atan2(p.y - cy, p.x - cx) }))
        .sort((a, b) => a.a - b.a)
        .map((o) => o.p);
      let startIdx = 0, min = Infinity;
      sorted.forEach((p, i) => { const s = p.x + p.y; if (s < min) { min = s; startIdx = i; } });
      const ordered = [...sorted.slice(startIdx), ...sorted.slice(0, startIdx)];

      const warped = warpPerspective(sourceCanvasRef.current, ordered);
      enhanceDocument(warped);
      const blob: Blob = await new Promise((res, rej) =>
        warped.toBlob((b) => b ? res(b) : rej(new Error("toBlob failed")), "image/jpeg", 0.92)!);
      const file = new File([blob], `scan-${Date.now()}.jpg`, { type: "image/jpeg" });
      await Promise.resolve(onScanned(file));
    } catch (err) {
      console.error("[DocumentScanner]", err);
      toast.error("Recadrage impossible. Réessayez en élargissant les coins.");
    } finally {
      setProcessing(false);
    }
  };

  /* ─────────────────── RENDER ─────────────────── */
  return (
    <div className="fixed inset-0 z-[100] bg-[#0b1026] flex flex-col">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleNativeFile}
        className="hidden"
      />

      <header className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
        <button onClick={() => { stopStream(); onCancel(); }} className="p-2 -ml-2 text-white/80 hover:text-white">
          <X size={20} />
        </button>
        <div className="flex items-center gap-2 text-[#d4af37]">
          <ScanLine size={18} />
          <span className="text-sm font-semibold">
            {mode === "live" ? "Scanner un document" : "Ajuster & valider"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {mode === "live" && torchSupported && (
            <button
              onClick={() => setTorchOn((v) => !v)}
              className="p-2 text-white/80 hover:text-white"
              aria-label="Flash"
            >
              {torchOn ? <Zap size={18} className="text-[#d4af37]" /> : <ZapOff size={18} />}
            </button>
          )}
        </div>
      </header>

      {/* LIVE */}
      {mode === "live" && !useNativeFallback && (
        <div className="flex-1 relative overflow-hidden bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* overlay guide */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="relative w-[86%] aspect-[1/1.414] max-h-[70%]">
              {/* frame */}
              <div
                className="absolute inset-0 rounded-xl border-2 transition-colors duration-200"
                style={{
                  borderColor: stability > 0.6 ? "#22c55e" : "#d4af37",
                  boxShadow: stability > 0.6
                    ? "0 0 0 9999px rgba(0,0,0,0.55), 0 0 24px rgba(34,197,94,0.5)"
                    : "0 0 0 9999px rgba(0,0,0,0.55)",
                }}
              />
              {/* coins */}
              {["tl","tr","bl","br"].map((k) => (
                <span
                  key={k}
                  className="absolute w-8 h-8 border-[#d4af37]"
                  style={{
                    top: k[0] === "t" ? -2 : "auto",
                    bottom: k[0] === "b" ? -2 : "auto",
                    left: k[1] === "l" ? -2 : "auto",
                    right: k[1] === "r" ? -2 : "auto",
                    borderTopWidth: k[0] === "t" ? 4 : 0,
                    borderBottomWidth: k[0] === "b" ? 4 : 0,
                    borderLeftWidth: k[1] === "l" ? 4 : 0,
                    borderRightWidth: k[1] === "r" ? 4 : 0,
                    borderRadius: 6,
                  }}
                />
              ))}
            </div>
          </div>

          {/* état */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur text-white text-xs flex items-center gap-2">
            {!liveReady ? (
              <><Loader2 size={12} className="animate-spin" /> Ouverture caméra…</>
            ) : autoCapture ? (
              stability > 0.6
                ? <><Sparkles size={12} className="text-emerald-400" /> Capture…</>
                : <><ScanLine size={12} /> Positionnez le document</>
            ) : (
              <><CameraIcon size={12} /> Capture manuelle</>
            )}
          </div>

          {/* jauge stabilité */}
          {liveReady && autoCapture && (
            <div className="absolute top-12 left-1/2 -translate-x-1/2 w-32 h-1 rounded-full bg-white/15 overflow-hidden">
              <div
                className="h-full transition-all duration-100"
                style={{
                  width: `${stability * 100}%`,
                  background: stability > 0.6 ? "#22c55e" : "#d4af37",
                }}
              />
            </div>
          )}

          {/* barre bas : auto/manuel + capture + fallback */}
          <div className="absolute inset-x-0 bottom-0 pb-[max(env(safe-area-inset-bottom),14px)] pt-4 px-6 bg-gradient-to-t from-black/85 to-transparent">
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => setAutoCapture((v) => !v)}
                className={`px-3 h-11 rounded-full text-xs font-semibold border transition ${
                  autoCapture
                    ? "bg-[#d4af37] text-[#0b1026] border-[#d4af37]"
                    : "bg-white/10 text-white border-white/20"
                }`}
              >
                Auto {autoCapture ? "ON" : "OFF"}
              </button>

              <button
                onClick={captureFromVideo}
                disabled={!liveReady}
                aria-label="Prendre la photo"
                className="relative w-[72px] h-[72px] rounded-full bg-white flex items-center justify-center shadow-2xl disabled:opacity-50 active:scale-95 transition"
              >
                <span className="w-[58px] h-[58px] rounded-full border-4 border-[#0b1026]" />
              </button>

              <button
                onClick={() => { stopStream(); setUseNativeFallback(true); setTimeout(() => fileRef.current?.click(), 60); }}
                className="px-3 h-11 rounded-full text-xs font-semibold bg-white/10 text-white border border-white/20"
                title="Utiliser l'appareil photo natif"
              >
                <RefreshCw size={14} />
              </button>
            </div>
            {initError && (
              <p className="text-center text-white/60 text-[11px] mt-2">{initError}</p>
            )}
          </div>
        </div>
      )}

      {/* fallback natif (en attente du picker) */}
      {mode === "live" && useNativeFallback && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-white/70 px-6 text-center">
          <CameraIcon size={48} className="text-[#d4af37]" />
          <p className="text-sm">Ouverture de l'appareil photo…</p>
          <button
            onClick={() => fileRef.current?.click()}
            className="mt-2 px-5 py-3 rounded-xl bg-[#d4af37] text-[#0b1026] font-semibold"
          >
            Ouvrir l'appareil photo
          </button>
        </div>
      )}

      {/* REVIEW */}
      {mode === "review" && (
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-auto p-3 flex items-center justify-center">
            <canvas
              ref={previewCanvasRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className="touch-none rounded-lg shadow-2xl border border-white/10"
              style={{ maxWidth: "100%" }}
            />
          </div>

          <p className="text-center text-white/60 text-xs px-4 pb-2">
            Glissez les 4 coins pour ajuster aux bords du document.
          </p>

          <div className="grid grid-cols-3 gap-2 p-3 border-t border-white/10 pb-[max(env(safe-area-inset-bottom),12px)] shrink-0">
            <button
              onClick={retake}
              disabled={processing}
              className="h-12 rounded-xl bg-white/10 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <RotateCw size={16} /> Reprendre
            </button>
            <button
              onClick={rotate90}
              disabled={processing}
              className="h-12 rounded-xl bg-white/10 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <RotateCw size={16} /> 90°
            </button>
            <button
              onClick={validate}
              disabled={processing}
              className="h-12 rounded-xl bg-[#d4af37] text-[#0b1026] font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {processing ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Valider
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
