/**
 * ETA de référence d'une mission + alerte automatique de retard.
 *
 * - L'ETA initial est figé au premier appel : il ne se recalcule jamais.
 * - Si l'écart dépasse le seuil configurable (`mission_delay_alert_minutes`,
 *   30 min par défaut), une alerte est envoyée une seule fois par tranche
 *   de retard (email/SMS client + notification interne admin).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface MissionEtaBaseline {
  initialEtaAt: string | null;
  delayMinutes: number | null;
  thresholdMinutes: number;
}

export const reportMissionEta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { attributionId: string; etaAt: string; remainingKm?: number }) => {
    if (!UUID_RE.test(input.attributionId)) throw new Error("Invalid attribution id");
    const t = new Date(input.etaAt).getTime();
    if (Number.isNaN(t)) throw new Error("Invalid eta");
    return input;
  })
  .handler(async ({ data, context }): Promise<MissionEtaBaseline> => {
    // Le client authentifié doit pouvoir lire l'attribution (RLS).
    const { data: visible } = await context.supabase
      .from("attributions")
      .select("id, statut, trajet_id")
      .eq("id", data.attributionId)
      .maybeSingle();
    if (!visible) throw new Response("Forbidden", { status: 403 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Seuil configurable
    let threshold = 30;
    const { data: setting } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "mission_delay_alert_minutes")
      .maybeSingle();
    const raw = (setting as { value?: unknown } | null)?.value;
    const parsed = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) threshold = Math.round(parsed);

    const { data: existing } = await supabaseAdmin
      .from("mission_eta_tracking")
      .select("attribution_id, initial_eta_at, last_alert_bucket")
      .eq("attribution_id", data.attributionId)
      .maybeSingle();

    let row = existing as
      | { attribution_id: string; initial_eta_at: string; last_alert_bucket: number }
      | null;

    if (!row) {
      const { data: inserted } = await supabaseAdmin
        .from("mission_eta_tracking")
        .insert({
          attribution_id: data.attributionId,
          initial_eta_at: data.etaAt,
          initial_remaining_km: data.remainingKm ?? null,
        } as never)
        .select("attribution_id, initial_eta_at, last_alert_bucket")
        .maybeSingle();
      row = (inserted as typeof row) ?? {
        attribution_id: data.attributionId,
        initial_eta_at: data.etaAt,
        last_alert_bucket: 0,
      };
    }

    let delay = Math.round(
      (new Date(data.etaAt).getTime() - new Date(row.initial_eta_at).getTime()) / 60_000,
    );

    // Écart aberrant (mission reprogrammée, référence obsolète) : on refige
    // la référence sur l'ETA courant au lieu d'envoyer une fausse alerte.
    const MAX_PLAUSIBLE_DELAY_MIN = 480; // 8 h
    if (Math.abs(delay) > MAX_PLAUSIBLE_DELAY_MIN) {
      await supabaseAdmin
        .from("mission_eta_tracking")
        .update({
          initial_eta_at: data.etaAt,
          initial_remaining_km: data.remainingKm ?? null,
          last_alert_bucket: 0,
          last_alert_at: null,
        } as never)
        .eq("attribution_id", data.attributionId);
      return { initialEtaAt: data.etaAt, delayMinutes: 0, thresholdMinutes: threshold };
    }

    // Mission clôturée : pas d'alerte.
    const closed = ["terminee", "termine", "validee", "annulee", "refusee"].includes(
      String((visible as { statut?: string }).statut ?? ""),
    );

    const bucket = delay > 0 ? Math.floor(delay / threshold) : 0;

    if (!closed && bucket > (row.last_alert_bucket ?? 0)) {
      await supabaseAdmin
        .from("mission_eta_tracking")
        .update({ last_alert_bucket: bucket, last_alert_at: new Date().toISOString() } as never)
        .eq("attribution_id", data.attributionId);
      try {
        const { sendMissionDelayAlert } = await import("@/lib/mission-delay-alert.server");
        await sendMissionDelayAlert({
          attributionId: data.attributionId,
          trajetId: (visible as { trajet_id?: string | null }).trajet_id ?? null,
          delayMinutes: delay,
          etaAt: data.etaAt,
        });
      } catch (e) {
        console.error("[mission-eta] alerte retard échouée", e);
      }
    }

    return { initialEtaAt: row.initial_eta_at, delayMinutes: delay, thresholdMinutes: threshold };
  });
