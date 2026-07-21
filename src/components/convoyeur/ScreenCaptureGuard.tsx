/**
 * ScreenCaptureGuard · protection best-effort contre les captures d'écran
 * dans l'app convoyeur (paramétrable via app_settings.driver_screen_protection).
 *
 * Limite importante : aucun site web ne peut réellement bloquer une capture
 * système (iOS/Android/Windows). Ce composant :
 *  - désactive la sélection de texte, le glisser-déposer d'images, le clic droit
 *  - bloque les raccourcis d'impression (Ctrl/Cmd+P, Ctrl/Cmd+Shift+S)
 *  - floute le contenu quand l'onglet passe en arrière-plan / perd le focus
 *    (heuristique classique déclenchée par le sélecteur de captures iOS/Android)
 *  - applique une media query print pour masquer le contenu à l'impression
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function ScreenCaptureGuard() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "driver_screen_protection")
        .maybeSingle();
      if (cancelled) return;
      const v = data?.value as { enabled?: boolean } | null;
      setEnabled(!!v?.enabled);
    })();

    const channel = supabase
      .channel("app-settings-screen-protection")
      .on("postgres_changes", {
        event: "*", schema: "public", table: "app_settings",
        filter: "key=eq.driver_screen_protection",
      }, (payload) => {
        const v = (payload.new as { value?: { enabled?: boolean } } | null)?.value;
        setEnabled(!!v?.enabled);
      })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    document.body.classList.add("driver-no-capture");

    const blockContext = (e: Event) => e.preventDefault();
    const blockKeys = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && (k === "p" || k === "s")) {
        e.preventDefault();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (k === "s" || k === "3" || k === "4" || k === "5")) {
        e.preventDefault();
      }
    };
    const onVisibility = () => {
      if (document.hidden) document.body.classList.add("driver-capture-blur");
      else setTimeout(() => document.body.classList.remove("driver-capture-blur"), 250);
    };
    const onBlur = () => document.body.classList.add("driver-capture-blur");
    const onFocus = () => document.body.classList.remove("driver-capture-blur");

    document.addEventListener("contextmenu", blockContext);
    document.addEventListener("dragstart", blockContext);
    document.addEventListener("keydown", blockKeys);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);

    return () => {
      document.body.classList.remove("driver-no-capture");
      document.body.classList.remove("driver-capture-blur");
      document.removeEventListener("contextmenu", blockContext);
      document.removeEventListener("dragstart", blockContext);
      document.removeEventListener("keydown", blockKeys);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <style>{`
      body.driver-no-capture, body.driver-no-capture * {
        -webkit-user-select: none;
        user-select: none;
        -webkit-touch-callout: none;
      }
      body.driver-no-capture img,
      body.driver-no-capture video,
      body.driver-no-capture canvas {
        -webkit-user-drag: none;
      }
      body.driver-capture-blur {
        filter: blur(24px) brightness(0.6) !important;
        transition: filter 120ms ease;
      }
      @media print {
        body.driver-no-capture { visibility: hidden !important; }
        body.driver-no-capture::after {
          content: "Impression désactivée · Transports Ligneo";
          visibility: visible; position: fixed; inset: 0;
          display: flex; align-items: center; justify-content: center;
          font-family: sans-serif; font-size: 18px;
        }
      }
    `}</style>
  );
}
