import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Phase 2 — Validation d'une attribution par le convoyeur.
 * Le convoyeur accepte ou refuse une attribution qui lui a été assignée
 * (mode 'directe') ou qu'il a remportée (mode 'catalogue').
 */
export const respondToAttribution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        attributionId: z.string().uuid(),
        action: z.enum(["accepte", "refuse"]),
        motif: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Récupérer l'attribution + convoyeur associé
    const { data: attr, error: aErr } = await supabase
      .from("attributions")
      .select("id, convoyeur_id, statut, statut_convoyeur, trajet_id, mode, convoyeurs:convoyeur_id(user_id)")
      .eq("id", data.attributionId)
      .maybeSingle();
    if (aErr) throw aErr;
    if (!attr) throw new Error("Attribution introuvable");

    const convoyeurUserId = (attr as { convoyeurs?: { user_id?: string } }).convoyeurs?.user_id;
    if (convoyeurUserId !== userId) throw new Error("Forbidden");

    if (attr.statut_convoyeur !== "en_attente") {
      return { ok: true, alreadyResponded: true, statut_convoyeur: attr.statut_convoyeur };
    }
    if (data.action === "refuse" && !data.motif) {
      throw new Error("Un motif est requis pour refuser une attribution.");
    }

    const now = new Date().toISOString();
    const { error: uErr } = await supabase
      .from("attributions")
      .update({
        statut_convoyeur: data.action,
        repondu_at: now,
        refus_motif: data.action === "refuse" ? data.motif ?? null : null,
        // Sur refus, on remet l'attribution en 'annulee' pour que l'admin puisse réattribuer.
        // Sur accept, on active la course.
        statut: data.action === "accepte" ? "active" : "annulee",
      })
      .eq("id", data.attributionId);
    if (uErr) throw uErr;

    // Notifier l'admin
    try {
      await supabase.from("admin_notifications").insert({
        type: data.action === "accepte" ? "attribution_acceptee" : "attribution_refusee",
        title:
          data.action === "accepte"
            ? "Attribution acceptée par le convoyeur"
            : "Attribution refusée par le convoyeur",
        message:
          data.action === "accepte"
            ? `Le convoyeur a accepté l'attribution ${attr.id.slice(0, 8)}.`
            : `Le convoyeur a refusé l'attribution ${attr.id.slice(0, 8)}. Motif : ${data.motif ?? "—"}`,
        severity: data.action === "refuse" ? "warning" : "info",
      } as never);
    } catch {
      /* non-bloquant */
    }

    return { ok: true, statut_convoyeur: data.action, repondu_at: now };
  });
