/**
 * Server functions publiques (aucune authentification) :
 * - suivi de mission par numéro (données minimales, aucune donnée personnelle)
 * - inscription newsletter
 * - réglages publics (liens stores)
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const trackSchema = z.object({
  numero: z.string().trim().min(3).max(40),
});

export type PublicTracking = {
  found: boolean;
  numero?: string;
  statut?: "en_attente" | "en_cours" | "livree" | "annulee";
  ville_depart?: string | null;
  ville_arrivee?: string | null;
  date_prise_en_charge?: string | null;
  etape?: string | null;
  /** Position approximative (arrondie ~1 km) */
  position?: { lat: number; lng: number } | null;
  updated_at?: string | null;
};

function mapStatut(s: string | null): PublicTracking["statut"] {
  const v = (s ?? "").toLowerCase();
  if (["termine", "validee", "livree", "en_attente_validation"].includes(v)) return "livree";
  if (["annule", "annulee"].includes(v)) return "annulee";
  if (v === "en_cours") return "en_cours";
  return "en_attente";
}

export const trackMissionPublic = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => trackSchema.parse(d))
  .handler(async ({ data }): Promise<PublicTracking> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const numero = data.numero.trim().toUpperCase();

    const { data: mission } = await supabaseAdmin
      .from("missions")
      .select("id, numero, statut, ville_depart, ville_arrivee, date_prise_en_charge, updated_at")
      .ilike("numero", numero)
      .maybeSingle();

    if (!mission) return { found: false };

    let etape: string | null = null;
    let position: { lat: number; lng: number } | null = null;
    let updated_at: string | null = mission.updated_at ?? null;

    const { data: trajets } = await supabaseAdmin
      .from("trajets")
      .select("id")
      .eq("mission_id", mission.id);
    const trajetIds = (trajets ?? []).map((t) => t.id);

    if (trajetIds.length > 0) {
      const { data: attribution } = await supabaseAdmin
        .from("attributions")
        .select("id, statut, etape_courante")
        .in("trajet_id", trajetIds)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (attribution) {
        etape = attribution.etape_courante ?? attribution.statut ?? null;
        if (mapStatut(mission.statut) === "en_cours") {
          const { data: loc } = await supabaseAdmin
            .from("mission_locations")
            .select("latitude, longitude, recorded_at")
            .eq("attribution_id", attribution.id)
            .order("recorded_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (loc) {
            position = {
              lat: Math.round(loc.latitude * 100) / 100,
              lng: Math.round(loc.longitude * 100) / 100,
            };
            updated_at = loc.recorded_at;
          }
        }
      }
    }

    return {
      found: true,
      numero: mission.numero,
      statut: mapStatut(mission.statut),
      ville_depart: mission.ville_depart,
      ville_arrivee: mission.ville_arrivee,
      date_prise_en_charge: mission.date_prise_en_charge,
      etape,
      position,
      updated_at,
    };
  });

const newsletterSchema = z.object({
  email: z.string().trim().email().max(255),
  source: z.string().trim().max(40).optional(),
});

export const subscribeNewsletter = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => newsletterSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();
    const { error } = await supabaseAdmin
      .from("newsletter_abonnes")
      .upsert(
        { email, source: data.source ?? "footer", unsubscribed_at: null },
        { onConflict: "email" },
      );
    if (error) throw new Error("Inscription impossible pour le moment.");
    return { ok: true };
  });

export type StoreLinks = { ios: string | null; android: string | null };

export const getStoreLinks = createServerFn({ method: "GET" }).handler(
  async (): Promise<StoreLinks> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "store_links")
      .maybeSingle();
    const v = (data?.value ?? {}) as Record<string, unknown>;
    const clean = (x: unknown) =>
      typeof x === "string" && /^https:\/\//.test(x.trim()) ? x.trim() : null;
    return { ios: clean(v["ios"]), android: clean(v["android"]) };
  },
);
