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
  | { type: "devis"; data: Record<string, unknown> }
  | { type: "catalogue"; data: { ville: string | null; missions: Array<Record<string, unknown>> } }
  | { type: "login"; data: { url: string } };

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
        "Recherche le suivi d'une mission de convoyage APPARTENANT À L'UTILISATEUR CONNECTÉ. Réservé aux visiteurs authentifiés : si le visiteur n'est pas connecté, l'outil refuse et il faut l'inviter à se connecter à son espace client.",
      parameters: {
        type: "object",
        properties: {
          numero_mission: { type: "string", description: "Numéro de mission, ex. MIS-TLG-2026-#101" },
        },
        required: ["numero_mission"],
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
      name: "chercher_missions_catalogue",
      description:
        "Recherche les missions de convoyage réellement disponibles au catalogue convoyeur (missions publiées, non encore attribuées). Utilise-le quand un convoyeur ou un candidat demande s'il y a des missions disponibles, éventuellement près d'une ville.",
      parameters: {
        type: "object",
        properties: {
          ville: {
            type: "string",
            description: "Ville de départ ou d'arrivée recherchée, ex. Tours. Facultatif.",
          },
        },
        required: [],
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

export type VroomyAuthUser = { id: string; email: string | null };

async function chercherMission(
  admin: SupabaseClient,
  args: { numero_mission?: unknown },
  authUser: VroomyAuthUser | null,
): Promise<ToolResult> {
  const numero = typeof args.numero_mission === "string" ? normalizeNumero(args.numero_mission) : "";

  if (!authUser) {
    return {
      payload: {
        ok: false,
        raison:
          "Accès refusé : le suivi d'une mission est réservé aux clients connectés. Inviter le visiteur à se connecter à son espace client (bouton Connexion), puis à consulter ses missions. Ne demander NI numéro de mission NI email, et ne divulguer aucune information.",
        action: "login_required",
      },
      card: { type: "login", data: { url: "/connexion" } },
      success: true,
    };
  }

  if (!numero) {
    return {
      payload: { ok: false, raison: "Demander le numéro de la mission à suivre." },
      card: null,
      success: false,
      error: "missing_args",
    };
  }

  const email = (authUser.email ?? "").trim().toLowerCase();


  const { data: rows, error } = await admin
    .from("missions")
    .select(
      "id, numero, statut, ville_depart, ville_arrivee, date_prise_en_charge, type_trajet, marque, modele, email, user_id, group_reference",
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

  // Contrôle d'accès : la mission doit appartenir à l'utilisateur connecté.
  const owns =
    (mission.user_id && mission.user_id === authUser.id) ||
    (!!email && (mission.email ?? "").trim().toLowerCase() === email);
  if (!owns) {
    return {
      payload: {
        ok: false,
        raison:
          "Cette mission n'appartient pas au compte connecté. Ne divulguer AUCUNE information : inviter à vérifier le numéro depuis son espace client ou à appeler le 07 82 45 61 81.",
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

async function chercherMissionsCatalogue(
  admin: SupabaseClient,
  args: { ville?: unknown },
): Promise<ToolResult> {
  const ville = typeof args.ville === "string" ? args.ville.trim() : "";

  let query = admin
    .from("trajets_publies_safe")
    .select("id,depart,arrivee,date_trajet,marque,modele,prix_convoyeur_fixe,prix_suggere,leg_type,published_at")
    .in("attribution_mode", ["catalogue", "mixte"])
    .order("published_at", { ascending: false })
    .limit(ville ? 40 : 6);

  if (ville) {
    const safe = ville.replace(/[%,()]/g, "");
    query = query.or(`depart.ilike.%${safe}%,arrivee.ilike.%${safe}%`);
  }

  const { data, error } = await query;
  if (error) {
    return { payload: { ok: false, raison: "Erreur technique" }, card: null, success: false, error: error.message };
  }

  const missions = (data ?? []).slice(0, 6).map((t) => {
    const row = t as Record<string, unknown>;
    return {
      depart: row.depart ?? null,
      arrivee: row.arrivee ?? null,
      date: row.date_trajet ?? null,
      vehicule: [row.marque, row.modele].filter(Boolean).join(" ") || null,
      remuneration:
        (row.prix_convoyeur_fixe as number | null) ?? (row.prix_suggere as number | null) ?? null,
      type: row.leg_type ?? null,
    };
  });

  if (missions.length === 0) {
    return {
      payload: {
        ok: true,
        total: 0,
        raison: ville
          ? `Aucune mission publiée actuellement autour de ${ville}. Inviter à consulter le catalogue régulièrement ou à activer les alertes.`
          : "Aucune mission publiée au catalogue pour le moment.",
      },
      card: null,
      success: true,
    };
  }

  return {
    payload: { ok: true, total: missions.length, ville: ville || null, missions },
    card: { type: "catalogue", data: { ville: ville || null, missions } },
    success: true,
  };
}

export async function runVroomyTool(
  admin: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
  authUser: VroomyAuthUser | null = null,
): Promise<ToolResult> {
  switch (name) {
    case "chercher_mission":
      return chercherMission(admin, args, authUser);
    case "estimer_devis":
      return estimerDevis(args);
    case "chercher_missions_catalogue":
      return chercherMissionsCatalogue(admin, args);
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
