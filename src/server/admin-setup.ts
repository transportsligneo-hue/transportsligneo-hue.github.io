import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const seedAdminUser = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; password: string }) => input)
  .handler(async ({ data }) => {
    // Check if admin already exists
    const { data: existingRoles } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("role", "admin")
      .limit(1);

    if (existingRoles && existingRoles.length > 0) {
      return { success: false, message: "Un compte admin existe déjà." };
    }

    // Create user with role=admin in metadata so the trigger assigns the right role
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { role: "admin", prenom: "Admin", nom: "Ligneo" },
    });

    if (authError || !authData.user) {
      return { success: false, message: authError?.message ?? "Erreur lors de la création" };
    }

    // Le trigger handle_new_user a déjà créé profile + user_roles.
    // On force le rôle à 'admin' au cas où le trigger n'aurait pas pris la metadata.
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: authData.user.id, role: "admin", actif: true }, { onConflict: "user_id,role" });

    if (roleError) {
      return { success: false, message: roleError.message };
    }

    return { success: true, message: "Compte admin créé avec succès." };
  });
