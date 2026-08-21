import { Outlet, Link, createRootRoute, HeadContent, Scripts, useRouterState } from "@tanstack/react-router";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";
import MobileAppGate, { useIsMobileAppShell } from "@/components/mobile/MobileAppGate";
import NativeAppInit from "@/components/mobile/NativeAppInit";
import MobileNavbar from "@/components/mobile/MobileNavbar";
import CursorSpotlight from "@/components/CursorSpotlight";
import PwaProvider from "@/components/pwa/PwaProvider";
import AssistantIaWidget from "@/components/assistant/AssistantIaWidget";
import PwaSplash from "@/components/pwa/PwaSplash";
import BiometricLock from "@/components/BiometricLock";
import CookieBanner from "@/components/CookieBanner";
import BiometricEnrollPrompt from "@/components/BiometricEnrollPrompt";
import { PricingProvider } from "@/lib/pricing";
import { AiSettingsProvider } from "@/lib/ai/context";
import { Toaster } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { isMobileAppShell } from "@/lib/app-mode";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">
          Page introuvable
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          La page que vous cherchez n'existe pas ou a été déplacée.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "color-scheme", content: "dark light" },
      { name: "theme-color", content: "#061238" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Ligneo" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "application-name", content: "Transports Ligneo" },
      { title: "Transports Ligneo — Convoyage et logistique automobile B2B | Particuliers & Professionnels" },
      { name: "description", content: "Transports Ligneo, spécialiste du convoyage et logistique automobile B2B et particuliers. Concessionnaires, loueurs, gestionnaires de flotte : missions à la carte, état des lieux digital, suivi GPS temps réel et API partenaires. Basés à Tours, disponibles 7j/7 en France et en Europe." },
      { name: "author", content: "Transports Ligneo" },
      { property: "og:title", content: "Transports Ligneo — Convoyage et logistique automobile B2B | Particuliers & Professionnels" },
      { property: "og:description", content: "Transports Ligneo, spécialiste du convoyage et logistique automobile B2B et particuliers. Concessionnaires, loueurs, gestionnaires de flotte : missions à la carte, état des lieux digital, suivi GPS temps réel et API partenaires. Basés à Tours, disponibles 7j/7 en France et en Europe." },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Transports Ligneo" },
      { property: "og:locale", content: "fr_FR" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Transports Ligneo — Convoyage et logistique automobile B2B | Particuliers & Professionnels" },
      { name: "twitter:description", content: "Transports Ligneo, spécialiste du convoyage et logistique automobile B2B et particuliers. Concessionnaires, loueurs, gestionnaires de flotte : missions à la carte, état des lieux digital, suivi GPS temps réel et API partenaires. Basés à Tours, disponibles 7j/7 en France et en Europe." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Poppins:wght@700;800;900&family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Mono:wght@500&display=swap",
      },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icons/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icons/icon-512.png" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": "https://transportsligneo.fr/#organization",
              name: "Transports Ligneo",
              url: "https://transportsligneo.fr",
              logo: "https://transportsligneo.fr/logo-ligneo.png",
              description:
                "Transports Ligneo, spécialiste du convoyage et logistique automobile B2B et particuliers. Concessionnaires, loueurs, gestionnaires de flotte : missions à la carte, état des lieux digital, suivi GPS temps réel et API partenaires. Basés à Tours, disponibles 7j/7 en France et en Europe.",
              telephone: "+33 7 82 45 61 81",
              areaServed: "FR",
              address: {
                "@type": "PostalAddress",
                addressLocality: "Tours",
                addressCountry: "FR",
              },
              sameAs: ["https://www.transportsligneo.fr"],
            },
            {
              "@type": "WebSite",
              "@id": "https://transportsligneo.fr/#website",
              name: "Transports Ligneo",
              url: "https://transportsligneo.fr",
              inLanguage: "fr-FR",
              publisher: { "@id": "https://transportsligneo.fr/#organization" },
            },
            {
              "@type": "LocalBusiness",
              "@id": "https://transportsligneo.fr/#localbusiness",
              name: "Transports Ligneo",
              url: "https://transportsligneo.fr",
              image: "https://transportsligneo.fr/logo-ligneo.png",
              telephone: "+33 7 82 45 61 81",
              priceRange: "€€",
              address: {
                "@type": "PostalAddress",
                addressLocality: "Tours",
                addressRegion: "Centre-Val de Loire",
                addressCountry: "FR",
              },
              areaServed: { "@type": "Country", name: "France" },
              parentOrganization: { "@id": "https://transportsligneo.fr/#organization" },
            },
          ],
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/** Routes visibles dans la coquille Capacitor "Driver" : login/inscription + espace convoyeur. */
const DRIVER_APP_ROUTES = [
  "/login",
  "/mot-de-passe-oublie",
  "/reset-password",
  "/auth",
  "/inscription-convoyeur",
  "/invitation-convoyeur",
  "/attente-validation",
  "/convoyeur",
];

/** Applique la classe body `is-driver-app` uniquement dans l'app Capacitor (partie driver). */
function DriverAppBodyClass() {
  const { pathname } = useRouterState({ select: (s) => s.location });

  useEffect(() => {
    if (typeof window === "undefined" || !isMobileAppShell()) return;
    const isDriverApp = DRIVER_APP_ROUTES.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    );
    if (isDriverApp) {
      document.body.classList.add("is-driver-app");
    } else {
      document.body.classList.remove("is-driver-app");
    }
  }, [pathname]);

  return null;
}

/** Tunnel de paiement : pas de chrome public, focus total sur le règlement. */
function useIsCheckoutRoute() {
  const { pathname } = useRouterState({ select: (s) => s.location });
  return pathname.startsWith("/paiement");
}

/** Espaces connectés (admin, convoyeur, dashboards) : chrome public masqué. */
function useIsDashboardRoute() {
  const { pathname } = useRouterState({ select: (s) => s.location });
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/convoyeur") ||
    pathname.startsWith("/dashboard-client") ||
    pathname.startsWith("/dashboard-pro") ||
    pathname.startsWith("/flotte") ||
    pathname.startsWith("/entreprise")
  );
}

function PublicMobileBottomNav() {
  const isApp = useIsMobileAppShell();
  const isCheckout = useIsCheckoutRoute();
  const isDashboard = useIsDashboardRoute();
  if (isApp || isCheckout || isDashboard) return null;
  return <MobileBottomNav />;
}

/** Chrome public (navbar vitrine, bandeau cookies, assistant) — masqué dans l'app native. */
function PublicChrome() {
  const isApp = useIsMobileAppShell();
  const isCheckout = useIsCheckoutRoute();
  const isDashboard = useIsDashboardRoute();
  if (isApp || isCheckout) return null;
  if (isDashboard) return <CookieBanner />;
  return (
    <>
      <MobileNavbar />
      <AssistantIaWidget />
      <CookieBanner />
    </>
  );
}

/**
 * Certains liens de réinitialisation renvoient vers la racine du site
 * (site_url) au lieu de /reset-password. On redirige alors en conservant
 * le jeton, sinon l'utilisateur atterrit sur l'accueil sans rien pouvoir faire.
 */
function RecoveryLinkRedirect() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const { pathname, search, hash } = window.location;
    if (pathname.startsWith("/reset-password")) return;
    const q = new URLSearchParams(search);
    const h = new URLSearchParams(hash.replace(/^#/, ""));
    const isRecovery =
      q.get("type") === "recovery" ||
      h.get("type") === "recovery" ||
      (q.get("token_hash") && q.get("type") === "recovery");
    if (isRecovery) window.location.replace(`/reset-password${search}${hash}`);
  }, []);
  return null;
}

function RootComponent() {
  const [queryClient] = useState(() => new QueryClient());



  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <PricingProvider>
            <AiSettingsProvider>
              <CursorSpotlight />
              <RecoveryLinkRedirect />
              <MobileAppGate />
              <DriverAppBodyClass />
              <NativeAppInit />


              <PublicChrome />
              <Outlet />
              <PublicMobileBottomNav />
              <PwaProvider />
              <PwaSplash />
              <BiometricEnrollPrompt />
              <BiometricLock />
              <Toaster />
            </AiSettingsProvider>
          </PricingProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

