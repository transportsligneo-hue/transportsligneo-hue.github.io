import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isPreviewOrIframe(): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const h = window.location.hostname;
  return (
    h.includes("id-preview--") ||
    h.includes("lovableproject.com") ||
    h.includes("lovable.dev") ||
    h === "localhost" ||
    h === "127.0.0.1"
  );
}

/**
 * Registers the service worker, manages online/offline state and
 * the install prompt. Safe in iframes / Lovable preview: unregisters
 * any existing SW and never registers a new one in those contexts.
 */
export default function PwaProvider() {
  const inPreview = typeof window !== "undefined" && isPreviewOrIframe();
  const [offline, setOffline] = useState(
    !inPreview && typeof navigator !== "undefined" ? !navigator.onLine : false
  );
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installVisible, setInstallVisible] = useState(false);
  const [updateReady, setUpdateReady] = useState<ServiceWorker | null>(null);

  // SW registration (or cleanup in preview/iframe)
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    if (isPreviewOrIframe()) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister().catch(() => {}));
      });
      return;
    }

    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          if (reg.waiting) setUpdateReady(reg.waiting);
          reg.addEventListener("updatefound", () => {
            const installing = reg.installing;
            if (!installing) return;
            installing.addEventListener("statechange", () => {
              if (installing.state === "installed" && navigator.serviceWorker.controller) {
                setUpdateReady(installing);
              }
            });
          });
        })
        .catch(() => {});
    };

    let reloaded = false;
    const onControllerChange = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  // Online / offline (disabled in preview/iframe where navigator.onLine is unreliable)
  useEffect(() => {
    if (typeof window === "undefined" || inPreview) return;
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [inPreview]);

  // Install prompt
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      const dismissed = localStorage.getItem("pwa-install-dismissed-at");
      if (!dismissed || Date.now() - Number(dismissed) > 1000 * 60 * 60 * 24 * 14) {
        setInstallVisible(true);
      }
    };
    const installed = () => {
      setInstallVisible(false);
      setInstallEvent(null);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  const triggerInstall = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice.catch(() => null);
    setInstallVisible(false);
    setInstallEvent(null);
  };

  const dismissInstall = () => {
    localStorage.setItem("pwa-install-dismissed-at", String(Date.now()));
    setInstallVisible(false);
  };

  const applyUpdate = () => {
    if (!updateReady) return;
    updateReady.postMessage({ type: "SKIP_WAITING" });
    setUpdateReady(null);
  };

  return (
    <>
      {offline && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 2147483646,
            background: "#0b1026",
            borderBottom: "1px solid #d4af37",
            color: "#faf7ef",
            padding: "8px 16px",
            textAlign: "center",
            fontSize: 13,
            letterSpacing: "0.08em",
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          Mode hors ligne — certaines fonctionnalités sont limitées.
        </div>
      )}

      {updateReady && (
        <div
          style={{
            position: "fixed",
            bottom: 16,
            right: 16,
            zIndex: 2147483646,
            background: "#111a3d",
            border: "1px solid #d4af37",
            color: "#faf7ef",
            padding: "12px 16px",
            borderRadius: 8,
            display: "flex",
            gap: 12,
            alignItems: "center",
            boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 13,
          }}
        >
          <span>Nouvelle version disponible</span>
          <button
            onClick={applyUpdate}
            style={{
              background: "#d4af37",
              color: "#0b1026",
              border: 0,
              padding: "6px 12px",
              borderRadius: 4,
              cursor: "pointer",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              fontSize: 11,
            }}
          >
            Mettre à jour
          </button>
        </div>
      )}

      {installVisible && installEvent && (
        <div
          style={{
            position: "fixed",
            bottom: 16,
            left: 16,
            zIndex: 2147483646,
            maxWidth: 340,
            background: "#0b1026",
            border: "1px solid #d4af37",
            color: "#faf7ef",
            padding: 16,
            borderRadius: 10,
            boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          <div style={{ fontSize: 12, letterSpacing: "0.22em", textTransform: "uppercase", color: "#e7c76a", marginBottom: 8 }}>
            Application
          </div>
          <div style={{ fontSize: 15, marginBottom: 12, lineHeight: 1.4 }}>
            Installez Transports Ligneo sur votre appareil pour un accès rapide.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={triggerInstall}
              style={{
                background: "#d4af37",
                color: "#0b1026",
                border: 0,
                padding: "8px 14px",
                borderRadius: 4,
                cursor: "pointer",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                fontSize: 11,
              }}
            >
              Installer
            </button>
            <button
              onClick={dismissInstall}
              style={{
                background: "transparent",
                color: "#c9cbd6",
                border: "1px solid rgba(255,255,255,0.2)",
                padding: "8px 14px",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 11,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              Plus tard
            </button>
          </div>
        </div>
      )}
    </>
  );
}
