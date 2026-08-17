import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Returns true in any context where the service worker MUST NOT register:
 * dev, Lovable preview/iframe hosts, kill-switch URL param.
 */
function shouldSkipRegistration(): boolean {
  if (typeof window === "undefined") return true;
  if (!import.meta.env.PROD) return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const h = window.location.hostname;
  if (
    h.startsWith("id-preview--") ||
    h.startsWith("preview--") ||
    h === "lovableproject.com" ||
    h.endsWith(".lovableproject.com") ||
    h === "lovableproject-dev.com" ||
    h.endsWith(".lovableproject-dev.com") ||
    h === "beta.lovable.dev" ||
    h.endsWith(".beta.lovable.dev") ||
    h === "localhost" ||
    h === "127.0.0.1"
  ) {
    return true;
  }
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("sw") === "off") return true;
  } catch {
    /* noop */
  }
  return false;
}

async function unregisterAppSW() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs
        .filter((r) => {
          const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
          return url.endsWith("/sw.js") || url.endsWith("/service-worker.js");
        })
        .map((r) => r.unregister().catch(() => false))
    );
  } catch {
    /* noop */
  }
}

/** iOS (Safari/iPadOS) : pas de beforeinstallprompt, installation manuelle. */
function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints! > 1);
  if (!isIos) return false;
  // Exclure les navigateurs iOS tiers qui ne savent pas installer (Chrome/Firefox iOS)
  const isThirdParty = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return !isThirdParty;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export default function PwaProvider() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installVisible, setInstallVisible] = useState(false);
  const [iosVisible, setIosVisible] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateFn, setUpdateFn] = useState<(() => Promise<void>) | null>(null);


  // SW registration (or cleanup in dev/preview/iframe)
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    if (shouldSkipRegistration()) {
      void unregisterAppSW();
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { registerSW } = await import("virtual:pwa-register");
        if (cancelled) return;
        const updateSW = registerSW({
          immediate: true,
          onNeedRefresh() {
            setUpdateFn(() => async () => {
              await updateSW(true);
            });
            setUpdateAvailable(true);
          },
          onRegisterError() {
            /* noop */
          },
        });
      } catch {
        /* virtual module unavailable · silent */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);


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


  // iOS : invite manuelle « Partager → Sur l'écran d'accueil »
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isIosSafari() || isStandalone()) return;
    const dismissed = localStorage.getItem("pwa-ios-install-dismissed-at");
    if (dismissed && Date.now() - Number(dismissed) < 1000 * 60 * 60 * 24 * 14) return;
    const t = window.setTimeout(() => setIosVisible(true), 2500);
    return () => window.clearTimeout(t);
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

  const dismissIos = () => {
    localStorage.setItem("pwa-ios-install-dismissed-at", String(Date.now()));
    setIosVisible(false);
  };


  const applyUpdate = async () => {
    if (!updateFn) return;
    await updateFn();
    setUpdateAvailable(false);
  };

  return (
    <>
      {updateAvailable && (
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
