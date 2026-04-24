import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function assertAdmin(context: { supabase: typeof supabaseAdmin; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .eq("actif", true)
    .maybeSingle();

  if (!data) throw new Response("Forbidden", { status: 403 });
}

// Notification: new demande received → notify admin
export const notifyNewDemande = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { demandeId: string }) => {
    if (!UUID_RE.test(input.demandeId)) throw new Error("Invalid demande id");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

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
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { attributionId: string }) => {
    if (!UUID_RE.test(input.attributionId)) throw new Error("Invalid attribution id");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

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
