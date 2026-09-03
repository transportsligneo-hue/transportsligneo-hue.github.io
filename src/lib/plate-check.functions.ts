/**
 * Vérification de plaque avant état des lieux (app convoyeur).
 *
 * - Lecture de la plaque via l'API Plate Recognizer (Snapshot). La clé reste
 *   strictement côté serveur (PLATE_RECOGNIZER_TOKEN).
 * - La plaque de référence provient du dossier mission déjà enregistré
 *   (trajets.immatriculation) : rien n'est demandé au client ni à l'admin.
 * - La comparaison est faite côté Ligneo (normalisation espaces/tirets/casse).
 * - Chaque vérification est tracée dans public.mission_plate_checks.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Seuil de confiance en dessous duquel on propose la saisie manuelle. */
export const PLATE_CONFIDENCE_MIN = 0.7;

export type PlateCheckResult = {
  ok: boolean;
  error?: string;
  /** Plaque attendue (dossier mission), normalisée pour l'affichage. */
  expected?: string | null;
  /** Plaque lue par l'API (ou saisie manuellement), en majuscules. */
  scanned?: string | null;
  confidence?: number | null;
  /** match | mismatch | low_confidence | no_plate | no_reference */
  status?: "match" | "mismatch" | "low_confidence" | "no_plate" | "no_reference";
  method?: "scan" | "manual";
};

/** Normalise une plaque : majuscules, sans espaces ni tirets ni ponctuation. */
export function normalizePlate(value?: string | null): string {
  return (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

type Input = {
  attributionId: string;
  /** Image JPEG en base64 (sans préfixe data:) — requis si method = "scan". */
  imageBase64?: string;
  /** Chemin storage de la photo déjà uploadée (traçabilité). */
  photoPath?: string;
  /** Plaque saisie à la main en secours. */
  manualPlate?: string;
  method: "scan" | "manual";
  phase?: "depart" | "arrivee";
};

export const verifyMissionPlate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Input) => input)
  .handler(async ({ data, context }): Promise<PlateCheckResult> => {
    const { supabase, userId } = context;
    const attributionId = String(data.attributionId ?? "");
    if (!attributionId) return { ok: false, error: "Mission inconnue" };

    // 1. Plaque de référence : dossier mission (RLS = le convoyeur assigné)
    const { data: attr } = await supabase
      .from("attributions")
      .select("trajet_id")
      .eq("id", attributionId)
      .maybeSingle();
    let expectedRaw: string | null = null;
    if (attr?.trajet_id) {
      const { data: traj } = await supabase
        .from("trajets_assigned_safe" as never)
        .select("immatriculation")
        .eq("id", attr.trajet_id)
        .maybeSingle();
      expectedRaw = (traj as { immatriculation?: string | null } | null)?.immatriculation ?? null;
    }
    const expected = normalizePlate(expectedRaw);

    // 2. Lecture de la plaque
    let scanned = "";
    let confidence: number | null = null;
    let raw: unknown = null;

    if (data.method === "manual") {
      scanned = normalizePlate(data.manualPlate);
      if (!scanned) return { ok: false, error: "Plaque saisie invalide" };
      confidence = 1;
    } else {
      const token = process.env["PLATE_RECOGNIZER_TOKEN"];
      if (!token) {
        console.error("[PLATE-CHECK] PLATE_RECOGNIZER_TOKEN manquant");
        return { ok: false, error: "Service de lecture non configuré" };
      }
      const b64 = (data.imageBase64 ?? "").replace(/^data:[^,]+,/, "");
      if (!b64) return { ok: false, error: "Photo manquante" };

      const form = new FormData();
      form.append("upload", b64);
      form.append("regions", "fr");

      let res: Response;
      try {
        res = await fetch("https://api.platerecognizer.com/v1/plate-reader/", {
          method: "POST",
          headers: { Authorization: `Token ${token}` },
          body: form,
        });
      } catch (err) {
        console.error("[PLATE-CHECK] fetch failed", err);
        return { ok: false, error: "Service de lecture indisponible" };
      }

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.error("[PLATE-CHECK] api error", res.status, txt.slice(0, 300));
        if (res.status === 401 || res.status === 403) return { ok: false, error: "Clé de lecture invalide" };
        if (res.status === 429) return { ok: false, error: "Quota de lecture atteint" };
        return { ok: false, error: `Erreur de lecture (${res.status})` };
      }

      const json = (await res.json().catch(() => null)) as
        | { results?: Array<{ plate?: string; score?: number }> }
        | null;
      raw = json;
      const best = json?.results?.[0];
      scanned = normalizePlate(best?.plate);
      confidence = typeof best?.score === "number" ? best.score : null;
    }

    // 3. Comparaison côté Ligneo
    let status: NonNullable<PlateCheckResult["status"]>;
    if (!scanned) status = "no_plate";
    else if (data.method === "scan" && confidence !== null && confidence < PLATE_CONFIDENCE_MIN) status = "low_confidence";
    else if (!expected) status = "no_reference";
    else status = scanned === expected ? "match" : "mismatch";

    // 4. Traçabilité
    try {
      await supabase.from("mission_plate_checks").insert({
        attribution_id: attributionId,
        user_id: userId,
        phase: data.phase ?? "depart",
        expected_plate: expectedRaw,
        scanned_plate: scanned || null,
        method: data.method,
        result: status,
        confidence,
        photo_path: data.photoPath ?? null,
        raw_response: raw as never,
      });
    } catch (err) {
      console.error("[PLATE-CHECK] trace insert failed", err);
    }

    return {
      ok: true,
      expected: expectedRaw ? expectedRaw.toUpperCase() : null,
      scanned: scanned || null,
      confidence,
      status,
      method: data.method,
    };
  });

/** Force le passage malgré un échec de vérification : trace explicite. */
export const recordPlateOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { attributionId: string; expected?: string | null; scanned?: string | null; phase?: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase.from("mission_plate_checks").insert({
      attribution_id: data.attributionId,
      user_id: userId,
      phase: data.phase ?? "depart",
      expected_plate: data.expected ?? null,
      scanned_plate: data.scanned ?? null,
      method: "override",
      result: "forced_continue",
    });
    return { ok: true };
  });
