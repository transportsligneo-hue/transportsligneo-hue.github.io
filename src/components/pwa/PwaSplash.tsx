import { useEffect, useState } from "react";

/**
 * Écran de chargement partagé entre le site web, la PWA et l'app native.
 */
export default function PwaSplash() {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setVisible(true);
    // Verrouille le scroll pendant l'anim
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const leaveTimer = window.setTimeout(() => setLeaving(true), 1100);
    const hideTimer = window.setTimeout(() => {
      setVisible(false);
      document.body.style.overflow = prevOverflow;
    }, 1700);

    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(hideTimer);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className={`pwa-splash ${leaving ? "pwa-splash--leaving" : ""}`}
    >
      <div className="pwa-splash__mark">
        <img
          src="/logo-ligneo.png"
          alt=""
          width={148}
          height={148}
          className="pwa-splash__logo"
          draggable={false}
        />
        <div className="pwa-splash__wordmark">
          <span className="pwa-splash__brand"><span>TRANSPORTS</span> <span className="pwa-splash__electric">LIGNEO</span></span>
          <span className="pwa-splash__tagline">Votre logistique automobile sur toute la ligne</span>
        </div>
      </div>
      <div className="pwa-splash__progress" />
    </div>
  );
}
