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

const RAPIDAPI_HOST = "api-siv-systeme-d-immatriculation-des-vehicules.p.rapidapi.com";

function pick(obj: any, keys: string[]): string | undefined {
  for (const k of keys) {
    const parts = k.split(".");
    let cur: any = obj;
    for (const p of parts) {
      if (cur == null) break;
      cur = cur[p];
    }
    if (cur != null && cur !== "") return String(cur);
  }
  return undefined;
}

export const lookupPlate = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => PlateSchema.parse(input))
  .handler(async ({ data }): Promise<PlateLookupResult> => {
    const apiKey = process.env.RAPIDAPI_KEY;
    if (!apiKey) {
      return { ok: false, error: "RAPIDAPI_KEY non configurée" };
    }

    const plate = data.plate.toUpperCase().replace(/\s+/g, "");
    const url = `https://${RAPIDAPI_HOST}/${encodeURIComponent(plate)}`;

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "x-rapidapi-key": apiKey,
          "x-rapidapi-host": RAPIDAPI_HOST,
        },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("SIV lookup failed", res.status, text);
        if (res.status === 404) return { ok: false, error: "Plaque introuvable" };
        return { ok: false, error: `Erreur API (${res.status})` };
      }

      const json: any = await res.json();
      const root = json?.data ?? json?.result ?? json?.vehicule ?? json;

      const result = {
        vin: pick(root, ["vin", "VIN", "numero_serie", "numeroSerie"]),
        marque: pick(root, ["marque", "make", "brand", "marqueVehicule"]),
        modele: pick(root, ["modele", "model", "modeleVehicule", "type"]),
        annee: pick(root, ["annee", "year", "date_mise_en_circulation", "premiereMiseEnCirculation", "anneeModele"]),
        carburant: pick(root, ["carburant", "energie", "fuel", "energy"]),
        puissance: pick(root, ["puissance", "puissance_fiscale", "puissanceFiscale", "power", "puissanceCh"]),
        finition: pick(root, ["finition", "version", "variant"]),
      };

      const hasAny = Object.values(result).some((v) => v);
      if (!hasAny) {
        return { ok: false, error: "Aucune donnée véhicule trouvée" };
      }

      return { ok: true, data: result };
    } catch (e: any) {
      console.error("SIV lookup error", e);
      return { ok: false, error: "Service indisponible" };
    }
  });
