import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const baseSchema = z.object({
  method: z.enum(["invitation", "direct"]),
  email: z.string().trim().email().max(255),
  prenom: z.string().trim().min(1).max(100),
  nom: z.string().trim().min(1).max(100),
  telephone: z.string().trim().max(40).optional().default(""),
  siteId: z.string().uuid().nullable().optional(),
  permisNumero: z.string().trim().max(60).optional().default(""),
  permisDateObtention: z.string().trim().max(20).optional().default(""),
  /** Copie du permis (dataURL base64) — ajout direct uniquement. */
  permisFile: z.string().max(9_000_000).optional(),
  permisFileName: z.string().max(200).optional(),
});

/**
 * Crée un conducteur rattaché à la flotte du membre connecté.
 * - method = "invitation" : ligne "invitee", le conducteur complète lui-même
 *   son profil via le flux d'inscription convoyeur existant (token).
 * - method = "direct" : ligne "a_valider" (jamais activée sans validation Ligneo).
 */
export const createFleetDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => baseSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: mem } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    if (!mem) throw new Error("Aucune organisation associée à votre compte.");
    const organizationId = mem.organization_id as string;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Doublons : conducteur déjà rattaché ou invitation en cours
    const email = data.email.toLowerCase();
    const { data: existing } = await supabaseAdmin
      .from("convoyeurs")
      .select("id")
      .eq("organization_id", organizationId)
      .ilike("email", email)
      .maybeSingle();
    if (existing) throw new Error("Ce conducteur est déjà rattaché à votre flotte.");

    const { data: pending } = await supabaseAdmin
      .from("fleet_driver_invitations")
      .select("id")
      .eq("organization_id", organizationId)
      .ilike("email", email)
      .in("status", ["invitee", "a_valider"])
      .maybeSingle();
    if (pending) throw new Error("Une demande est déjà en cours pour cette adresse email.");

    // Upload de la copie du permis (ajout direct)
    let permisDocUrl: string | null = null;
    if (data.permisFile) {
      const match = /^data:([^;]+);base64,(.*)$/.exec(data.permisFile);
      if (match) {
        const contentType = match[1];
        const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
        const ext = (data.permisFileName?.split(".").pop() || "pdf").toLowerCase().slice(0, 5);
        const path = `fleet-invitations/${organizationId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabaseAdmin.storage
          .from("convoyeur-documents")
          .upload(path, bytes, { contentType, upsert: false });
        if (upErr) throw new Error(`Upload du permis impossible : ${upErr.message}`);
        permisDocUrl = path;
      }
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("fleet_driver_invitations")
      .insert({
        organization_id: organizationId,
        site_id: data.siteId ?? null,
        email,
        prenom: data.prenom,
        nom: data.nom,
        telephone: data.telephone || null,
        permis_numero: data.permisNumero || null,
        permis_date_obtention: data.permisDateObtention || null,
        permis_doc_url: permisDocUrl,
        method: data.method,
        status: data.method === "invitation" ? "invitee" : "a_valider",
        created_by: userId,
      })
      .select("id, token, status")
      .single();
    if (error) throw new Error(error.message);

    let orgName: string | null = null;
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("nom")
      .eq("id", organizationId)
      .maybeSingle();
    orgName = (org as { nom?: string } | null)?.nom ?? null;

    return {
      id: inserted.id as string,
      token: inserted.token as string,
      status: inserted.status as string,
      organizationName: orgName,
    };
  });

/** Lecture publique d'une invitation (pré-remplissage du formulaire d'inscription convoyeur). */
export const getFleetInvitation = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ token: z.string().trim().min(10).max(120) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv } = await supabaseAdmin
      .from("fleet_driver_invitations")
      .select("id, email, prenom, nom, telephone, status, organization_id")
      .eq("token", data.token)
      .maybeSingle();
    if (!inv || inv.status !== "invitee") return null;
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("nom")
      .eq("id", inv.organization_id)
      .maybeSingle();
    return {
      email: inv.email as string,
      prenom: inv.prenom as string,
      nom: inv.nom as string,
      telephone: (inv.telephone as string | null) ?? "",
      organizationName: (org as { nom?: string } | null)?.nom ?? null,
    };
  });

/**
 * Rattache le convoyeur nouvellement inscrit à l'organisation de l'invitation.
 * Le token et la correspondance d'email font foi.
 */
export const acceptFleetInvitation = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({
      token: z.string().trim().min(10).max(120),
      email: z.string().trim().email().max(255),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();
    const { data: inv } = await supabaseAdmin
      .from("fleet_driver_invitations")
      .select("id, email, organization_id, site_id, status")
      .eq("token", data.token)
      .maybeSingle();
    if (!inv || inv.status !== "invitee") return { ok: false };
    if ((inv.email as string).toLowerCase() !== email) return { ok: false };

    await supabaseAdmin
      .from("convoyeurs")
      .update({ organization_id: inv.organization_id, site_id: inv.site_id })
      .ilike("email", email);

    await supabaseAdmin
      .from("fleet_driver_invitations")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", inv.id);

    return { ok: true };
  });
