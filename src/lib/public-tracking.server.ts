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
  /** Véhicule convoyé (marque + modèle) */
  vehicule?: string | null;
  immatriculation?: string | null;
  /** Nom du destinataire à la livraison (jamais de téléphone ni d'e-mail) */
  destinataire?: string | null;
  /** Dernière position GPS, accessible uniquement après vérification du code. */
  position?: { lat: number; lng: number } | null;
  points?: Array<{ latitude: number; longitude: number; recorded_at: string; accuracy: number | null }>;
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

  const code = normalizeCode(input.code);

  // Le visiteur peut taper le numéro complet (MIS-TLG-2026-#116) ou juste le
  // numéro court (116) : on normalise vers la recherche la plus souple.
  const rawNumero = input.numero.trim().toUpperCase();
  const shortMatch = rawNumero.match(/^#?(\d{1,5})$/);
  const numeroPattern = shortMatch ? `%#${shortMatch[1]}` : rawNumero;

  // Un numéro peut couvrir plusieurs lignes (aller + retour) : on prend la ligne
  // dont le code correspond.
  const { data: candidates } = await supabaseAdmin
    .from("missions")
    .select(
      "id, numero, statut, ville_depart, ville_arrivee, date_prise_en_charge, updated_at, tracking_code",
    )
    .ilike("numero", numeroPattern)
    .limit(5);

  const mission = (candidates ?? []).find(
    (m) => (m.tracking_code ?? "").toUpperCase() === code && code.length > 0,
  );

  if (!mission) {
    const windowExpired =
      !attempt || new Date(attempt.window_started_at).getTime() + WINDOW_MIN * 60_000 < now.getTime();
    const failed = windowExpired ? 1 : (attempt?.failed_count ?? 0) + 1;
    const blocked = failed >= MAX_FAILED;
    await supabaseAdmin.from("public_tracking_attempts").upsert(
      {
        fingerprint: fp,
        failed_count: blocked ? 0 : failed,
        window_started_at: windowExpired || blocked ? now.toISOString() : (attempt?.window_started_at ?? now.toISOString()),
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
  let updated_at: string | null = mission.updated_at ?? null;
  let points: NonNullable<PublicTracking["points"]> = [];

  const { data: trajets } = await supabaseAdmin
    .from("trajets")
    .select("id, marque, modele, immatriculation, contact_arrivee_nom, contact_depart_nom")
    .eq("mission_id", mission.id);
  const trajetIds = (trajets ?? []).map((t) => t.id);

  // Infos véhicule + destinataire (jamais de téléphone ni d'e-mail ici).
  const t0 = (trajets ?? [])[0];
  const vehicule = t0 ? [t0.marque, t0.modele].filter(Boolean).join(" ") || null : null;
  const immatriculation = t0?.immatriculation ?? null;
  const destinataire = t0?.contact_arrivee_nom ?? t0?.contact_depart_nom ?? null;

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
      if (["en_cours", "livree"].includes(mapStatut(mission.statut) ?? "")) {
        const { data: locations, error } = await supabaseAdmin
          .from("mission_locations")
          .select("latitude, longitude, recorded_at, accuracy")
          .eq("attribution_id", attribution.id)
          .order("recorded_at", { ascending: false })
          .limit(2000);
        if (error) throw new Error("Suivi GPS momentanément indisponible");
        points = (locations ?? []).reverse();
        const loc = points.at(-1);
        if (loc) {
          position = {
            lat: loc.latitude,
            lng: loc.longitude,
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
    vehicule,
    immatriculation,
    destinataire,
    position,
    points,
    updated_at,
  };
}
