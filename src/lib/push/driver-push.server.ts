/**
 * Couche centrale d'envoi des notifications push aux convoyeurs.
 *
 * Server-only. Un seul point d'entrée : `sendConvoyeurPush()`.
 * - résout le compte utilisateur du convoyeur (convoyeur_id → user_id)
 * - construit le titre / corps / lien à partir d'un évènement métier
 * - envoie via FCM (app Ligneo Driver) + Web Push
 * - trace la notification dans `user_notifications`
 * - n'échoue JAMAIS : toute erreur est journalisée et renvoyée dans le résultat
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendPushToUser } from "@/lib/push/send.server";

export type DriverEvent =
  | "mission_proposee"
  | "mission_attribuee"
  | "mission_validee"
  | "mission_annulee"
  | "mission_modifiee"
  | "paiement_effectue"
  | "document_valide"
  | "document_refuse"
  | "compte_valide"
  | "message"
  | "test";

export type DriverPushInput = {
  convoyeurId?: string | null;
  userId?: string | null;
  event: DriverEvent;
  attributionId?: string | null;
  trajetId?: string | null;
  /** Surcharges facultatives du gabarit. */
  title?: string | null;
  body?: string | null;
  url?: string | null;
  imageUrl?: string | null;
  /** Détail libre (motif de refus, montant, type de document…). */
  detail?: string | null;
};

type Built = { title: string; body: string; url: string; tag: string; image?: string };

function fmtDate(d?: string | null, h?: string | null) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return d;
  return `${day}/${m}${h ? ` à ${String(h).slice(0, 5)}` : ""}`;
}

async function loadMissionContext(input: DriverPushInput) {
  let attributionId = input.attributionId ?? null;
  let trajet: Record<string, any> | null = null;
  let numero: string | null = null;

  if (attributionId) {
    const { data } = await supabaseAdmin
      .from("attributions")
      .select("id, numero_mission, trajet:trajets(id, depart, arrivee, date_trajet, heure_trajet, marque, modele, immatriculation)")
      .eq("id", attributionId)
      .maybeSingle();
    trajet = (data as any)?.trajet ?? null;
    numero = (data as any)?.numero_mission ?? null;
  } else if (input.trajetId) {
    const { data } = await supabaseAdmin
      .from("trajets")
      .select("id, depart, arrivee, date_trajet, heure_trajet, marque, modele, immatriculation")
      .eq("id", input.trajetId)
      .maybeSingle();
    trajet = (data as any) ?? null;
    const { data: attr } = await supabaseAdmin
      .from("attributions")
      .select("id, numero_mission")
      .eq("trajet_id", input.trajetId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    attributionId = (attr as any)?.id ?? null;
    numero = (attr as any)?.numero_mission ?? null;
  }

  const trajetLabel = trajet ? `${trajet.depart ?? ""} → ${trajet.arrivee ?? ""}`.trim() : "";
  const when = trajet ? fmtDate(trajet.date_trajet, trajet.heure_trajet) : "";
  const vehicule = trajet
    ? [trajet.marque, trajet.modele, trajet.immatriculation].filter(Boolean).join(" ")
    : "";

  return { attributionId, trajet, numero, trajetLabel, when, vehicule };
}

async function buildPayload(input: DriverPushInput): Promise<Built> {
  const ctx = await loadMissionContext(input);
  const missionUrl = ctx.attributionId
    ? `/convoyeur/missions?open=${ctx.attributionId}`
    : "/convoyeur/missions";
  const detail = input.detail?.trim() || "";
  const line = [ctx.trajetLabel, ctx.when ? `départ le ${ctx.when}` : ""].filter(Boolean).join(", ");

  let built: Built;
  switch (input.event) {
    case "mission_proposee":
      built = {
        title: "Nouvelle mission disponible",
        body: line || "Une mission vous est proposée.",
        url: missionUrl,
        tag: `mission-proposee-${ctx.attributionId ?? ctx.trajet?.id ?? "x"}`,
      };
      break;
    case "mission_attribuee":
      built = {
        title: "Nouvelle mission attribuée",
        body: line || "Une mission vous a été attribuée.",
        url: missionUrl,
        tag: `mission-attribuee-${ctx.attributionId ?? ctx.trajet?.id ?? "x"}`,
      };
      break;
    case "mission_validee":
      built = {
        title: "Mission confirmée ✓",
        body: line ? `Votre mission est validée : ${line}` : "Votre mission a été validée par l'administration.",
        url: missionUrl,
        tag: `mission-validee-${ctx.attributionId ?? "x"}`,
      };
      break;
    case "mission_annulee":
      built = {
        title: "Mission annulée",
        body: [line, detail].filter(Boolean).join(" — ") || "Une de vos missions a été annulée.",
        url: missionUrl,
        tag: `mission-annulee-${ctx.attributionId ?? "x"}`,
      };
      break;
    case "mission_modifiee":
      built = {
        title: "Mission modifiée",
        body: [line, detail].filter(Boolean).join(" — ") || "Les informations d'une mission ont changé.",
        url: missionUrl,
        tag: `mission-modifiee-${ctx.attributionId ?? ctx.trajet?.id ?? "x"}`,
      };
      break;
    case "paiement_effectue":
      built = {
        title: "Paiement effectué 💶",
        body: detail || "Votre virement a été exécuté.",
        url: "/convoyeur/finances",
        tag: `paiement-${Date.now()}`,
      };
      break;
    case "document_valide":
      built = {
        title: "Document validé ✓",
        body: detail ? `${detail} a été validé.` : "Votre document a été validé.",
        url: "/convoyeur/documents",
        tag: `doc-ok-${Date.now()}`,
      };
      break;
    case "document_refuse":
      built = {
        title: "Document refusé",
        body: detail || "Un document doit être renvoyé.",
        url: "/convoyeur/documents",
        tag: `doc-ko-${Date.now()}`,
      };
      break;
    case "compte_valide":
      built = {
        title: "Compte convoyeur validé 🎉",
        body: detail || "Votre inscription est validée : vous pouvez accéder aux missions.",
        url: "/convoyeur",
        tag: "compte-valide",
      };
      break;
    case "test":
      built = {
        title: "Notification de test",
        body: detail || line || "Ceci est un test d'affichage.",
        url: missionUrl,
        tag: `test-${Date.now()}`,
      };
      break;
    default:
      built = {
        title: "Transports Ligneo",
        body: detail || "Vous avez une nouvelle information.",
        url: "/convoyeur",
        tag: `msg-${Date.now()}`,
      };
  }

  if (input.title) built.title = input.title.slice(0, 120);
  if (input.body) built.body = input.body.slice(0, 500);
  if (input.url && input.url.startsWith("/")) built.url = input.url;
  if (input.imageUrl && /^https:\/\//.test(input.imageUrl)) built.image = input.imageUrl;

  return built;
}

async function resolveUserId(input: DriverPushInput): Promise<string | null> {
  if (input.userId) return input.userId;
  if (!input.convoyeurId) return null;
  const { data } = await supabaseAdmin
    .from("convoyeurs")
    .select("user_id")
    .eq("id", input.convoyeurId)
    .maybeSingle();
  return ((data as any)?.user_id as string | undefined) ?? null;
}

/**
 * Point d'entrée unique : envoie la notification au convoyeur + trace l'historique.
 * Ne lève jamais d'exception (l'action métier appelante ne doit pas échouer).
 */
export async function sendConvoyeurPush(input: DriverPushInput) {
  try {
    const userId = await resolveUserId(input);
    if (!userId) return { ok: false, reason: "convoyeur sans compte", sent: 0 };

    const payload = await buildPayload(input);

    try {
      await supabaseAdmin.from("user_notifications").insert({
        user_id: userId,
        type: input.event,
        titre: payload.title,
        message: payload.body,
        link: payload.url,
      });
    } catch (e) {
      console.warn("[driver-push] historique non enregistré", e);
    }

    const res: any = await sendPushToUser(userId, payload);
    return {
      ok: true,
      userId,
      title: payload.title,
      body: payload.body,
      url: payload.url,
      sent: res?.sent ?? 0,
      native: res?.native ?? null,
      web: res?.web ?? null,
    };
  } catch (e) {
    console.warn("[driver-push] échec", e);
    return { ok: false, reason: e instanceof Error ? e.message : "erreur", sent: 0 };
  }
}
