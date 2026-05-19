// Helper Google Maps JS API (Places + Distance Matrix)
// Chargement à la demande, singleton, fallback silencieux si pas de clé.

const KEY = (import.meta as any).env?.VITE_GOOGLE_PLACES_API_KEY as string | undefined;

let loadPromise: Promise<any> | null = null;
let sessionToken: any = null;

export function isGoogleAvailable(): boolean {
  return !!KEY;
}

export function loadGoogle(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("ssr"));
  const w = window as any;
  if (w.google?.maps?.places) return Promise.resolve(w.google);
  if (loadPromise) return loadPromise;
  if (!KEY) return Promise.reject(new Error("no-key"));

  loadPromise = new Promise((resolve, reject) => {
    const cbName = `__gplaces_cb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    (w as any)[cbName] = () => resolve(w.google);
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${KEY}&libraries=places&callback=${cbName}&language=fr&region=FR&loading=async`;
    s.async = true;
    s.defer = true;
    s.onerror = () => {
      loadPromise = null;
      reject(new Error("script-error"));
    };
    document.head.appendChild(s);
  });
  return loadPromise;
}

export interface PlaceSuggestion {
  label: string;
  placeId?: string;
  secondary?: string;
}

export async function getAutocompleteSuggestions(input: string): Promise<PlaceSuggestion[]> {
  if (!input || input.length < 2) return [];
  try {
    const g = await loadGoogle();
    if (!sessionToken) sessionToken = new g.maps.places.AutocompleteSessionToken();
    const svc = new g.maps.places.AutocompleteService();
    return await new Promise((resolve) => {
      svc.getPlacePredictions(
        {
          input,
          sessionToken,
          componentRestrictions: { country: ["fr", "be", "lu", "ch", "es", "it", "de", "nl", "pt", "gb"] },
          language: "fr",
        },
        (preds: any[] | null) => {
          if (!preds) return resolve([]);
          resolve(
            preds.slice(0, 6).map((p) => ({
              label: p.description,
              placeId: p.place_id,
              secondary: p.structured_formatting?.secondary_text ?? "",
            })),
          );
        },
      );
    });
  } catch {
    return [];
  }
}

export function resetPlacesSession() {
  sessionToken = null;
}

const distCache = new Map<string, number | null>();

/** Distance routière en km via Google Distance Matrix. Null si indisponible. */
export async function getGoogleDistanceKm(from: string, to: string): Promise<number | null> {
  if (!from || !to) return null;
  const key = `${from.trim().toLowerCase()}||${to.trim().toLowerCase()}`;
  if (distCache.has(key)) return distCache.get(key)!;
  try {
    const g = await loadGoogle();
    const svc = new g.maps.DistanceMatrixService();
    const result: number | null = await new Promise((resolve) => {
      svc.getDistanceMatrix(
        {
          origins: [from],
          destinations: [to],
          travelMode: g.maps.TravelMode.DRIVING,
          unitSystem: g.maps.UnitSystem.METRIC,
          region: "FR",
        },
        (resp: any, status: string) => {
          if (status !== "OK") return resolve(null);
          const el = resp?.rows?.[0]?.elements?.[0];
          if (!el || el.status !== "OK") return resolve(null);
          const meters = el.distance?.value ?? 0;
          resolve(Math.max(0, Math.round(meters / 1000)));
        },
      );
    });
    distCache.set(key, result);
    return result;
  } catch {
    return null;
  }
}
