import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const inputSchema = z.object({
  depart: z.string().min(2).max(400),
  arrivee: z.string().min(2).max(400),
  isAllerRetour: z.boolean().default(false),
  /** Prix standard calculé par la grille publique — sert de repli si aucune règle personnalisée. */
  fallbackPrice: z.number().min(0).max(100000),
});

/**
 * SOURCE DE VÉRITÉ UNIQUE du prix TTC affiché.
 *
 * Applique exactement la même règle de tarification personnalisée
 * (resolve_client_pricing_rule) que le trigger qui fixe le prix du devis
 * en base. Ainsi l'estimateur, le devis, le PDF et les dashboards affichent
 * strictement le même montant (tolérance 0 €).
 *
 * - Visiteur anonyme : seules les règles générales (scope "tous"/"particulier") s'appliquent.
 * - Client connecté : ses règles personnalisées sont prioritaires.
 */
export const resolvePersonalizedPrice = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    let userId: string | null = null;
    let email: string | null = null;

    const authHeader = getRequestHeader("authorization");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (authHeader?.startsWith("Bearer ")) {
      try {
        const token = authHeader.slice(7);
        const { data: u } = await supabaseAdmin.auth.getUser(token);
        userId = u?.user?.id ?? null;
        email = u?.user?.email ?? null;
      } catch {
        // jeton invalide → traité comme anonyme
      }
    }

    const { data: rows, error } = await supabaseAdmin.rpc("resolve_client_pricing_rule", {
      _user_id: userId,
      _email: email,
      _depart: data.depart,
      _arrivee: data.arrivee,
      _is_aller_retour: data.isAllerRetour,
    });

    if (error) {
      // En cas d'erreur on retombe sur la grille standard — jamais de blocage.
      return { price: data.fallbackPrice, personalized: false as const };
    }

    const rule = Array.isArray(rows) ? rows[0] : rows;
    const prix = rule?.prix_ttc != null ? Number(rule.prix_ttc) : null;

    if (prix && prix > 0) {
      return { price: prix, personalized: true as const };
    }
    return { price: data.fallbackPrice, personalized: false as const };
  });
