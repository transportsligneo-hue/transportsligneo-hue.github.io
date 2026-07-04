/**
 * DocumentScanner — capture + recadrage 4 coins + correction de perspective
 * pour scanner proprement un document (PV de livraison, carte grise…).
 *
 * Pipeline :
 *  1. ouverture appareil photo natif (capture="environment")
 *  2. affichage de l'image sur un canvas
 *  3. 4 poignées coins déplaçables (touch + souris)
 *  4. correction de perspective via homographie (résolution Gauss 8x8)
 *  5. renvoie un File JPEG recadré aux dimensions A4 (~1240x1754)
 *
 * Pas de dépendance externe (pas d'OpenCV / pas de WASM).
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { X, ScanLine, RotateCw, Check, Loader2, Camera as CameraIcon } from "lucide-react";
import { toast } from "sonner";

interface Props {
  onCancel: () => void;
  onScanned: (file: File) => void | Promise<void>;
}

interface Pt { x: number; y: number }

const OUT_W = 1240;
const OUT_H = 1754; // ~A4 ratio

/** Résout un système linéaire NxN par élimination de Gauss-Jordan. */
function solveLinear(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < n; i++) {
    // pivot
    let max = Math.abs(M[i][i]);
    let row = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > max) { max = Math.abs(M[k][i]); row = k; }
    }
    if (max < 1e-10) throw new Error("Matrice singulière");
    [M[i], M[row]] = [M[row], M[i]];
    // élimination
    for (let k = 0; k < n; k++) {
      if (k === i) continue;
      const f = M[k][i] / M[i][i];
      for (let j = i; j <= n; j++) M[k][j] -= f * M[i][j];
    }
  }
  return M.map((r, i) => r[n] / r[i]);
}

/**
 * Calcule la matrice d'homographie 3x3 qui mappe 4 points source vers
 * 4 points destination. Retourne [h0..h7], h8=1.
 */
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

/**
 * Applique l'homographie inverse pour chaque pixel de sortie afin
 * d'échantillonner le pixel source correspondant (bilinéaire).
 */
function warpPerspective(srcCanvas: HTMLCanvasElement, corners: Pt[]): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = OUT_W;
  out.height = OUT_H;
  const octx = out.getContext("2d")!;
  const sctx = srcCanvas.getContext("2d")!;
  const srcImg = sctx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
  const dstImg = octx.createImageData(OUT_W, OUT_H);

  // Homographie : pixels destination [0,W]x[0,H] → pixels source (corners)
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

export function DocumentScanner({ onCancel, onScanned }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hasImage, setHasImage] = useState(false);
  const [corners, setCorners] = useState<Pt[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [scale, setScale] = useState(1);
  const [processing, setProcessing] = useState(false);

  // Ouvre tout de suite la caméra
  useEffect(() => {
    const t = setTimeout(() => fileRef.current?.click(), 80);
    return () => clearTimeout(t);
  }, []);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) { onCancel(); return; }

    const img = new Image();
    img.onload = () => {
      const src = document.createElement("canvas");
      // limite max 1600px côté long pour rester fluide
      const maxSide = 1600;
      const ratio = Math.min(1, maxSide / Math.max(img.width, img.height));
      src.width = Math.round(img.width * ratio);
      src.height = Math.round(img.height * ratio);
      src.getContext("2d")!.drawImage(img, 0, 0, src.width, src.height);
      sourceCanvasRef.current = src;

      // Coins par défaut = marge 8% pour suggérer un recadrage
      const m = 0.08;
      setCorners([
        { x: src.width * m, y: src.height * m },
        { x: src.width * (1 - m), y: src.height * m },
        { x: src.width * (1 - m), y: src.height * (1 - m) },
        { x: src.width * m, y: src.height * (1 - m) },
      ]);
      setHasImage(true);
    };
    img.onerror = () => onCancel();
    img.src = URL.createObjectURL(f);
  };

  // Dessine source + polygone + poignées
  const draw = useCallback(() => {
    const src = sourceCanvasRef.current;
    const canvas = previewCanvasRef.current;
    if (!src || !canvas) return;

    // Ajuste taille d'affichage à la largeur du parent
    const parent = canvas.parentElement!;
    const maxW = parent.clientWidth;
    const maxH = Math.min(window.innerHeight * 0.6, 700);
    const s = Math.min(maxW / src.width, maxH / src.height);
    setScale(s);

    canvas.width = src.width * s;
    canvas.height = src.height * s;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(src, 0, 0, canvas.width, canvas.height);

    // Polygone
    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 2;
    ctx.fillStyle = "rgba(212,175,55,0.08)";
    ctx.beginPath();
    corners.forEach((c, i) => {
      const x = c.x * s, y = c.y * s;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Poignées
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

  useEffect(() => { if (hasImage) draw(); }, [hasImage, draw]);
  useEffect(() => {
    const onResize = () => { if (hasImage) draw(); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [hasImage, draw]);

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
    // hit area ~30px / scale
    if (Math.sqrt(bestD) * scale < 40) setDragIdx(best);
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

  const reset = () => {
    setHasImage(false);
    sourceCanvasRef.current = null;
    setTimeout(() => fileRef.current?.click(), 50);
  };

  const validate = async () => {
    if (!sourceCanvasRef.current) return;
    setProcessing(true);
    try {
      // Vérifie ordre des coins (TL, TR, BR, BL) — tri par angle autour du centre
      const cx = corners.reduce((s, p) => s + p.x, 0) / 4;
      const cy = corners.reduce((s, p) => s + p.y, 0) / 4;
      const sorted = [...corners]
        .map((p) => ({ p, a: Math.atan2(p.y - cy, p.x - cx) }))
        .sort((a, b) => a.a - b.a)
        .map((o) => o.p);
      // sorted commence en haut-gauche/haut-droite selon orientation : on remet TL en premier
      // en cherchant le point avec (x+y) minimal
      let startIdx = 0, min = Infinity;
      sorted.forEach((p, i) => { const s = p.x + p.y; if (s < min) { min = s; startIdx = i; } });
      const ordered = [...sorted.slice(startIdx), ...sorted.slice(0, startIdx)];

      const out = warpPerspective(sourceCanvasRef.current, ordered);
      const blob: Blob = await new Promise((res, rej) =>
        out.toBlob((b) => b ? res(b) : rej(new Error("toBlob failed")), "image/jpeg", 0.9)!);
      const file = new File([blob], `scan-${Date.now()}.jpg`, { type: "image/jpeg" });
      await Promise.resolve(onScanned(file));
    } catch (err) {
      console.error("[DocumentScanner]", err);
      toast.error("Recadrage impossible. Réessayez en élargissant les coins.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#0b1026] flex flex-col">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="hidden"
      />

      <header className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <button onClick={onCancel} className="p-2 -ml-2 text-white/80 hover:text-white">
          <X size={20} />
        </button>
        <div className="flex items-center gap-2 text-[#d4af37]">
          <ScanLine size={18} />
          <span className="text-sm font-semibold">Scanner un document</span>
        </div>
        <div className="w-9" />
      </header>

      <div className="flex-1 overflow-hidden flex flex-col">
        {!hasImage ? (
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
        ) : (
          <>
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

            <div className="grid grid-cols-2 gap-2 p-3 border-t border-white/10 safe-bottom">
              <button
                onClick={reset}
                disabled={processing}
                className="h-12 rounded-xl bg-white/10 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <RotateCw size={16} /> Reprendre
              </button>
              <button
                onClick={validate}
                disabled={processing}
                className="h-12 rounded-xl bg-[#d4af37] text-[#0b1026] font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {processing ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Valider le scan
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
