import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { isNativeApp, nativePlatform, registerNativePush } from "@/lib/native/bridge";

/**
 * Initialisation de la coquille native (Capacitor) :
 * barre de statut, masquage du splash, bouton retour Android, push natif.
 * Totalement inerte dans un navigateur classique.
 */
export default function NativeAppInit() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNativeApp()) return;
    let cancelled = false;

    (async () => {
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        await StatusBar.setStyle({ style: Style.Dark });
        if (nativePlatform() === "android") {
          await StatusBar.setBackgroundColor({ color: "#0b1026" });
        }
      } catch { /* noop */ }

      try {
        const { SplashScreen } = await import("@capacitor/splash-screen");
        await SplashScreen.hide();
      } catch { /* noop */ }

      if (cancelled) return;

      // Token push natif : conservé localement en attendant l'envoi serveur.
      void registerNativePush((token, platform) => {
        try {
          window.localStorage.setItem("ligneo:native-push", JSON.stringify({ token, platform }));
        } catch { /* noop */ }
      });
    })();

    let removeBack: (() => void) | undefined;
    (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const handle = await App.addListener("backButton", ({ canGoBack }) => {
          if (canGoBack) window.history.back();
          else void navigate({ to: "/", replace: true });
        });
        removeBack = () => void handle.remove();
      } catch { /* noop */ }
    })();

    return () => {
      cancelled = true;
      removeBack?.();
    };
  }, [navigate]);

  return null;
}
