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

  useEffect(() => {
    if (!isApp || isLoading) return;
    const path = location.pathname;

    // Racine : on ouvre directement sur l'outil de travail ou la connexion
    if (path === "/") {
      navigate({ to: isAuthenticated ? homeRoute : "/login", replace: true });
      return;
    }

    if (!isMobileAppRoute(path)) {
      navigate({ to: isAuthenticated ? homeRoute : "/login", replace: true });
    }
  }, [isApp, isLoading, isAuthenticated, homeRoute, location.pathname, navigate]);

  return null;
}

/** Hook utilitaire : masquer le chrome public (navbar vitrine, cookies…) dans l'app. */
export function useIsMobileAppShell() {
  const [isApp, setIsApp] = useState(false);
  useEffect(() => setIsApp(isMobileAppShell()), []);
  return isApp;
}
