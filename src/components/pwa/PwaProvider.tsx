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
function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints! > 1);
}

/** Chrome / Firefox / Edge / Opera sur iOS : « Sur l'écran d'accueil » n'existe pas toujours. */
function isThirdPartyIosBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent);
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
  const [iosGuideOpen, setIosGuideOpen] = useState(false);
  const [iosThirdParty, setIosThirdParty] = useState(false);
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
    if (!isIosDevice() || isStandalone()) return;
    setIosThirdParty(isThirdPartyIosBrowser());
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

      {iosVisible && (
        <div
          style={{
            position: "fixed",
            bottom: "calc(16px + env(safe-area-inset-bottom))",
            left: 12,
            right: 12,
            zIndex: 2147483646,
            background: "#0b1026",
            border: "1px solid #d4af37",
            color: "#faf7ef",
            padding: 16,
            borderRadius: 12,
            boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          <div style={{ fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: "#e7c76a", marginBottom: 8 }}>
            Installer l'application
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 12 }}>
            {iosThirdParty
              ? "Sur iPhone, l'installation ne fonctionne que depuis Safari. Ouvrez transportsligneo.fr dans Safari, puis suivez le guide."
              : "iOS n'installe pas automatiquement : 3 gestes suffisent, on vous montre."}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setIosGuideOpen(true)}
              style={{
                background: "#d4af37",
                color: "#0b1026",
                border: 0,
                padding: "10px 16px",
                borderRadius: 4,
                cursor: "pointer",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                fontSize: 11,
              }}
            >
              Voir comment faire
            </button>
            <button
              onClick={dismissIos}
              style={{
                background: "transparent",
                color: "#c9cbd6",
                border: "1px solid rgba(255,255,255,0.2)",
                padding: "10px 16px",
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

      {iosGuideOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Installer l'application sur iPhone"
          onClick={() => setIosGuideOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2147483647,
            background: "rgba(4,8,22,0.86)",
            backdropFilter: "blur(6px)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              margin: 12,
              marginBottom: "calc(12px + env(safe-area-inset-bottom))",
              background: "#0b1026",
              border: "1px solid rgba(212,175,55,0.55)",
              borderRadius: 16,
              padding: 20,
              color: "#faf7ef",
              boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
            }}
          >
            <div style={{ fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: "#e7c76a", marginBottom: 10 }}>
              Ajouter à l'écran d'accueil
            </div>

            {iosThirdParty && (
              <div
                style={{
                  fontSize: 13,
                  lineHeight: 1.5,
                  background: "rgba(212,175,55,0.10)",
                  border: "1px solid rgba(212,175,55,0.35)",
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 14,
                }}
              >
                Vous n'êtes pas dans <strong>Safari</strong>. Apple réserve l'installation à Safari : ouvrez d'abord
                <strong> transportsligneo.fr</strong> dans Safari.
              </div>
            )}

            {[
              {
                t: "Appuyez sur le bouton Partager",
                d: "La flèche qui sort d'un carré, dans la barre en bas de Safari (ou en haut à droite sur iPad).",
              },
              {
                t: "Faites défiler et choisissez « Sur l'écran d'accueil »",
                d: "Le menu est long : glissez vers le bas jusqu'à l'icône avec un carré et un +.",
              },
              {
                t: "Appuyez sur « Ajouter »",
                d: "L'icône Ligneo apparaît sur votre écran d'accueil et s'ouvre en plein écran, comme une vraie application.",
              },
            ].map((s, i) => (
              <div key={s.t} style={{ display: "flex", gap: 12, marginBottom: 14, alignItems: "flex-start" }}>
                <div
                  style={{
                    flex: "0 0 28px",
                    height: 28,
                    borderRadius: 999,
                    border: "1px solid rgba(212,175,55,0.6)",
                    color: "#e7c76a",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  {i + 1}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35, display: "flex", alignItems: "center", gap: 6 }}>
                    {s.t}
                    {i === 0 && (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#e7c76a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M12 16V4" />
                        <path d="m8 8 4-4 4 4" />
                        <path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
                      </svg>
                    )}
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.5, color: "#c9cbd6", marginTop: 2 }}>{s.d}</div>
                </div>
              </div>
            ))}

            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
              <div
                aria-hidden
                style={{
                  fontSize: 12,
                  color: "#e7c76a",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  animation: "pwaIosBounce 1.4s ease-in-out infinite",
                }}
              >
                ↓ Barre de partage Safari
              </div>
            </div>
            <style>{"@keyframes pwaIosBounce{0%,100%{transform:translateY(0);opacity:.75}50%{transform:translateY(5px);opacity:1}}"}</style>

            <button
              onClick={() => {
                setIosGuideOpen(false);
                dismissIos();
              }}
              style={{
                width: "100%",
                background: "#d4af37",
                color: "#0b1026",
                border: 0,
                padding: "12px 16px",
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                fontSize: 12,
              }}
            >
              J'ai compris
            </button>
          </div>
        </div>
      )}
    </>

  );
}
