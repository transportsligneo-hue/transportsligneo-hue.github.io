import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CGV_VERSION = "v1-2026-01";

interface AcceptInput {
  devisId: string;
}

/**
 * Enregistre une preuve d'acceptation de devis :
 * - capture IP + User-Agent
 * - insert dans devis_acceptations
 * - verrouille le devis (locked_at, accepted_at)
 *
 * RLS : insert via le client authentifié (policy "Client insert own acceptation").
 */
export const acceptDevis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AcceptInput) => {
    if (!input?.devisId || typeof input.devisId !== "string") {
      throw new Error("devisId requis");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const email = (claims as { email?: string } | null)?.email ?? null;

    // Récupère le devis (RLS s'applique : doit appartenir au user)
    const { data: devis, error: devisErr } = await supabase
      .from("devis")
      .select("id, version, prix_estime, email, user_id, locked_at")
      .eq("id", data.devisId)
      .single();

    if (devisErr || !devis) {
      throw new Error("Devis introuvable ou accès refusé");
    }

    if (devis.locked_at) {
      // Déjà accepté pour cette version — idempotent
      return { ok: true, alreadyAccepted: true };
    }

    const ip =
      getRequestHeader("cf-connecting-ip") ??
      getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ??
      getRequestHeader("x-real-ip") ??
      null;
    const userAgent = getRequestHeader("user-agent") ?? null;

    const clientEmail = (devis.email ?? email ?? "").toLowerCase();
    if (!clientEmail) throw new Error("Email client manquant");

    // 1. Insert preuve
    const { error: insertErr } = await supabase
      .from("devis_acceptations")
      .insert({
        devis_id: devis.id,
        devis_version: devis.version ?? 1,
        client_user_id: userId,
        client_email: clientEmail,
        ip_address: ip,
        user_agent: userAgent,
        montant_accepte: devis.prix_estime,
        cgv_version: CGV_VERSION,
        statut: "accepte",
      });

    if (insertErr) {
      throw new Error(`Enregistrement acceptation échoué : ${insertErr.message}`);
    }

    // 2. Verrouille le devis
    const now = new Date().toISOString();
    await supabase
      .from("devis")
      .update({ locked_at: now, accepted_at: now })
      .eq("id", devis.id);

    return { ok: true, acceptedAt: now };
  });

/**
 * Récupère l'état d'acceptation et le paramètre global pour un devis.
 */
export const getDevisAcceptationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { devisId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const [{ data: devis }, { data: setting }, { data: profile }] = await Promise.all([
      supabase
        .from("devis")
        .select("id, version, locked_at, accepted_at, user_id")
        .eq("id", data.devisId)
        .single(),
      supabase
        .from("app_settings")
        .select("value")
        .eq("key", "devis_acceptation_obligatoire")
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("exempte_acceptation_devis")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    const obligatoire = setting?.value === true || setting?.value === "true";
    const exempte = !!(profile as { exempte_acceptation_devis?: boolean } | null)?.exempte_acceptation_devis;

    return {
      obligatoire,
      exempte,
      requiresAcceptation: obligatoire && !exempte && !devis?.locked_at,
      lockedAt: devis?.locked_at ?? null,
      acceptedAt: devis?.accepted_at ?? null,
      version: devis?.version ?? 1,
    };
  });
