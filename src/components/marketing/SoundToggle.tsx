import { useEffect, useState, type RefObject } from "react";
import { Volume2, VolumeX } from "lucide-react";

/** Petit bouton en haut à gauche d'une vidéo : « Activer le son » / « Couper le son ». */
export function SoundToggle({ videoRef }: { videoRef: RefObject<HTMLVideoElement | null> }) {
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const sync = () => setMuted(v.muted || v.volume === 0);
    sync();
    v.addEventListener("volumechange", sync);
    return () => v.removeEventListener("volumechange", sync);
  }, [videoRef]);

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    if (!v.muted && v.volume === 0) v.volume = 1;
    setMuted(v.muted);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={muted ? "Activer le son" : "Couper le son"}
      aria-pressed={!muted}
      className="absolute left-3 top-3 z-10 inline-flex items-center gap-2 rounded-full border border-white/30 bg-black/55 px-3 py-1.5 text-[12px] font-semibold text-white shadow-lg backdrop-blur transition hover:bg-black/70"
    >
      {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
      {muted ? "Activer le son" : "Son activé"}
    </button>
  );
}
