import { useEffect, type RefObject } from "react";

/**
 * Lecture automatique une seule fois par vidéo et par navigateur, TOUJOURS SANS SON.
 * Le visiteur active le son lui-même avec le bouton « Activer le son » (voir SoundToggle)
 * ou avec les commandes de la vidéo.
 */
export function useAutoplayWithSound(
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean = true,
) {
  useEffect(() => {
    const video = videoRef.current;
    if (!enabled || !video || typeof IntersectionObserver === "undefined") return;

    video.muted = true; // jamais de son à l'arrivée sur la page
    let cancelled = false;
    let visible = false;
    let pending = false;
    const storageKey = `ligneo:film-autoplayed:${video.getAttribute("src") ?? video.currentSrc}`;
    let alreadyStarted = false;
    try {
      alreadyStarted = localStorage.getItem(storageKey) === "1";
    } catch {
      // La lecture reste possible si le stockage du navigateur est indisponible.
    }
    const listeners: Array<[string, EventListener]> = [];
    const clearListeners = () => {
      for (const [type, fn] of listeners) document.removeEventListener(type, fn);
      listeners.length = 0;
    };
    const markStarted = () => {
      alreadyStarted = true;
      try {
        localStorage.setItem(storageKey, "1");
      } catch {
        // Le garde-fou en mémoire suffit pour cette visite de la page.
      }
    };

    const tryPlay = async () => {
      if (cancelled || alreadyStarted || pending || !video.paused) return;
      pending = true;
      try {
        video.muted = true;
        await video.play();
        if (!cancelled) markStarted();
      } catch {
        /* rien à faire tant qu'il n'y a pas de geste */
      } finally {
        pending = false;
        if (!visible) video.pause();
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            visible = true;
            tryPlay();
          } else {
            visible = false;
            video.pause();
            clearListeners();
          }
        });
      },
      { threshold: 0.35 },
    );
    observer.observe(video);

    return () => {
      cancelled = true;
      observer.disconnect();
      clearListeners();
    };
  }, [videoRef, enabled]);
}
