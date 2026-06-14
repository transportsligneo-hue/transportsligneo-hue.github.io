import { supabase } from "@/integrations/supabase/client";
import { sendTransactionalEmail } from "@/lib/email/send";
import { pushToUser, pushToAdmins } from "@/lib/push/notify.functions";

async function notifyMissionLifecycle(trajetId: string, statut: string) {
  try {
    const { data: t } = await supabase
      .from("trajets")
      .select("id, depart, arrivee, client_nom, client_email")
      .eq("id", trajetId)
      .maybeSingle();
    if (!t?.client_email) return;
    const prenom = (t.client_nom ?? "").split(" ")[0] ?? "";
    const { data: a } = await supabase
      .from("attributions")
      .select("numero_mission")
      .eq("trajet_id", trajetId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const numero = a?.numero_mission ?? "";
    const base = { prenom, numero, depart: t.depart, arrivee: t.arrivee };
    // Find user_id for client push
    const { data: prof } = await supabase
      .from("profiles")
      .select("user_id")
      .ilike("email", t.client_email)
      .maybeSingle();
    if (statut === "en_cours") {
      await Promise.allSettled([
        sendTransactionalEmail({
          templateName: "mission-demarree-client",
          recipientEmail: t.client_email,
          idempotencyKey: `mission-demarree-${trajetId}`,
          templateData: base,
        }),
        prof?.user_id
          ? pushToUser({ data: { userId: prof.user_id, payload: {
              title: "Véhicule en route",
              body: `${t.depart} → ${t.arrivee}`,
              url: "/client/missions",
              tag: `mission-${trajetId}-start`,
            } } })
          : Promise.resolve(),
      ]);
    } else if (statut === "validee" || statut === "termine") {
      await Promise.allSettled([
        sendTransactionalEmail({
          templateName: "mission-livree-client",
          recipientEmail: t.client_email,
          idempotencyKey: `mission-livree-${trajetId}`,
          templateData: base,
        }),
        prof?.user_id
          ? pushToUser({ data: { userId: prof.user_id, payload: {
              title: "Véhicule livré",
              body: `Mission ${numero} terminée`,
              url: "/client/missions",
              tag: `mission-${trajetId}-end`,
            } } })
          : Promise.resolve(),
      ]);
    }
  } catch (e) {
    console.warn("[mission-lifecycle email] échec", e);
  }
}


type AdminMissionStatusInput = {
  attributionId: string;
  trajetId: string;
  statut: string;
  note?: string;
  resetStep?: boolean;
};

type AdminMissionStepInput = {
  attributionId: string;
  etape: string;
  note?: string;
};

function getTrajetUpdates(statut: string): { statut: string; statut_publication: string } | null {
  if (["propose", "accepte"].includes(statut)) {
    return { statut: "attribue", statut_publication: "attribue" };
  }
  if (["en_cours", "en_attente_validation"].includes(statut)) {
    return { statut: "en_cours", statut_publication: "attribue" };
  }
  if (["validee", "termine"].includes(statut)) {
    return { statut: "termine", statut_publication: "attribue" };
  }
  if (statut === "refusee") {
    return { statut: "en_attente", statut_publication: "publie" };
  }
  if (statut === "annule") {
    return { statut: "annule", statut_publication: "brouillon" };
  }
  return null;
}

export async function updateAdminMissionStatus({
  attributionId,
  trajetId,
  statut,
  note,
  resetStep,
}: AdminMissionStatusInput) {
  const payload: Record<string, unknown> = { statut };

  if (resetStep || statut === "propose" || statut === "refusee" || statut === "annule") {
    payload.etape_courante = null;
  }

  const { error: attributionError } = await supabase
    .from("attributions")
    .update(payload as never)
    .eq("id", attributionId);

  if (attributionError) throw attributionError;

  const trajetUpdates = getTrajetUpdates(statut);
  if (trajetUpdates) {
    const { error: trajetError } = await supabase
      .from("trajets")
      .update(trajetUpdates as never)
      .eq("id", trajetId);

    if (trajetError) throw trajetError;
  }

  const { error: historyError } = await supabase.from("mission_etape_history").insert({
    attribution_id: attributionId,
    etape: `admin_statut_${statut}`,
    notes: note ?? "Statut modifié depuis le dashboard admin",
  } as never);

  if (historyError) throw historyError;

  // Notification client (best-effort) — démarrage / livraison
  void notifyMissionLifecycle(trajetId, statut);

  return payload;
}


export async function forceAdminMissionStep({ attributionId, etape, note }: AdminMissionStepInput) {
  const { error: stepError } = await supabase
    .from("attributions")
    .update({ etape_courante: etape } as never)
    .eq("id", attributionId);

  if (stepError) throw stepError;

  const { error: historyError } = await supabase.from("mission_etape_history").insert({
    attribution_id: attributionId,
    etape: `admin_force_${etape}`,
    notes: note ?? "Étape forcée par admin",
  } as never);

  if (historyError) throw historyError;
}