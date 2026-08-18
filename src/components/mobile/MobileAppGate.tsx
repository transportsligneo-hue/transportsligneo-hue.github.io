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

  // Voile plein écran : empêche tout affichage du site vitrine dans l'app
  if (!offLimits) return null;
  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0b1026]"
    >
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#e7c76a]/30 border-t-[#e7c76a]" />
    </div>
  );
}

/** Hook utilitaire : masquer le chrome public (navbar vitrine, cookies…) dans l'app. */
export function useIsMobileAppShell() {
  const [isApp, setIsApp] = useState(false);
  useEffect(() => setIsApp(isMobileAppShell()), []);
  return isApp;
}
