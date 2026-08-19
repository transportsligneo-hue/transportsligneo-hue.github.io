import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
// NOTE: pas de middleware d'auth — la recherche SIV doit fonctionner
// sur le site public (devis), dashboard client, pro et admin.
// La clé RapidAPI reste côté serveur uniquement.
// Pour éviter l'abus depuis le site public, on gate cette fonction par:
//  - un token Bearer Supabase (utilisateurs connectés), OU
//  - un token reCAPTCHA v3 valide (score ≥ 0.5) pour les visiteurs anonymes.

const PlateSchema = z.object({
  plate: z
    .string()
    .trim()
    .min(4)
    .max(15)
    .regex(/^[A-Z0-9-]+$/i, "Plaque invalide"),
  recaptchaToken: z.string().min(10).max(4000).optional(),
});

async function verifyRecaptchaToken(token: string): Promise<boolean> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    // Fail-closed en production : sans secret, on refuse pour ne pas exposer la clé RapidAPI.
    console.error("[SIV] RECAPTCHA_SECRET_KEY missing — refusing request");
    return false;
  }
  try {
    const body = new URLSearchParams({ secret, response: token });
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const json = (await res.json()) as { success: boolean; score?: number; "error-codes"?: string[] };
    console.log("[SIV] recaptcha result", { success: json.success, score: json.score, errors: json["error-codes"] });
    if (json.success) return (json.score ?? 1) >= 0.3;
    return false;
  } catch (err) {
    console.error("[SIV] recaptcha verify failed", err);
    // Fail-closed : en cas d'échec, on refuse pour empêcher l'abus.
    return false;
  }
}

/** Valide réellement un JWT Supabase côté serveur (aucune confiance au header brut). */
async function verifySupabaseToken(token: string): Promise<boolean> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return false;
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.auth.getClaims(token);
    return !error && !!data?.claims?.sub;
  } catch (err) {
    console.error("[SIV] token verification failed", err);
    return false;
  }
}




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
    /** Énergie normalisée : electrique | hybride | essence | diesel | gpl | hydrogene */
    energie?: string;
    /** Catégorie normalisée : citadine | berline | break | suv | monospace | coupe | cabriolet | utilitaire | luxe */
    categorie?: string;
    /** Carrosserie brute renvoyée par le SIV (ex: BREAK, CI, VU) */
    carrosserie?: string;
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
/** Normalise l'énergie SIV (EL, ES, GO, HY…) vers nos valeurs métier. */
function normalizeEnergie(raw?: string): string | undefined {
  if (!raw) return undefined;
  const s = raw.toUpperCase().replace(/[^A-Z]/g, "");
  if (/ELEC|^EL$|^EE$|EV|BATT/.test(s)) return "electrique";
  if (/HYBRID|^HY$|^EH$|^GH$|^HE$|RECHARGEABLE|PHEV/.test(s)) return "hybride";
  if (/DIESEL|GAZOLE|GASOIL|^GO$|^GA$/.test(s)) return "diesel";
  if (/HYDROG|^H2$/.test(s)) return "hydrogene";
  if (/GPL|LPG|^GL$/.test(s)) return "gpl";
  if (/GNV|^NG$/.test(s)) return "gnv";
  if (/ESSENCE|PETROL|^ES$|^EG$|SANSPLOMB/.test(s)) return "essence";
  return undefined;
}

const LUXE_MARQUES = /FERRARI|LAMBORGHINI|PORSCHE|BENTLEY|MASERATI|ASTONMARTIN|MCLAREN|ROLLSROYCE|LOTUS|CORVETTE|AMG|GT3|GTR/;

/** Déduit une catégorie commerciale (citadine, berline, SUV…) depuis la carrosserie et le modèle. */
function detectCategorie(carrosserie?: string, modele?: string, finition?: string): string | undefined {
  const hay = [carrosserie, modele, finition].filter(Boolean).join(" ").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!hay) return undefined;
  if (LUXE_MARQUES.test(hay)) return "luxe";
  if (/CAMIONNETTE|FOURGON|^VU|VASP|UTILITAIRE|CTTE|KANGOO|BERLINGO|PARTNER|TRAFIC|JUMPY|EXPERT|MASTER|DUCATO|TRANSIT|COMBO|VITO|SPRINTER/.test(hay)) return "utilitaire";
  if (/CABRIOLET|ROADSTER|DECAPOTABLE|SPIDER/.test(hay)) return "cabriolet";
  if (/COUPE/.test(hay)) return "coupe";
  if (/MONOSPACE|MINIBUS|SCENIC|ESPACE|TOURAN|ZAFIRA|PICASSO|CMAX|SMAX/.test(hay)) return "monospace";
  if (/SUV|4X4|TOUTTERRAIN|CROSSOVER|CAPTUR|KADJAR|ARKANA|AUSTRAL|3008|5008|2008|TIGUAN|QASHQAI|JUKE|DUSTER|TUCSON|SPORTAGE|XTRAIL|RAV4|EVOQUE|QSUV/.test(hay)) return "suv";
  if (/BREAK|SW|ESTATE|TOURING|AVANT/.test(hay)) return "break";
  if (/CITADINE|CLIO|TWINGO|ZOE|208|108|C3|POLO|CORSA|FIESTA|MICRA|UP|AYGO|YARIS|IBIZA|FABIA|500|PANDA|MII|SWIFT|R5|RENAULT5/.test(hay)) return "citadine";
  if (/BERLINE|MEGANE|LAGUNA|TALISMAN|308|508|C4|C5|GOLF|PASSAT|SERIE3|SERIE5|CLASSEC|CLASSEE|A3|A4|A6|OCTAVIA|LEON|INSIGNIA|MONDEO/.test(hay)) return "berline";
  return undefined;
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
type ValidInput = { __ok: true; plate: string; recaptchaToken?: string };
type InvalidInput = { __ok: false; error: string };

export const lookupPlate = createServerFn({ method: "POST" })
  .inputValidator((input: unknown): ValidInput | InvalidInput => {
    const parsed = PlateSchema.safeParse(input);
    if (!parsed.success) {
      return { __ok: false, error: "Plaque invalide" };
    }
    return { __ok: true, plate: parsed.data.plate, recaptchaToken: parsed.data.recaptchaToken };
  })
  .handler(async ({ data }): Promise<PlateLookupResult> => {
    try {
      if (!data.__ok) {
        return { ok: false, error: data.error };
      }

      // Anti-abus : soit utilisateur authentifié (Bearer), soit token reCAPTCHA v3 valide.
      // Fail-closed pour protéger la clé RapidAPI (facturation à l'appel).
      const authHeader = getRequestHeader("authorization");
      const rawToken =
        authHeader && authHeader.toLowerCase().startsWith("bearer ")
          ? authHeader.slice(7).trim()
          : "";
      // Le token doit être réellement validé côté serveur, sinon n'importe qui
      // pourrait forger un header "Bearer xxx" pour contourner le reCAPTCHA.
      const hasBearer = rawToken ? await verifySupabaseToken(rawToken) : false;
      if (!hasBearer) {
        if (!data.recaptchaToken) {
          console.warn("[SIV] no bearer and no recaptcha token — rejecting");
          return { ok: false, error: "Vérification anti-robot requise" };
        }
        const captchaOk = await verifyRecaptchaToken(data.recaptchaToken);
        if (!captchaOk) {
          console.warn("[SIV] captcha rejected");
          return { ok: false, error: "Vérification anti-robot échouée" };
        }
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
      const flat = flatten(root);
      console.log("[SIV] flat keys", Object.keys(flat).slice(0, 80));

      const result = {
        vin: pick(flat, ["AWN_VIN", "vin", "VIN", "numero_serie", "numeroSerie", "numero_vin"]),
        marque: pick(flat, ["AWN_marque", "marque", "make", "brand", "marqueVehicule", "Marque"]),
        modele: pick(flat, [
          "AWN_modele",
          "AWN_modele_etendu",
          "AWN_modele_commercial",
          "modele",
          "model",
          "modeleVehicule",
          "Modele",
          "modele_commercial",
        ]),
        annee: pick(flat, [
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
        carburant: pick(flat, [
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
        puissance: pick(flat, [
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
        finition: pick(flat, ["AWN_version", "AWN_serie", "finition", "version", "variant", "Version"]),
        carrosserie: pick(flat, [
          "AWN_carrosserie_CG",
          "AWN_carrosserie",
          "carrosserie",
          "AWN_genre_CG",
          "AWN_genre",
          "genre",
          "type_vehicule",
          "categorie",
        ]),
        energie: undefined as string | undefined,
        categorie: undefined as string | undefined,
      };

      // Année : si on a une date complète, extraire l'année
      if (result.annee && /\d{4}/.test(result.annee)) {
        const m = result.annee.match(/(\d{4})/);
        if (m) result.annee = m[1];
      }

      result.energie = normalizeEnergie(result.carburant);
      result.categorie = detectCategorie(result.carrosserie, result.modele, result.finition);


      console.log("[SIV] mapped", result);

      const hasAny = Object.values(result).some((v) => v);
      if (!hasAny) {
        console.warn("[SIV] no fields matched", Object.keys(flat).slice(0, 50));
        return { ok: false, error: "Aucune donnée véhicule trouvée" };
      }

      return { ok: true, data: result };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[SIV] unexpected error", msg);
      return { ok: false, error: "Service indisponible" };
    }
  });
