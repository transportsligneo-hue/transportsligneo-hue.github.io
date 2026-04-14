import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Notification: new demande received → notify admin
export const notifyNewDemande = createServerFn({ method: "POST" })
  .inputValidator((input: { demandeId: string }) => input)
  .handler(async ({ data }) => {
    const { data: demande } = await supabaseAdmin
      .from("demandes_convoyage")
      .select("*")
      .eq("id", data.demandeId)
      .single();

    if (!demande) return { success: false };

    // Get admin emails
    const { data: adminRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (!adminRoles?.length) return { success: false };

    const adminEmails: string[] = [];
    for (const role of adminRoles) {
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(role.user_id);
      if (userData?.user?.email) adminEmails.push(userData.user.email);
    }

    // Log notification (email sending will work when email domain is configured)
    console.log("[Notification] Nouvelle demande reçue:", {
      id: demande.id,
      client: `${demande.prenom} ${demande.nom}`,
      trajet: `${demande.depart} → ${demande.arrivee}`,
      admins: adminEmails,
    });

    return { success: true, notified: adminEmails.length };
  });

// Notification: trajet attributed to convoyeur
export const notifyAttribution = createServerFn({ method: "POST" })
  .inputValidator((input: { attributionId: string }) => input)
  .handler(async ({ data }) => {
    const { data: attribution } = await supabaseAdmin
      .from("attributions")
      .select("*, convoyeur_id, trajet_id")
      .eq("id", data.attributionId)
      .single();

    if (!attribution) return { success: false };

    const { data: convoyeur } = await supabaseAdmin
      .from("convoyeurs")
      .select("email, prenom, nom")
      .eq("id", attribution.convoyeur_id)
      .single();

    const { data: trajet } = await supabaseAdmin
      .from("trajets")
      .select("depart, arrivee, date_trajet")
      .eq("id", attribution.trajet_id)
      .single();

    console.log("[Notification] Attribution créée:", {
      convoyeur: convoyeur ? `${convoyeur.prenom} ${convoyeur.nom} (${convoyeur.email})` : "inconnu",
      trajet: trajet ? `${trajet.depart} → ${trajet.arrivee}` : "inconnu",
    });

    return { success: true };
  });
