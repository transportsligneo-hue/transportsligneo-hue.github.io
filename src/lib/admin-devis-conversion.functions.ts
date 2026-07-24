import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const convertDevisToMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ devisId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleError) throw roleError;
    if (!isAdmin) throw new Error("Accès admin requis");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: devis, error: devisError } = await supabaseAdmin
      .from("devis")
      .select("*")
      .eq("id", data.devisId)
      .maybeSingle();
    if (devisError) throw devisError;
    if (!devis) throw new Error("Devis introuvable");

    if (devis.mission_id) {
      const { data: existing } = await supabaseAdmin
        .from("missions")
        .select("id, numero")
        .eq("id", devis.mission_id)
        .maybeSingle();
      if (existing) return { missionId: existing.id, numero: existing.numero, alreadyConverted: true };
    }

    const { data: alreadyLinked } = await supabaseAdmin
      .from("missions")
      .select("id, numero")
      .eq("devis_id", devis.id)
      .maybeSingle();
    if (alreadyLinked) {
      await supabaseAdmin
        .from("devis")
        .update({
          statut: "convertit",
          mission_id: alreadyLinked.id,
          converted_at: devis.converted_at ?? new Date().toISOString(),
          converted_by: devis.converted_by ?? userId,
        })
        .eq("id", devis.id);
      return { missionId: alreadyLinked.id, numero: alreadyLinked.numero, alreadyConverted: true };
    }

    let profile: { user_id: string | null; organization_id: string | null; type_client: string | null } | null = null;
    if (devis.user_id) {
      const { data: profileByUser } = await supabaseAdmin
        .from("profiles")
        .select("user_id, organization_id, type_client")
        .eq("user_id", devis.user_id)
        .maybeSingle();
      profile = profileByUser;
    }
    if (!profile && devis.email) {
      const { data: profileByEmail } = await supabaseAdmin
        .from("profiles")
        .select("user_id, organization_id, type_client")
        .eq("email", devis.email)
        .maybeSingle();
      profile = profileByEmail;
    }

    const missionUserId = devis.user_id ?? profile?.user_id ?? userId;
    const missionOrgId = profile?.organization_id ?? null;

    const { data: mission, error: missionError } = await supabaseAdmin
      .from("missions")
      .insert({
        devis_id: devis.id,
        user_id: missionUserId,
        organization_id: missionOrgId,
        fleet_organization_id: profile?.type_client === "flotte" ? missionOrgId : null,
        nom: devis.nom,
        prenom: devis.prenom,
        email: devis.email,
        telephone: devis.telephone,
        ville_depart: devis.depart,
        ville_arrivee: devis.arrivee,
        date_prise_en_charge: devis.date_souhaitee ?? new Date().toISOString().slice(0, 10),
        type_trajet: devis.option_trajet === "aller_retour" ? "aller_retour" : "aller_simple",
        marque: devis.marque,
        modele: devis.modele,
        carburant: devis.carburant,
        remarques: devis.message,
        prix_total: devis.prix_estime ?? 0,
        statut: "en_attente",
      })
      .select("id, numero")
      .maybeSingle();
    if (missionError) throw missionError;
    if (!mission) throw new Error("Mission non créée");

    const { error: updateError } = await supabaseAdmin
      .from("devis")
      .update({
        statut: "convertit",
        mission_id: mission.id,
        converted_at: new Date().toISOString(),
        converted_by: userId,
      })
      .eq("id", devis.id);
    if (updateError) throw updateError;

    return { missionId: mission.id, numero: mission.numero, alreadyConverted: false };
  });