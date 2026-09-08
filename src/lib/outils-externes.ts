/**
 * Outils externes client (ex: Welcome Auto / Ayvens).
 *
 * Certains donneurs d'ordre imposent un état des lieux complémentaire dans leur
 * propre outil. La mission porte le drapeau `process_client_externe_requis` et
 * l'outil est déduit automatiquement du client (organisation / compte / nom).
 */
import { supabase } from "@/integrations/supabase/client";
import welcomeAutoLogo from "@/assets/welcome-auto-logo.jpg.asset.json";

export const BUCKET_OUTILS_LOGOS = "outils-externes-logos";
export const DEFAULT_OUTIL_LOGO = welcomeAutoLogo.url;

export type OutilExterneType = "web" | "app";

export interface OutilExterne {
  id: string;
  nom: string;
  logo_url: string | null;
  type: OutilExterneType;
  url_web: string | null;
  deeplink: string | null;
  android_package: string | null;
  play_store_url: string | null;
  app_store_url: string | null;
  instructions: string | null;
}

export interface OutilExterneMission {
  requis: boolean;
  client_nom: string | null;
  outil: OutilExterne | null;
}

/** Détection automatique : aucune saisie côté convoyeur. */
export async function fetchOutilExterneMission(attributionId: string): Promise<OutilExterneMission> {
  const { data, error } = await supabase.rpc("get_outil_externe_mission" as never, {
    p_attribution_id: attributionId,
  } as never);
  if (error || !data) return { requis: false, client_nom: null, outil: null };
  const raw = data as unknown as Partial<OutilExterneMission>;
  return {
    requis: Boolean(raw.requis),
    client_nom: raw.client_nom ?? null,
    outil: (raw.outil as OutilExterne | null) ?? null,
  };
}

/** Résout l'affichage du logo (chemin storage privé, URL absolue ou asset CDN). */
export async function resolveLogoUrl(logoUrl: string | null | undefined): Promise<string> {
  if (!logoUrl) return DEFAULT_OUTIL_LOGO;
  if (/^(https?:)?\/\//.test(logoUrl) || logoUrl.startsWith("/")) return logoUrl;
  const { data } = await supabase.storage.from(BUCKET_OUTILS_LOGOS).createSignedUrl(logoUrl, 3600);
  return data?.signedUrl ?? DEFAULT_OUTIL_LOGO;
}

export function sanitizeLogoName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9.\-_]+/g, "-").replace(/-+/g, "-").slice(-80);
}

function isAndroid() {
  return typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
}
function isIOS() {
  return typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** URL de repli (store) selon la plateforme. */
export function storeFallbackUrl(outil: OutilExterne): string | null {
  if (isIOS()) return outil.app_store_url ?? outil.play_store_url ?? outil.url_web ?? null;
  if (isAndroid()) return outil.play_store_url ?? outil.app_store_url ?? outil.url_web ?? null;
  return outil.url_web ?? outil.play_store_url ?? outil.app_store_url ?? null;
}

/**
 * Ouvre l'outil du client :
 * - type "web" → ouverture directe (nouvel onglet / navigateur du téléphone)
 * - type "app" → tentative de deep link, repli automatique sur le store
 */
export function ouvrirOutilExterne(outil: OutilExterne) {
  if (typeof window === "undefined") return;

  if (outil.type === "web") {
    const url = outil.url_web ?? storeFallbackUrl(outil);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  const deeplink =
    outil.deeplink ??
    (isAndroid() && outil.android_package
      ? `intent://#Intent;package=${outil.android_package};end`
      : null);
  const fallback = storeFallbackUrl(outil);

  if (!deeplink) {
    if (fallback) window.open(fallback, "_blank", "noopener,noreferrer");
    return;
  }

  let redirected = false;
  const onHide = () => {
    if (document.visibilityState === "hidden") redirected = true;
  };
  document.addEventListener("visibilitychange", onHide);

  window.location.href = deeplink;

  window.setTimeout(() => {
    document.removeEventListener("visibilitychange", onHide);
    if (!redirected && fallback) window.open(fallback, "_blank", "noopener,noreferrer");
  }, 1600);
}

/** Trace l'ouverture de l'outil externe (preuve de redirection). */
export async function tracerOuvertureOutil(
  attributionId: string,
  type: "depart" | "arrivee",
  outil: OutilExterne | null,
) {
  await supabase
    .from("mission_edl_externe_passages" as never)
    .upsert(
      {
        attribution_id: attributionId,
        type,
        outil_id: outil?.id ?? null,
        outil_nom: outil?.nom ?? null,
        ouvert_at: new Date().toISOString(),
      } as never,
      { onConflict: "attribution_id,type" } as never,
    );
}

/** Valide l'étape : horodatage « j'ai terminé l'état des lieux externe ». */
export async function tracerFinOutil(
  attributionId: string,
  type: "depart" | "arrivee",
  outil: OutilExterne | null,
) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("mission_edl_externe_passages" as never)
    .upsert(
      {
        attribution_id: attributionId,
        type,
        outil_id: outil?.id ?? null,
        outil_nom: outil?.nom ?? null,
        ouvert_at: now,
        termine_at: now,
      } as never,
      { onConflict: "attribution_id,type" } as never,
    );
  if (error) throw new Error(error.message || "Enregistrement impossible");
}

/** Étape déjà validée ? (reprise de mission) */
export async function fetchPassageExterne(attributionId: string, type: "depart" | "arrivee") {
  const { data } = await supabase
    .from("mission_edl_externe_passages" as never)
    .select("termine_at")
    .eq("attribution_id", attributionId)
    .eq("type", type)
    .maybeSingle();
  return (data as { termine_at: string | null } | null)?.termine_at ?? null;
}
