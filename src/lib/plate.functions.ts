import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const PlateSchema = z.object({
  plate: z
    .string()
    .trim()
    .min(4)
    .max(15)
    .regex(/^[A-Z0-9-]+$/i, "Plaque invalide"),
});

export type PlateLookupResult = {
  ok: boolean;
  error?: string;
  data?: {
    vin?: string;
    marque?: string;
    modele?: string;
    annee?: string;
    carburant?: string;
    puissance?: string;
    finition?: string;
  };
};

const RAPIDAPI_HOST = "api-de-plaque-d-immatriculation-france.p.rapidapi.com";

/** Aplatit un objet imbriqué en index { clé → valeur primitive }, gère cas data.data.AWN_*. */
function flatten(obj: any, out: Record<string, any> = {}, depth = 0): Record<string, any> {
  if (!obj || typeof obj !== "object" || depth > 4) return out;
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    if (typeof v === "object" && !Array.isArray(v)) {
      flatten(v, out, depth + 1);
    } else if (v !== "" && typeof v !== "object") {
      // garde la première occurrence (priorité racine)
      if (!(k in out)) out[k] = v;
    }
  }
  return out;
}

function isMeaningful(v: any): boolean {
  if (v == null) return false;
  const s = String(v).trim();
  if (!s) return false;
  const up = s.toUpperCase();
  return up !== "INCONNU" && up !== "N/A" && up !== "NULL" && up !== "0";
}

function pick(flat: Record<string, any>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = flat[k];
    if (isMeaningful(v)) return String(v);
  }
  return undefined;
}

// Validator that NEVER throws — returns a sentinel that the handler converts to a clean error response.
// This avoids letting TanStack/seroval try to serialize a ZodError (which fails with "Seroval Error step: 3").
type ValidInput = { __ok: true; plate: string };
type InvalidInput = { __ok: false; error: string };

export const lookupPlate = createServerFn({ method: "POST" })
  .inputValidator((input: unknown): ValidInput | InvalidInput => {
    const parsed = PlateSchema.safeParse(input);
    if (!parsed.success) {
      return { __ok: false, error: "Plaque invalide" };
    }
    return { __ok: true, plate: parsed.data.plate };
  })
  .handler(async ({ data }): Promise<PlateLookupResult> => {
    try {
      if (!data.__ok) {
        return { ok: false, error: data.error };
      }

      const apiKey = process.env.RAPIDAPI_KEY;
      if (!apiKey) {
        console.error("[SIV] RAPIDAPI_KEY missing");
        return { ok: false, error: "Service non configuré" };
      }

      const plate = data.plate.toUpperCase().replace(/[\s-]+/g, "");
      console.log("[SIV] start", plate);

      const url = `https://${RAPIDAPI_HOST}/?plaque=${encodeURIComponent(plate)}`;

      let res: Response;
      try {
        res = await fetch(url, {
          method: "GET",
          headers: {
            "x-rapidapi-key": apiKey,
            "x-rapidapi-host": RAPIDAPI_HOST,
          },
        });
      } catch (fetchErr) {
        const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
        console.error("[SIV] fetch threw", msg);
        return { ok: false, error: "Service indisponible" };
      }

      console.log("[SIV] status", res.status);

      if (!res.ok) {
        let bodyTxt = "";
        try {
          bodyTxt = await res.text();
        } catch {}
        console.error("[SIV] non-ok body", bodyTxt.slice(0, 500));
        if (res.status === 404) return { ok: false, error: "Plaque introuvable" };
        if (res.status === 401 || res.status === 403)
          return { ok: false, error: "Clé API invalide" };
        return { ok: false, error: `Erreur API (${res.status})` };
      }

      let json: any;
      try {
        json = await res.json();
      } catch (parseErr) {
        const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
        console.error("[SIV] json parse failed", msg);
        return { ok: false, error: "Réponse API invalide" };
      }

      const root: any = json?.data ?? json?.result ?? json?.vehicule ?? json;
      console.log("[SIV] body keys", root && typeof root === "object" ? Object.keys(root).slice(0, 80) : typeof root);

      const result = {
        vin: pick(root, ["AWN_VIN", "vin", "VIN", "numero_serie", "numeroSerie", "numero_vin"]),
        marque: pick(root, ["AWN_marque", "marque", "make", "brand", "marqueVehicule", "Marque"]),
        modele: pick(root, [
          "AWN_modele",
          "AWN_modele_etendu",
          "AWN_modele_commercial",
          "modele",
          "model",
          "modeleVehicule",
          "Modele",
          "modele_commercial",
        ]),
        annee: pick(root, [
          "AWN_date_de_premiere_mise_en_circulation",
          "AWN_annee_de_debut_modele",
          "AWN_annee_modele",
          "annee",
          "year",
          "date_mise_en_circulation",
          "premiereMiseEnCirculation",
          "anneeModele",
          "dateMiseEnCirculation",
          "date1erCir_fr",
          "date1erCir_us",
          "premiere_immatriculation",
          "datePremiereMiseCirculation",
        ]),
        carburant: pick(root, [
          "AWN_energie",
          "AWN_energie_NGC",
          "AWN_carburant",
          "carburant",
          "energie",
          "fuel",
          "energy",
          "Energie",
          "energieNGC",
        ]),
        puissance: pick(root, [
          "AWN_puissance_fiscale",
          "AWN_puissance_din",
          "AWN_puissance_kw",
          "puissance",
          "puissance_fiscale",
          "puissanceFiscale",
          "power",
          "puissanceCh",
          "puisFisc",
          "puissance_din",
        ]),
        finition: pick(root, ["AWN_version", "AWN_serie", "finition", "version", "variant", "Version"]),
      };

      const hasAny = Object.values(result).some((v) => v);
      if (!hasAny) {
        console.warn("[SIV] no fields matched in response", JSON.stringify(root).slice(0, 500));
        return { ok: false, error: "Aucune donnée véhicule trouvée" };
      }

      return { ok: true, data: result };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[SIV] unexpected error", msg);
      return { ok: false, error: "Service indisponible" };
    }
  });
