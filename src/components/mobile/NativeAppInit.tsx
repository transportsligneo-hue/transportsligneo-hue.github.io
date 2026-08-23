import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { isNativeApp, nativePlatform, registerNativePush } from "@/lib/native/bridge";
import { useAuth } from "@/hooks/useAuth";

/**
 * Initialisation de la coquille native (Capacitor) :
 * barre de statut, masquage du splash, bouton retour Android, push natif.
 * Totalement inerte dans un navigateur classique.
 */
export default function NativeAppInit() {
  const { isAuthenticated, user } = useAuth();

  const navigate = useNavigate();

  // Filet de sécurité : masque le splash natif dès que le JS tourne, même si
  // la détection native échoue — sinon l'utilisateur reste bloqué sur le logo.
  useEffect(() => {
    (async () => {
      try {
        const { SplashScreen } = await import("@capacitor/splash-screen");
        await SplashScreen.hide();
      } catch { /* noop */ }
    })();
  }, []);

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

  /**
   * Enregistrement du token FCM à chaque connexion dans l'app native.
   * Le token est ré-envoyé (upsert) à chaque session : un même convoyeur peut
   * ainsi avoir plusieurs appareils actifs, et un token renouvelé est mis à jour.
   */
  useEffect(() => {
    if (!isNativeApp() || !isAuthenticated || !user?.id) return;
    let cancelled = false;

    void registerNativePush(
      async (token, platform) => {
        if (cancelled) return;
        try {
          window.localStorage.setItem("ligneo:native-push", JSON.stringify({ token, platform }));
        } catch { /* noop */ }
        try {
          const { saveNativePushToken } = await import("@/lib/push.functions");
          await saveNativePushToken({
            data: { token, platform, user_agent: navigator.userAgent.slice(0, 500) },
          });
        } catch (e) {
          console.warn("[push natif] token non enregistré", e);
        }
      },
      {
        // App au premier plan : Android n'affiche pas la notification système,
        // on montre donc une alerte in-app cohérente (pas de doublon).
        onReceived: (e) => {
          if (e.title) {
            toast(e.title, {
              description: e.body,
              action: e.url?.startsWith("/")
                ? { label: "Ouvrir", onClick: () => void navigate({ to: e.url as string }) }
                : undefined,
            });
          }
        },
        onAction: (e) => {
          if (e.url && e.url.startsWith("/")) void navigate({ to: e.url });
        },
        onError: (m) => console.warn("[push natif]", m),
      },
    );

    return () => { cancelled = true; };
  }, [isAuthenticated, user?.id, navigate]);

  return null;

}
