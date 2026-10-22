import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { isMobileAppRoute, isMobileAppShell } from "@/lib/app-mode";

/**
 * Restreint la coquille mobile (Capacitor) aux seules routes de travail :
 * Connexion / Inscription convoyeur, Espace Driver et Admin.
 * Aucune route du site vitrine n'est accessible depuis l'app.
 * En navigateur classique, ce composant est totalement inerte.
 */
export default function MobileAppGate() {
  const [isApp, setIsApp] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, homeRoute } = useAuth();

  useEffect(() => {
    setIsApp(isMobileAppShell());
  }, []);

  const path = location.pathname;
  const offLimits = isApp && (path === "/" || !isMobileAppRoute(path));

  useEffect(() => {
    if (!isApp || isLoading) return;
    if (offLimits) {
      navigate({ to: isAuthenticated ? homeRoute : "/login", replace: true });
    }
  }, [isApp, isLoading, isAuthenticated, homeRoute, offLimits, navigate]);

  // Libère l'écran de démarrage vert une fois la session lue (minimum 1,4 s pour une entrée propre).
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (!root.classList.contains("ligneo-app")) return;
    const release = () => root.classList.add("ligneo-ready");
    if (isLoading) {
      const safety = window.setTimeout(release, 7000);
      return () => window.clearTimeout(safety);
    }
    const wait = Math.max(0, 1400 - Math.round(performance.now()));
    const t = window.setTimeout(release, wait);
    return () => window.clearTimeout(t);
  }, [isLoading]);

  // Voile plein écran : empêche tout affichage du site vitrine dans l'app
  if (!offLimits) return null;
  return (
    <div aria-hidden className="lb-screen">
      <div className="lb-mark"><i className="lb-halo" /><img src="/logo-ligneo.png" alt="" /></div>
      <strong className="lb-brand">TRANSPORTS LIGNEO<em>DRIVER</em></strong>
      <span className="lb-bar"><b /></span>
    </div>
  );
}

/** Hook utilitaire : masquer le chrome public (navbar vitrine, cookies…) dans l'app. */
export function useIsMobileAppShell() {
  const [isApp, setIsApp] = useState(false);
  useEffect(() => setIsApp(isMobileAppShell()), []);
  return isApp;
}
