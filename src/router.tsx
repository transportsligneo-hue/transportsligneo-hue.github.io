import { createRouter, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { routeTree } from "./routeTree.gen";

const AUTO_RECOVERY_KEY = "ligneo:auto-recovered-route-error";

function isRecoverableClientLoadError(error: Error) {
  const text = `${error.name ?? ""} ${error.message ?? ""} ${error.stack ?? ""}`.toLowerCase();
  return [
    "failed to fetch dynamically imported module",
    "error loading dynamically imported module",
    "importing a module script failed",
    "unable to preload css",
    "chunkloaderror",
    "loading chunk",
    "modulepreload",
  ].some((needle) => text.includes(needle));
}

async function clearAppRuntimeCache() {
  if (typeof window === "undefined") return;

  try {
    if ("caches" in window) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((key) => window.caches.delete(key)));
    }
  } catch {
    // Best-effort cache cleanup only.
  }

  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.update().catch(() => undefined)));
    }
  } catch {
    // Best-effort service worker refresh only.
  }
}


function DefaultErrorComponent({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const router = useRouter();
  const recoverableClientLoadError = isRecoverableClientLoadError(error);

  useEffect(() => {
    if (!recoverableClientLoadError || typeof window === "undefined") return;

    const currentPath = window.location.pathname;
    if (window.sessionStorage.getItem(AUTO_RECOVERY_KEY) === currentPath) return;

    window.sessionStorage.setItem(AUTO_RECOVERY_KEY, currentPath);
    void clearAppRuntimeCache().finally(() => window.location.reload());
  }, [recoverableClientLoadError]);

  const repairAndReload = async () => {
    if (typeof window === "undefined") return;
    window.sessionStorage.removeItem(AUTO_RECOVERY_KEY);
    await clearAppRuntimeCache();
    window.location.reload();
  };

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
          {recoverableClientLoadError ? "Mise à jour de l’application" : "Une erreur est survenue"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {recoverableClientLoadError
            ? "Nous rechargeons la dernière version pour corriger l’accès à votre espace."
            : "Un problème inattendu est survenu. Vous pouvez réessayer."}
        </p>
        {import.meta.env.DEV && error.message && (
          <pre className="mt-4 max-h-40 overflow-auto rounded-md bg-muted p-3 text-left font-mono text-xs text-destructive">
            {error.message}
          </pre>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
          <button
            onClick={repairAndReload}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Réparer
          </button>
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
