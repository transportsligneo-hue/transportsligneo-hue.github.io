import { useRef } from "react";
import { useAutoplayWithSound } from "@/hooks/useAutoplayWithSound";

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
    <video
      ref={videoRef}
      src={src}
      poster={poster}
      controls
      playsInline
      preload="metadata"
      aria-label={label}
      className={className}
    />
  );
}