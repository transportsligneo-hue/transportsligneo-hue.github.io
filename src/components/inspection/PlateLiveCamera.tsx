/**
 * PlateLiveCamera · caméra intégrée avec cadre guide pour photographier une plaque.
 * Le convoyeur place la plaque dans le cadre ; la photo est automatiquement recadrée
 * autour du cadre (la plaque est donc toujours bien visible dans la vignette).
 * Si la caméra n'est pas accessible, on bascule sur l'appareil photo classique.
 */
import { useEffect, useRef, useState } from "react";
import { X, Loader2, Camera } from "lucide-react";

interface Props {
  onCapture: (file: File) => void;
  onClose: () => void;
  /** Caméra indisponible ou refusée → appareil photo du téléphone. */
  onFallback: () => void;
}

export function PlateLiveCamera({ onCapture, onClose, onFallback }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("no-camera");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) { v.srcObject = stream; await v.play().catch(() => undefined); }
        setReady(true);
      } catch {
        if (!cancelled) onFallback();
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shoot = () => {
    const v = videoRef.current;
    const g = guideRef.current;
    if (!v || !g || !v.videoWidth || busy) return;
    setBusy(true);
    const vr = v.getBoundingClientRect();
    const gr = g.getBoundingClientRect();
    const vw = v.videoWidth, vh = v.videoHeight;
    // object-fit: cover → échelle et décalage entre l'écran et l'image réelle
    const s = Math.max(vr.width / vw, vr.height / vh);
    const ox = (vw * s - vr.width) / 2;
    const oy = (vh * s - vr.height) / 2;
    // cadre guide en coordonnées vidéo, élargi pour garder un peu de contexte autour de la plaque
    const cx = (gr.left - vr.left + gr.width / 2 + ox) / s;
    const cy = (gr.top - vr.top + gr.height / 2 + oy) / s;
    let w = (gr.width / s) * 1.22;
    let h = (gr.height / s) * 1.9;
    w = Math.min(w, vw); h = Math.min(h, vh);
    const x = Math.max(0, Math.min(vw - w, cx - w / 2));
    const y = Math.max(0, Math.min(vh - h, cy - h / 2));
    const outW = Math.min(1600, Math.round(w));
    const outH = Math.round((outW * h) / w);
    const c = document.createElement("canvas");
    c.width = outW; c.height = outH;
    c.getContext("2d")?.drawImage(v, x, y, w, h, 0, 0, outW, outH);
    c.toBlob((blob) => {
      setBusy(false);
      if (!blob) return;
      onCapture(new File([blob], `plaque_${Date.now()}.jpg`, { type: "image/jpeg" }));
    }, "image/jpeg", 0.9);
  };

  return (
    <div className="plc">
      <video ref={videoRef} className="plc-video" playsInline muted autoPlay />
      <div className="plc-shade" />
      <div ref={guideRef} className="plc-guide">
        <span className="plc-c tl" /><span className="plc-c tr" /><span className="plc-c bl" /><span className="plc-c br" />
      </div>
      <button type="button" className="plc-x" onClick={onClose} aria-label="Fermer"><X size={20} /></button>
      <p className="plc-tip">Placez la plaque dans le cadre</p>
      <div className="plc-bar">
        <button type="button" className="plc-alt" onClick={onFallback}>Appareil photo classique</button>
        <button type="button" className="plc-shot" onClick={shoot} disabled={!ready || busy} aria-label="Prendre la photo">
          {busy ? <Loader2 size={26} className="animate-spin" /> : <Camera size={26} />}
        </button>
        <span className="plc-alt-sp" />
      </div>
    </div>
  );
}
