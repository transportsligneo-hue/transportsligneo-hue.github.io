import { useEffect } from "react";
import { createRouter, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";


const AUTO_RELOAD_KEY = "ligneo-error-autoreload";

function DefaultErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();

  // Dans l'appli (ou n'importe où) : une erreur passagère se répare seule par un rechargement complet,
  // une seule fois par minute pour ne jamais tourner en boucle.
  useEffect(() => {
    try {
      const last = Number(sessionStorage.getItem(AUTO_RELOAD_KEY) || 0);
      if (Date.now() - last > 60_000) {
        sessionStorage.setItem(AUTO_RELOAD_KEY, String(Date.now()));
        window.location.reload();
      }
    } catch { /* stockage indisponible : on laisse les boutons */ }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-destructive"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Un problème est survenu
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          La page n'a pas pu s'afficher. Réessayez dans un instant.
        </p>
        {/* Détail technique affiché aussi en production : permet de trouver la cause depuis une simple capture d'écran */}
        {error != null && (
          <pre className="mt-4 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-left font-mono text-xs text-destructive">
            {error instanceof Error ? `${error.name}: ${error.message}\n${(error.stack ?? "").split("\n").slice(1, 4).join("\n")}` : String(error)}
          </pre>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => {
              // Rechargement complet : repart d'un état propre (comme « Accueil », sans changer de page)
              try { window.location.reload(); } catch { router.invalidate(); reset(); }
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Réessayer
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Accueil
          </a>
        </div>
      </div>
    </div>
  );
}

export const getRouter = () => {
  const router = createRouter({
    routeTree,
    context: {},
    scrollRestoration: true,
    // Préchargement à l'intention (hover/focus) → navigation perçue instantanée
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    // Pas d'écran de chargement intermédiaire — l'écran précédent reste visible
    // jusqu'à ce que la nouvelle route soit prête (sensation d'app native).
    defaultPendingMs: 10_000,
    defaultPendingMinMs: 0,
    defaultErrorComponent: DefaultErrorComponent,
  });

  return router;
};
