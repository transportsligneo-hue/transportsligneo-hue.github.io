/**
 * Logique serveur du suivi de mission public (numéro + code confidentiel).
 * - vérification stricte de la combinaison numéro / code
 * - limitation des tentatives (anti-devinette automatisée)
 */
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";

export type PublicTracking = {
  found: boolean;
  /** true si l'accès est temporairement bloqué (trop de tentatives) */
  blocked?: boolean;
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

const MAX_FAILED = 5;
const WINDOW_MIN = 10;
const BLOCK_MIN = 10;

export function mapStatut(s: string | null): PublicTracking["statut"] {
  const v = (s ?? "").toLowerCase();
  if (["termine", "validee", "livree", "en_attente_validation"].includes(v)) return "livree";
  if (["annule", "annulee"].includes(v)) return "annulee";
  if (v === "en_cours") return "en_cours";
  return "en_attente";
}

function fingerprint(): string {
  try {
    const ip =
      getRequestHeader("cf-connecting-ip") ||
      getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ||
      getRequestIP({ xForwardedFor: true }) ||
      "unknown";
    return `suivi:${ip}`;
  } catch {
    return "suivi:unknown";
  }
}

export function normalizeCode(v: string): string {
  return v.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export async function trackMission(input: {
  numero: string;
  code: string;
}): Promise<PublicTracking> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const fp = fingerprint();
  const now = new Date();

  // --- Rate limiting
  const { data: attempt } = await supabaseAdmin
    .from("public_tracking_attempts")
    .select("id, failed_count, window_started_at, blocked_until")
    .eq("fingerprint", fp)
    .maybeSingle();

  if (attempt?.blocked_until && new Date(attempt.blocked_until) > now) {
    return { found: false, blocked: true };
  }

  const numero = input.numero.trim().toUpperCase();
  const code = normalizeCode(input.code);

  const { data: mission } = await supabaseAdmin
    .from("missions")
    .select(
      "id, numero, statut, ville_depart, ville_arrivee, date_prise_en_charge, updated_at, tracking_code",
    )
    .ilike("numero", numero)
    .maybeSingle();

  const ok = !!mission && (mission.tracking_code ?? "").toUpperCase() === code && code.length > 0;

  if (!ok) {
    const windowExpired =
      !attempt || new Date(attempt.window_started_at).getTime() + WINDOW_MIN * 60_000 < now.getTime();
    const failed = windowExpired ? 1 : (attempt?.failed_count ?? 0) + 1;
    const blocked = failed >= MAX_FAILED;
    await supabaseAdmin.from("public_tracking_attempts").upsert(
      {
        fingerprint: fp,
        failed_count: blocked ? 0 : failed,
        window_started_at: windowExpired || blocked ? now.toISOString() : attempt!.window_started_at,
        blocked_until: blocked ? new Date(now.getTime() + BLOCK_MIN * 60_000).toISOString() : null,
        updated_at: now.toISOString(),
      },
      { onConflict: "fingerprint" },
    );
    return { found: false, blocked };
  }

  // Succès : on réinitialise le compteur
  if (attempt) {
    await supabaseAdmin
      .from("public_tracking_attempts")
      .update({ failed_count: 0, blocked_until: null, updated_at: now.toISOString() })
      .eq("id", attempt.id);
  }

  let etape: string | null = null;
  let position: { lat: number; lng: number } | null = null;
  let updated_at: string | null = mission!.updated_at ?? null;

  const { data: trajets } = await supabaseAdmin
    .from("trajets")
    .select("id")
    .eq("mission_id", mission!.id);
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
      if (mapStatut(mission!.statut) === "en_cours") {
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
    numero: mission!.numero,
    statut: mapStatut(mission!.statut),
    ville_depart: mission!.ville_depart,
    ville_arrivee: mission!.ville_arrivee,
    date_prise_en_charge: mission!.date_prise_en_charge,
    etape,
    position,
    updated_at,
  };
}
