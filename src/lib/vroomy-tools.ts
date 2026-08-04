import type { SupabaseClient } from "@supabase/supabase-js";
import { quoteB2C } from "./pricing-engine";
import type { TripType } from "./reservation-pricing";

/**
 * Outils (function calling) exposés à Vroomy, l'assistant IA de Transports Ligneo.
 * Toute l'exécution reste côté serveur : aucune clé, aucune requête privilégiée
 * n'est accessible depuis le navigateur.
 */

export type VroomyCard =
  | { type: "mission"; data: Record<string, unknown> }
  | { type: "devis"; data: Record<string, unknown> };

export type ToolResult = {
  /** Renvoyé au modèle pour qu'il formule sa réponse. */
  payload: Record<string, unknown>;
  /** Carte structurée affichée par le widget, si pertinent. */
  card: VroomyCard | null;
  success: boolean;
  error?: string;
};

export const CANDIDATURE_URL = "/inscription-convoyeur";

/** Déclarations au format OpenAI (compatible Gemini via l'endpoint OpenAI-compatible). */
export const VROOMY_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "chercher_mission",
      description:
        "Recherche le suivi d'une mission de convoyage. Nécessite OBLIGATOIREMENT le numéro de mission ET l'email du client, qui doivent correspondre. Ne jamais appeler sans les deux.",
      parameters: {
        type: "object",
        properties: {
          numero_mission: { type: "string", description: "Numéro de mission, ex. MIS-TLG-2026-#101" },
          email: { type: "string", description: "Email du client ayant commandé la mission" },
        },
        required: ["numero_mission", "email"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "estimer_devis",
      description:
        "Estime le prix, la distance et le délai d'un convoyage entre deux villes françaises, avec la grille tarifaire officielle de Transports Ligneo.",
      parameters: {
        type: "object",
        properties: {
          ville_depart: { type: "string", description: "Ville ou adresse de départ" },
          ville_arrivee: { type: "string", description: "Ville ou adresse d'arrivée" },
          type_livraison: {
            type: "string",
            enum: ["livraison_simple", "restitution_simple", "livraison_restitution", "express"],
            description:
              "livraison_simple / restitution_simple = trajet simple, livraison_restitution = aller-retour, express = prioritaire",
          },
        },
        required: ["ville_depart", "ville_arrivee"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "rediriger_candidature_convoyeur",
      description:
        "Retourne le lien du formulaire de candidature pour devenir convoyeur partenaire Transports Ligneo.",
      parameters: { type: "object", properties: {} },
    },
  },
];

const STATUT_LABEL: Record<string, string> = {
  en_attente: "En attente de planification",
  planifiee: "Planifiée",
  attribuee: "Attribuée à un convoyeur",
  en_cours: "En cours de convoyage",
  livree: "Livrée",
  terminee: "Terminée",
  annulee: "Annulée",
};

function normalizeNumero(v: string) {
  return v.trim().toUpperCase().replace(/\s+/g, "");
}

async function chercherMission(
  admin: SupabaseClient,
  args: { numero_mission?: unknown; email?: unknown },
): Promise<ToolResult> {
  const numero = typeof args.numero_mission === "string" ? normalizeNumero(args.numero_mission) : "";
  const email = typeof args.email === "string" ? args.email.trim().toLowerCase() : "";

  if (!numero || !email || !email.includes("@")) {
    return {
      payload: {
        ok: false,
        raison:
          "Informations incomplètes : demander au visiteur son numéro de mission ET l'email utilisé lors de la commande.",
      },
      card: null,
      success: false,
      error: "missing_args",
    };
  }

  const { data: rows, error } = await admin
    .from("missions")
    .select(
      "id, numero, statut, ville_depart, ville_arrivee, date_prise_en_charge, type_trajet, marque, modele, email, group_reference",
    )
    .or(`numero.eq.${numero},group_reference.eq.${numero}`)
    .limit(2);

  if (error) {
    return { payload: { ok: false, raison: "Erreur technique" }, card: null, success: false, error: error.message };
  }

  const mission = (rows ?? [])[0];
  if (!mission) {
    return {
      payload: { ok: false, raison: "Aucune mission ne correspond à ce numéro." },
      card: null,
      success: true,
    };
  }

  // Contrôle d'accès : l'email doit correspondre au client de la mission.
  if ((mission.email ?? "").trim().toLowerCase() !== email) {
    return {
      payload: {
        ok: false,
        raison:
          "L'email fourni ne correspond pas à cette mission. Ne divulguer AUCUNE information : inviter à vérifier l'email ou à contacter le 07 82 45 61 81.",
      },
      card: null,
      success: true,
    };
  }

  // Convoyeur + étape en cours (facultatif)
  let convoyeur: string | null = null;
  let etape: string | null = null;
  const { data: attribution } = await admin
    .from("attributions")
    .select("etape_courante, statut, convoyeur_id")
    .eq("numero_mission", mission.numero)
    .maybeSingle();
  if (attribution) {
    etape = attribution.etape_courante ?? attribution.statut ?? null;
    if (attribution.convoyeur_id) {
      const { data: c } = await admin
        .from("convoyeurs")
        .select("prenom")
        .eq("id", attribution.convoyeur_id)
        .maybeSingle();
      convoyeur = c?.prenom ?? null;
    }
  }

  const data = {
    numero: mission.numero,
    statut: STATUT_LABEL[mission.statut ?? ""] ?? mission.statut ?? "Inconnu",
    statut_code: mission.statut,
    depart: mission.ville_depart,
    arrivee: mission.ville_arrivee,
    date_prise_en_charge: mission.date_prise_en_charge,
    vehicule: [mission.marque, mission.modele].filter(Boolean).join(" ") || null,
    convoyeur,
    etape,
  };

  return { payload: { ok: true, mission: data }, card: { type: "mission", data }, success: true };
}

function mapTripType(value: unknown): TripType {
  const v = typeof value === "string" ? value : "";
  if (v === "livraison_restitution" || v === "aller_retour") return "aller_retour";
  if (v === "express") return "express";
  return "aller_simple";
}

function estimerDevis(args: {
  ville_depart?: unknown;
  ville_arrivee?: unknown;
  type_livraison?: unknown;
}): ToolResult {
  const depart = typeof args.ville_depart === "string" ? args.ville_depart.trim() : "";
  const arrivee = typeof args.ville_arrivee === "string" ? args.ville_arrivee.trim() : "";
  if (!depart || !arrivee) {
    return {
      payload: { ok: false, raison: "Demander la ville de départ et la ville d'arrivée." },
      card: null,
      success: false,
      error: "missing_args",
    };
  }

  const type = mapTripType(args.type_livraison);
  const quote = quoteB2C({ depart, arrivee, type });

  if (!quote.isEstimable) {
    return {
      payload: {
        ok: false,
        raison:
          "Trajet non couvert par la grille automatique : proposer un devis personnalisé via la page Estimer mon trajet ou le 07 82 45 61 81.",
      },
      card: null,
      success: true,
    };
  }

  const delai = type === "express" ? "24 h" : quote.distanceKm && quote.distanceKm > 500 ? "48 à 72 h" : "24 à 48 h";
  const data = {
    depart,
    arrivee,
    type_livraison:
      type === "aller_retour" ? "Livraison + restitution" : type === "express" ? "Express" : "Livraison simple",
    distance_km: quote.distanceKm,
    prix_ttc: quote.priceTtc,
    prix_ht: quote.priceHt,
    delai_estime: delai,
  };

  return { payload: { ok: true, estimation: data }, card: { type: "devis", data }, success: true };
}

export async function runVroomyTool(
  admin: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  switch (name) {
    case "chercher_mission":
      return chercherMission(admin, args);
    case "estimer_devis":
      return estimerDevis(args);
    case "rediriger_candidature_convoyeur":
      return {
        payload: {
          ok: true,
          url: CANDIDATURE_URL,
          message:
            "Formulaire de candidature convoyeur (permis B depuis 3 ans minimum, casier vierge, statut indépendant ou accompagnement possible).",
        },
        card: null,
        success: true,
      };
    default:
      return { payload: { ok: false, raison: "Outil inconnu" }, card: null, success: false, error: "unknown_tool" };
  }
}
