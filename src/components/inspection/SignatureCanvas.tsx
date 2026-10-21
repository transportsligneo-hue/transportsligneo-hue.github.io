/**
 * SignatureCanvas · Capture tactile de la signature client.
 *
 * - Trait fluide (pointer events, marche au doigt et à la souris)
 * - Bouton Effacer + Valider
 * - Renvoie un File PNG prêt à uploader (toBlob)
 * - Aucun état parasite, démontable en sécurité
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, Check, PenLine, Loader2 } from "lucide-react";
import "@/styles/driver-v2.css";

interface Props {
  onValidate: (file: File) => void;
  disabled?: boolean;
  /** Libellé du bouton de validation. */
  validateLabel?: string;
}

export function SignatureCanvas({ onValidate, disabled, validateLabel = "Valider la signature" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(false);
  const sentRef = useRef(false);

  // Resize canvas to its container, with HiDPI support
  const resize = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const parent = c.parentElement;
    if (!parent) return;
    const ratio = window.devicePixelRatio || 1;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    const nextW = Math.round(w * ratio);
    const nextH = Math.round(h * ratio);
    // Le redimensionnement du canvas efface son contenu : on ne le fait QUE si
    // les dimensions changent réellement (scroll / ouverture clavier mobile
    // déclenchent des events resize sans changement utile), et on restaure
    // toujours le tracé existant.
    if (c.width === nextW && c.height === nextH) return;

    let snapshot: HTMLCanvasElement | null = null;
    if (c.width > 0 && c.height > 0) {
      snapshot = document.createElement("canvas");
      snapshot.width = c.width;
      snapshot.height = c.height;
      snapshot.getContext("2d")?.drawImage(c, 0, 0);
    }

    c.width = nextW;
    c.height = nextH;
    c.style.width = `${w}px`;
    c.style.height = `${h}px`;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, nextW, nextH);
    if (snapshot) ctx.drawImage(snapshot, 0, 0, nextW, nextH);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0b2a1f";
    ctx.lineWidth = 2.6;
  }, []);

  useEffect(() => {
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);
    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
    };
  }, [resize]);


  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    // Referme le clavier (champ « nom ») avant de signer : évite que la page se décale en plein tracé.
    const ae = document.activeElement as HTMLElement | null;
    if (ae && ae !== document.body && typeof ae.blur === "function") ae.blur();
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = pos(e);
    last.current = p;
    // Un simple point compte déjà comme signature (plus de bouton « grisé » inexplicable).
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.3, 0, Math.PI * 2);
      ctx.fillStyle = "#0b2a1f";
      ctx.fill();
    }
    setHasInk(true);
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
  };
  const onUp = () => {
    drawing.current = false;
    last.current = null;
  };

  /** Effacement EXPLICITE uniquement (bouton « Effacer »). */
  const clear = () => {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const ratio = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    setHasInk(false);
    sentRef.current = false;
  };


  const validate = () => {
    const c = canvasRef.current;
    if (!c || !hasInk || disabled || sentRef.current) return;
    sentRef.current = true; // un seul envoi, même si on touche plusieurs fois
    c.toBlob((blob) => {
      if (!blob) { sentRef.current = false; return; }
      const file = new File([blob], `signature_${Date.now()}.png`, { type: "image/png" });
      onValidate(file);
      // si l'envoi échoue, le parent remonte le composant ; sinon on réarme après un court délai
      setTimeout(() => { sentRef.current = false; }, 1500);
    }, "image/png", 0.92);
  };

  return (
    <div className="sigx">
      <div className="sigx-card">
        <div className="sigx-area">
          <canvas
            ref={canvasRef}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            className="sigx-canvas"
          />
          <span className="sigx-line" aria-hidden />
          <span className="sigx-x" aria-hidden>✕</span>
          {!hasInk && (
            <div className="sigx-ph">
              <PenLine size={22} />
              <p>Signez ici avec le doigt</p>
            </div>
          )}
        </div>
        <div className="sigx-bar">
          <span>Signature manuscrite</span>
          <button type="button" onClick={clear} disabled={!hasInk || disabled} className="sigx-clear">
            <Eraser size={14} /> Effacer
          </button>
        </div>
      </div>
      <button type="button" onClick={validate} disabled={!hasInk || disabled} className="sigx-ok">
        {disabled ? <><Loader2 size={18} className="animate-spin" /> Enregistrement…</> : <><Check size={18} strokeWidth={3} /> {validateLabel}</>}
      </button>
    </div>
  );
}
