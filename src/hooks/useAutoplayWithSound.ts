import { useEffect, type RefObject } from "react";

/**
 * Lecture automatique une seule fois par vidéo et par navigateur,
 * avec le son activé par défaut. La lecture manuelle reste disponible ensuite.
 * Les navigateurs bloquent la lecture avec son sans interaction : on tente
 * d'abord le son, puis on bascule en muet et on réactive le son au premier
 * geste de l'utilisateur tant que le film est visible.
 */
export function useAutoplayWithSound(
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean = true,
) {
  useEffect(() => {
    const video = videoRef.current;
    if (!enabled || !video || typeof IntersectionObserver === "undefined") return;

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

    const addUnmuteListeners = () => {
      const unmute = () => {
        if (cancelled || !visible) return;
        video.muted = false;
        clearListeners();
      };
      for (const type of ["pointerdown", "touchstart", "keydown"]) {
        document.addEventListener(type, unmute);
        listeners.push([type, unmute]);
      }
    };

    const tryPlay = async () => {
      if (cancelled || alreadyStarted || pending || !video.paused) return;
      pending = true;
      try {
        video.muted = false;
        await video.play();
        if (!cancelled) markStarted();
      } catch {
        if (cancelled || !visible) return;
        // Lecture avec son refusée : démarrage muet, son au premier geste.
        video.muted = true;
        try {
          await video.play();
          if (!cancelled) {
            markStarted();
            addUnmuteListeners();
          }
        } catch {
          /* rien à faire tant qu'il n'y a pas de geste */
        }
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
