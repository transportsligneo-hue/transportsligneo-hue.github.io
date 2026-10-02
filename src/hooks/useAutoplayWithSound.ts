import { useEffect, type RefObject } from "react";

/**
 * Lecture automatique des films de présentation avec le son activé par défaut.
 * Les navigateurs bloquent la lecture avec son sans interaction : on tente
 * d'abord le son, puis on bascule en muet et on réactive le son au premier
 * geste de l'utilisateur (clic, touche, toucher).
 */
export function useAutoplayWithSound(
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean = true,
) {
  useEffect(() => {
    const video = videoRef.current;
    if (!video || typeof IntersectionObserver === "undefined") return;

    let cancelled = false;
    const listeners: Array<[string, EventListener]> = [];

    const addUnmuteListeners = () => {
      const unmute = () => {
        video.muted = false;
        if (video.paused) video.play().catch(() => {});
        // Une fois le son réactivé, on retire tous les écouteurs.
        for (const [type, fn] of listeners) document.removeEventListener(type, fn);
        listeners.length = 0;
      };
      for (const type of ["pointerdown", "touchstart", "keydown"]) {
        document.addEventListener(type, unmute);
        listeners.push([type, unmute]);
      }
    };

    const tryPlay = async () => {
      if (cancelled || video.paused === false) return;
      try {
        video.muted = false;
        await video.play();
      } catch {
        // Lecture avec son refusée : démarrage muet, son au premier geste.
        video.muted = true;
        try {
          await video.play();
        } catch {
          /* rien à faire tant qu'il n'y a pas de geste */
        }
        if (!cancelled) addUnmuteListeners();
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            tryPlay();
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.35 },
    );
    observer.observe(video);

    return () => {
      cancelled = true;
      observer.disconnect();
      for (const [type, fn] of listeners) document.removeEventListener(type, fn);
      listeners.length = 0;
    };
  }, [videoRef, enabled]);
}
