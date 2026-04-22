/**
 * SignatureCanvas — Capture tactile de la signature client.
 *
 * - Trait fluide (pointer events, marche au doigt et à la souris)
 * - Bouton Effacer + Valider
 * - Renvoie un File PNG prêt à uploader (toBlob)
 * - Aucun état parasite, démontable en sécurité
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, Check } from "lucide-react";

interface Props {
  onValidate: (file: File) => void;
  disabled?: boolean;
}

export function SignatureCanvas({ onValidate, disabled }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(false);

  // Resize canvas to its container, with HiDPI support
  const resize = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const parent = c.parentElement;
    if (!parent) return;
    const ratio = window.devicePixelRatio || 1;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    c.width = w * ratio;
    c.height = h * ratio;
    c.style.width = `${w}px`;
    c.style.height = `${h}px`;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2.4;
  }, []);

  useEffect(() => {
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [resize]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = pos(e);
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !last.current) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (!hasInk) setHasInk(true);
  };
  const onUp = () => {
    drawing.current = false;
    last.current = null;
  };

  const clear = () => {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    setHasInk(false);
  };

  const validate = () => {
    const c = canvasRef.current;
    if (!c || !hasInk) return;
    c.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `signature_${Date.now()}.png`, { type: "image/png" });
      onValidate(file);
    }, "image/png", 0.92);
  };

  return (
    <div className="space-y-3">
      <div className="bg-white border-2 border-dashed border-pro-border rounded-2xl overflow-hidden shadow-sm">
        <div className="relative h-56 sm:h-64 touch-none">
          <canvas
            ref={canvasRef}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onPointerLeave={onUp}
            className="absolute inset-0 w-full h-full bg-white cursor-crosshair touch-none"
          />
          {!hasInk && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <p className="text-pro-muted text-sm font-medium select-none">
                Signez ici avec le doigt
              </p>
            </div>
          )}
        </div>
        <div className="border-t border-pro-border px-3 py-2 flex items-center justify-between bg-pro-bg-soft/40">
          <span className="text-[11px] text-pro-muted">
            Le client signe directement sur l'écran
          </span>
          <button
            type="button"
            onClick={clear}
            disabled={!hasInk || disabled}
            className="flex items-center gap-1 text-xs text-pro-text-soft hover:text-pro-text disabled:opacity-30 px-2 py-1"
          >
            <Eraser size={12} /> Effacer
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={validate}
        disabled={!hasInk || disabled}
        className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-40 transition shadow-sm"
      >
        <Check size={16} /> Valider la signature
      </button>
    </div>
  );
}
