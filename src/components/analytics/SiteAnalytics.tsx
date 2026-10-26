/**
 * Mesure d'audience anonyme du site public (Statistiques › Fréquentation).
 * - Un identifiant temporaire par onglet (sessionStorage, effacé à la fermeture) : pas de cookie,
 *   pas de nom, pas d'adresse IP enregistrée.
 * - Ignore l'admin, les espaces connectés, l'appli Driver et les robots.
 */
import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import { trackVisit } from "@/lib/site-analytics.functions";

const SID_KEY = "lg-sid";
const FIRST_KEY = "lg-sid-first";
const PRIVATE = ["/admin", "/convoyeur", "/dashboard", "/entreprise", "/flotte", "/login", "/reset-password", "/mot-de-passe-oublie", "/app-start"];

/** Identifiant de visite anonyme, partagé avec l'estimateur. */
export function getVisitId(): string | undefined {
  try {
    let sid = sessionStorage.getItem(SID_KEY);
    if (!sid) {
      sid = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/-/g, "").slice(0, 24);
      sessionStorage.setItem(SID_KEY, sid);
    }
    return sid;
  } catch { return undefined; }
}

function device(): "Téléphone" | "Ordinateur" | "Tablette" {
  const ua = navigator.userAgent;
  if (/iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return "Tablette";
  if (/Mobi|Android|iPhone/i.test(ua) || window.innerWidth < 768) return "Téléphone";
  return "Ordinateur";
}

export default function SiteAnalytics() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { role, isLoading } = useAuth();
  const track = useServerFn(trackVisit);
  const last = useRef<string>("");

  useEffect(() => {
    if (typeof window === "undefined" || isLoading) return;
    if (PRIVATE.some((p) => pathname.startsWith(p))) return;
    if (role === "admin" || role === "super_admin" || role === "convoyeur") return;
    if (/LigneoDriverApp/i.test(navigator.userAgent)) return;
    if (last.current === pathname) return;

    const sid = getVisitId();
    if (!sid) return;
    const t = window.setTimeout(() => {
      last.current = pathname;
      let first = false;
      try { first = !sessionStorage.getItem(FIRST_KEY); if (first) sessionStorage.setItem(FIRST_KEY, "1"); } catch { /* */ }
      let utm = "";
      try { utm = new URLSearchParams(window.location.search).get("utm_source") ?? ""; } catch { /* */ }
      void track({ data: { sid, path: pathname, ref: first ? document.referrer.slice(0, 500) : undefined, utm: first ? utm.slice(0, 80) : undefined, device: device(), first } }).catch(() => {});
    }, 400);
    return () => window.clearTimeout(t);
  }, [pathname, role, isLoading, track]);

  return null;
}
