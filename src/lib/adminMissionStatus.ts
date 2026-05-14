import { supabase } from "@/integrations/supabase/client";

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