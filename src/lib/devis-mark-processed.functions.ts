import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Permet au pro (ou client propriétaire) de clôturer manuellement un devis
 * obsolète (non payé, non signé, non converti). L'action est tracée dans
 * devis_status_history avec l'auteur, la date, le motif et l'IP.
 */
export const markDevisAsProcessed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { devisId: string; reason: string }) => {
    if (!input?.devisId || typeof input.devisId !== "string") {
      throw new Error("devisId requis");
    }
    const reason = (input.reason ?? "").trim();
    if (reason.length < 3) {
      throw new Error("Merci d'indiquer un motif (3 caractères minimum).");
    }
    if (reason.length > 500) {
      throw new Error("Motif trop long (500 caractères max).");
    }
    return { devisId: input.devisId, reason };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { devisId, reason } = data;

    // 1) Vérifier que le devis existe et appartient au caller (RLS s'applique)
    const { data: devis, error: devisErr } = await supabase
      .from("devis")
      .select("id, user_id, email, statut, accepted_at, paid_at, locked_at, mission_id, refused_at, converted_at, numero")
      .eq("id", devisId)
      .maybeSingle();

    if (devisErr) throw new Error(devisErr.message);
    if (!devis) throw new Error("Devis introuvable ou accès refusé.");

    // 2) Empêcher la clôture d'un devis déjà finalisé
    if (devis.paid_at) throw new Error("Ce devis a déjà été payé et ne peut plus être clôturé.");
    if (devis.accepted_at || devis.locked_at) throw new Error("Ce devis a déjà été signé et ne peut plus être clôturé.");
    if (devis.mission_id || devis.converted_at) throw new Error("Ce devis a déjà été converti en mission.");
    if (devis.refused_at || devis.statut === "annule") throw new Error("Ce devis est déjà clôturé.");

    // 3) Charger le client admin uniquement après autorisation
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const ip = getRequestIP() ?? null;
    const userAgent = getRequestHeader("user-agent") ?? null;
    const now = new Date().toISOString();
    const oldStatut = devis.statut;

    // 4) Mise à jour du devis
    const { error: updErr } = await supabaseAdmin
      .from("devis")
      .update({
        statut: "annule",
        refused_at: now,
        refus_motif: reason,
      })
      .eq("id", devisId);
    if (updErr) throw new Error(updErr.message);

    // 5) Trace d'audit dans devis_status_history
    const auditNote = [
      `Clôturé manuellement par le pro`,
      `Motif : ${reason}`,
      ip ? `IP : ${ip}` : null,
      userAgent ? `UA : ${userAgent}` : null,
    ].filter(Boolean).join(" — ");

    const { error: histErr } = await supabaseAdmin
      .from("devis_status_history")
      .insert({
        devis_id: devisId,
        old_statut: oldStatut,
        new_statut: "annule",
        changed_by: userId,
        note: auditNote,
      });
    if (histErr) throw new Error(histErr.message);

    return { ok: true as const, numero: devis.numero, closedAt: now };
  });
