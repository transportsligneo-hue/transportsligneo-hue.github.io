import { useRef } from "react";
import { useAutoplayWithSound } from "@/hooks/useAutoplayWithSound";
import { SoundToggle } from "@/components/marketing/SoundToggle";

type Props = {
  src: string;
  poster: string;
  label: string;
  className?: string;
};

/** Shared public film player; each film starts automatically at most once per browser. */
export default function PresentationDemoFilm({ src, poster, label, className }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useAutoplayWithSound(videoRef);

  return (
    <div className="relative">
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        controls
        muted
        playsInline
        preload="metadata"
        aria-label={label}
        className={className}
      />
      <SoundToggle videoRef={videoRef} />
    </div>
  );
}