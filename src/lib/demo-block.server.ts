/**
 * Compte flotte de démonstration : tout ce qui engage (paiement, signature, validation)
 * est refusé côté serveur, même si le bouton est visible à l'écran.
 */
export const DEMO_EMAIL = "demo-flotte@transportsligneo.fr";
export const DEMO_BLOCK_MESSAGE =
  "Mode démonstration : cette action est désactivée. Aucun paiement ni aucune signature n'est enregistré. Contactez Transports Ligneo pour ouvrir votre vrai compte.";

import { isDemoOrTestIdentity } from "@/lib/demo-detect";

export function isDemoEmail(email?: string | null): boolean {
  return (email ?? "").trim().toLowerCase() === DEMO_EMAIL;
}

/** À appeler au début d'une server function authentifiée (claims du JWT). */
export function assertNotDemo(claims: unknown): void {
  const email = (claims as { email?: string } | null | undefined)?.email;
  if (isDemoEmail(email)) throw new Error(DEMO_BLOCK_MESSAGE);
}

/** Pour les routes API : lit le jeton Bearer éventuel et dit si c'est le compte démo. */
export async function requestIsDemo(request: Request): Promise<boolean> {
  try {
    const h = request.headers.get("authorization");
    if (!h?.startsWith("Bearer ")) return false;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.auth.getUser(h.slice(7));
    return isDemoEmail(data?.user?.email);
  } catch {
    return false;
  }
}

/**
 * Document (devis, facture, demande B2B) appartenant à un compte de démonstration ou de test :
 * aucun paiement réel (mode « live ») n'est jamais créé, même si le lien de paiement est ouvert sans être connecté.
 */
export function docIsDemo(email?: string | null, env: "live" | "sandbox" = "live"): boolean {
  if (isDemoEmail(email)) return true;
  return env === "live" && !!email && isDemoOrTestIdentity({ email });
}
