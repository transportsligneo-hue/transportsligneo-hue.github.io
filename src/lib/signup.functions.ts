import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const convoyeurSignupSchema = z.object({
  userId: z.string().uuid(),
  nom: z.string().trim().min(1).max(120),
  prenom: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(320),
  telephone: z.string().trim().min(1).max(50),
  ville: z.string().trim().max(120).optional(),
  disponibilite: z.string().trim().max(200).optional(),
  permis: z.string().trim().max(120).optional(),
  message: z.string().trim().max(2000).optional(),
  permis_numero: z.string().trim().min(1).max(120),
  annees_experience: z.number().int().min(0).max(80),
  permis_photo_url: z.string().trim().max(500).nullable().optional(),
});

export const completeConvoyeurSignup = createServerFn({ method: "POST" })
  .inputValidator((input) => convoyeurSignupSchema.parse(input))
  .handler(async ({ data }) => {
    const supabaseAdmin = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const email = data.email.toLowerCase().trim();
    await supabaseAdmin.from("profiles").update({
      email,
      nom: data.nom,
      prenom: data.prenom,
      telephone: data.telephone,
      type_client: "particulier",
      account_status: "active",
      statut: "actif",
    }).eq("user_id", data.userId);

    await supabaseAdmin.from("user_roles").update({ actif: false }).eq("user_id", data.userId);
    const { error: roleError } = await supabaseAdmin.from("user_roles").upsert(
      { user_id: data.userId, role: "convoyeur", actif: true },
      { onConflict: "user_id,role" },
    );
    if (roleError) throw new Error(roleError.message);

    const { data: row, error: convoyeurError } = await supabaseAdmin.from("convoyeurs").upsert(
      {
        user_id: data.userId,
        nom: data.nom,
        prenom: data.prenom,
        email,
        telephone: data.telephone,
        ville: data.ville ?? "",
        disponibilite: data.disponibilite ?? "",
        permis: data.permis ?? "",
        message: data.message ?? "",
        permis_numero: data.permis_numero,
        annees_experience: data.annees_experience,
        permis_photo_url: data.permis_photo_url ?? null,
        statut: "en_attente",
        account_status: "active",
      },
      { onConflict: "user_id" },
    ).select("id").single();

    if (convoyeurError) throw new Error(convoyeurError.message);
    return { convoyeurId: row.id };
  });