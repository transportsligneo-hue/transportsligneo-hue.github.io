import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Action =
  | "suspend"
  | "reactivate"
  | "reset_password"
  | "change_role"
  | "activate_role"
  | "change_type_client"
  | "delete"
  | "update_profile"
  | "change_email"
  | "invite_account"
  | "get_account_status";


interface Payload {
  action: Action;
  user_id: string;
  role?: "admin" | "super_admin" | "manager" | "convoyeur" | "sous_traitant" | "client";
  type_client?: "particulier" | "b2b" | "flotte";
  email?: string;
  profile?: Record<string, unknown>;
  redirect_to?: string;
}

const PROFILE_ALLOWED = new Set([
  "prenom", "nom", "telephone", "societe", "siret",
  "adresse", "adresse_facturation", "tva_intra", "type_client", "logo_url",
  "pricing_display_mode", "tva_exemption_note",
  "facture_mention_legale", "facture_mention_active",
  "relances_disabled", "exempte_acceptation_devis", "vin_obligatoire",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth" }, 401);

    const userClient = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("actif", true);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin" || r.role === "super_admin");
    if (!isAdmin) return json({ error: "Forbidden — admin only" }, 403);

    const body = (await req.json()) as Payload;
    if (!body.action || !body.user_id) return json({ error: "Missing fields" }, 400);

    if (body.user_id === userData.user.id && ["suspend", "delete"].includes(body.action)) {
      return json({ error: "Action interdite sur son propre compte" }, 400);
    }

    let result: Record<string, unknown> = {};

    switch (body.action) {
      case "suspend": {
        await admin.from("profiles").update({ account_status: "suspended" }).eq("user_id", body.user_id);
        await admin.from("convoyeurs").update({ account_status: "suspended" }).eq("user_id", body.user_id);
        await admin.auth.admin.updateUserById(body.user_id, { ban_duration: "876000h" });
        break;
      }
      case "reactivate": {
        await admin.from("profiles").update({ account_status: "active" }).eq("user_id", body.user_id);
        await admin.from("convoyeurs").update({ account_status: "active" }).eq("user_id", body.user_id);
        await admin.auth.admin.updateUserById(body.user_id, { ban_duration: "none" });
        break;
      }
      case "reset_password": {
        const { data: u } = await admin.auth.admin.getUserById(body.user_id);
        if (!u.user?.email) return json({ error: "Email introuvable" }, 400);
        const { error } = await admin.auth.resetPasswordForEmail(u.user.email, {
          redirectTo: body.redirect_to,
        });
        if (error) return json({ error: error.message }, 400);
        break;
      }
      case "change_role": {
        if (!body.role) return json({ error: "Rôle manquant" }, 400);
        // Désactive tous les rôles existants, puis upsert le nouveau actif=true.
        // L'upsert évite l'échec UNIQUE(user_id, role) qui laissait tous les rôles inactifs.
        await admin.from("user_roles").update({ actif: false }).eq("user_id", body.user_id);
        const { error: rErr } = await admin
          .from("user_roles")
          .upsert(
            { user_id: body.user_id, role: body.role, actif: true },
            { onConflict: "user_id,role" },
          );
        if (rErr) return json({ error: rErr.message }, 400);
        if (body.role === "convoyeur") {
          await ensureConvoyeurRecord(admin, body.user_id, "en_attente");
        }
        break;
      }
      case "activate_role": {
        // Active un seul rôle métier. Si aucun rôle n'est fourni, on infère d'abord
        // le rôle convoyeur depuis la fiche driver, afin d'éviter de réactiver manager/client par erreur.
        let targetRole = body.role;
        if (!targetRole) {
          const { data: conv } = await admin.from("convoyeurs").select("id").eq("user_id", body.user_id).maybeSingle();
          if (conv) targetRole = "convoyeur";
        }
        if (!targetRole) {
          const { data: active } = await admin
            .from("user_roles")
            .select("role")
            .eq("user_id", body.user_id)
            .eq("actif", true)
            .limit(1)
            .maybeSingle();
          targetRole = (active?.role as Payload["role"] | undefined) ?? "client";
        }

        await admin.from("user_roles").update({ actif: false }).eq("user_id", body.user_id);
        const { error: aErr } = await admin
          .from("user_roles")
          .upsert(
            { user_id: body.user_id, role: targetRole, actif: true },
            { onConflict: "user_id,role" },
          );
        if (aErr) return json({ error: aErr.message }, 400);
        // Lève aussi un éventuel ban auth + statut profil
        await admin.from("profiles").update({ account_status: "active", statut: "actif" }).eq("user_id", body.user_id);
        if (targetRole === "convoyeur") {
          await ensureConvoyeurRecord(admin, body.user_id, "valide");
        } else {
          await admin.from("convoyeurs").update({ account_status: "active" }).eq("user_id", body.user_id);
        }
        await admin.auth.admin.updateUserById(body.user_id, { ban_duration: "none" });
        break;
      }

      case "change_type_client": {
        if (!body.type_client) return json({ error: "Type manquant" }, 400);
        await admin.from("profiles").update({ type_client: body.type_client }).eq("user_id", body.user_id);
        break;
      }
      case "delete": {
        const { error } = await admin.auth.admin.deleteUser(body.user_id);
        if (error) return json({ error: error.message }, 400);
        break;
      }
      case "update_profile": {
        if (!body.profile || typeof body.profile !== "object") return json({ error: "Profil manquant" }, 400);
        const clean: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(body.profile)) {
          if (PROFILE_ALLOWED.has(k)) clean[k] = v === "" ? null : v;
        }
        if (Object.keys(clean).length === 0) return json({ error: "Aucun champ valide" }, 400);
        const { error } = await admin.from("profiles").update(clean).eq("user_id", body.user_id);
        if (error) return json({ error: error.message }, 400);
        break;
      }
      case "change_email": {
        if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
          return json({ error: "Email invalide" }, 400);
        }
        const newEmail = body.email.toLowerCase().trim();
        // Check duplicate
        const { data: dup } = await admin.from("profiles").select("user_id").ilike("email", newEmail).maybeSingle();
        if (dup && dup.user_id !== body.user_id) return json({ error: "Email déjà utilisé" }, 409);

        const { data: u } = await admin.auth.admin.getUserById(body.user_id);
        const oldEmail = u.user?.email ?? null;

        const { error: authErr } = await admin.auth.admin.updateUserById(body.user_id, {
          email: newEmail,
          email_confirm: true,
        });
        if (authErr) return json({ error: authErr.message }, 400);

        await admin.from("profiles").update({ email: newEmail }).eq("user_id", body.user_id);
        if (oldEmail) {
          await admin.from("devis").update({ email: newEmail }).ilike("email", oldEmail);
          await admin.from("demandes_convoyage").update({ email: newEmail }).ilike("email", oldEmail);
        }
        // Re-link any orphan records to user_id
        await admin.from("devis").update({ user_id: body.user_id }).is("user_id", null).ilike("email", newEmail);
        await admin.from("demandes_convoyage").update({ user_id: body.user_id }).is("user_id", null).ilike("email", newEmail);
        break;
      }
      case "invite_account": {
        const { data: u } = await admin.auth.admin.getUserById(body.user_id);
        const email = body.email || u.user?.email;
        if (!email) return json({ error: "Email introuvable" }, 400);
        const { error } = await admin.auth.admin.inviteUserByEmail(email, {
          redirectTo: body.redirect_to,
        });
        if (error) {
          // inviteUserByEmail peut refuser un compte déjà créé/confirmé.
          // Dans ce cas, on renvoie un lien de définition/réinitialisation du mot de passe,
          // ce qui correspond au besoin admin : redonner un accès au convoyeur.
          const { error: resetErr } = await admin.auth.resetPasswordForEmail(email, {
            redirectTo: body.redirect_to,
          });
          if (resetErr) return json({ error: resetErr.message }, 400);
          result = { fallback: "reset_password" };
        }
        break;
      }
      case "get_account_status": {
        const { data: u } = await admin.auth.admin.getUserById(body.user_id);
        result = {
          email: u.user?.email ?? null,
          email_confirmed_at: u.user?.email_confirmed_at ?? null,
          invited_at: u.user?.invited_at ?? null,
          last_sign_in_at: u.user?.last_sign_in_at ?? null,
          banned_until: (u.user as { banned_until?: string } | null)?.banned_until ?? null,
        };
        break;
      }
      default:
        return json({ error: "Action inconnue" }, 400);
    }

    if (body.action !== "get_account_status") {
      await admin.from("activity_logs").insert({
        actor_user_id: userData.user.id,
        action: `admin.${body.action}`,
        entity_type: "user",
        entity_id: body.user_id,
        metadata: {
          role: body.role,
          type_client: body.type_client,
          email: body.email,
          fields: body.profile ? Object.keys(body.profile) : undefined,
        },
      });
    }

    return json({ ok: true, ...result });
  } catch (err) {
    console.error("[admin-user-actions] error", err);
    return json({ error: "Internal server error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function ensureConvoyeurRecord(admin: ReturnType<typeof createClient>, userId: string, statut: "en_attente" | "valide") {
  const { data: existing } = await admin
    .from("convoyeurs")
    .select("id, statut")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    await admin
      .from("convoyeurs")
      .update({ statut, account_status: "active" })
      .eq("user_id", userId);
    return;
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("email, prenom, nom, telephone")
    .eq("user_id", userId)
    .maybeSingle();
  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  const meta = authUser.user?.user_metadata ?? {};
  const email = profile?.email ?? authUser.user?.email ?? "";

  if (!email) return;

  await admin.from("convoyeurs").insert({
    user_id: userId,
    email,
    prenom: profile?.prenom || meta.prenom || "",
    nom: profile?.nom || meta.nom || "",
    telephone: profile?.telephone || meta.telephone || "",
    statut,
    account_status: "active",
  });
}
