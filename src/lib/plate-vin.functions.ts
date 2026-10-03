/**
 * Recherche du VIN à partir de la plaque d'immatriculation (espace client).
 *
 * - Appelle un service SIV via RapidAPI (clé RAPIDAPI_KEY, côté serveur uniquement).
 * - Le client peut toujours saisir le VIN à la main : la recherche n'est qu'une aide.
 * - Aucune donnée n'est enregistrée : simple lecture.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PlateVinResult = {
  ok: boolean;
  vin?: string | null;
  error?: string;
};

function normalizePlate(value?: string | null): string {
  return (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export const lookupVinByPlate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { plate: string }) => input)
  .handler(async ({ data }): Promise<PlateVinResult> => {
    const plate = normalizePlate(data.plate);
    if (plate.length < 5 || plate.length > 9) {
      return { ok: false, error: "Plaque invalide" };
    }

    const apiKey = process.env["RAPIDAPI_KEY"];
    if (!apiKey) {
      return { ok: false, error: "Recherche par plaque indisponible — saisissez le VIN manuellement" };
    }

    const host = process.env["PLATE_VIN_API_HOST"] ?? "plaque-immatriculation-siv.p.rapidapi.com";
    const url = `https://${host}/immatriculation/${encodeURIComponent(plate)}`;

    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          "x-rapidapi-key": apiKey,
          "x-rapidapi-host": host,
        },
      });
    } catch (err) {
      console.error("[PLATE-VIN] fetch failed", err);
      return { ok: false, error: "Service de recherche indisponible" };
    }

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("[PLATE-VIN] api error", res.status, txt.slice(0, 300));
      if (res.status === 404) return { ok: false, error: "Aucun véhicule trouvé pour cette plaque" };
      if (res.status === 401 || res.status === 403) return { ok: false, error: "Recherche par plaque indisponible" };
      if (res.status === 429) return { ok: false, error: "Trop de recherches — réessayez dans un instant" };
      return { ok: false, error: `Recherche impossible (${res.status})` };
    }

    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    // Les services SIV renvoient le VIN sous des clés variables.
    const candidates: unknown[] = [
      json?.["vin"],
      (json?.["data"] as Record<string, unknown> | undefined)?.["vin"],
      (json?.["vehicle"] as Record<string, unknown> | undefined)?.["vin"],
      json?.["Vin"],
      json?.["VIN"],
    ];
    const vin = candidates
      .map((c) => (typeof c === "string" ? c.toUpperCase().replace(/[^A-Z0-9]/g, "") : ""))
      .find((c) => c.length === 17);

    if (!vin) {
      return { ok: false, error: "VIN introuvable pour cette plaque — saisissez-le manuellement" };
    }
    return { ok: true, vin };
  });
