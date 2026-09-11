import { createServerFn } from "@tanstack/react-start";

export type PublicPricingDisplay = { regime: string; default_vat_rate: number; currency: string } | null;

/**
 * Régime de facturation public (TVA affichée sur les devis/factures).
 * Passe par le serveur : la fonction SQL n'est plus exécutable par le rôle anonyme.
 */
export const getPublicPricingDisplay = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicPricingDisplay> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any).rpc("get_public_pricing_display");
    if (error) return null;
    const row = Array.isArray(data) ? data[0] : data;
    return (row ?? null) as PublicPricingDisplay;
  },
);

export type ConvoyeurInvitationInfo = {
  email: string;
  nom: string | null;
  prenom: string | null;
  telephone: string | null;
  status: string;
  expired: boolean;
} | null;

/**
 * Lecture d'une invitation convoyeur via son token (page publique).
 * Exécutée côté serveur : le rôle anonyme n'a plus le droit d'appeler la fonction SQL.
 */
export const getConvoyeurInvitation = createServerFn({ method: "GET" })
  .inputValidator((data: { token: string }) => {
    const token = typeof data?.token === "string" ? data.token.trim() : "";
    if (!token || token.length > 200) throw new Error("Token invalide");
    return { token };
  })
  .handler(async ({ data }): Promise<ConvoyeurInvitationInfo> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await (supabaseAdmin as any).rpc("get_convoyeur_invitation", {
      _token: data.token,
    });
    if (error) return null;
    const row = Array.isArray(rows) ? rows[0] : rows;
    return (row ?? null) as ConvoyeurInvitationInfo;
  });
