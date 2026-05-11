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
  | "change_type_client"
  | "delete";

interface Payload {
  action: Action;
  user_id: string;
  role?: "admin" | "super_admin" | "manager" | "convoyeur" | "sous_traitant" | "client";
  type_client?: "particulier" | "b2b" | "flotte";
}

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

    // Empêche l'auto-action destructive
    if (body.user_id === userData.user.id && ["suspend", "delete"].includes(body.action)) {
      return json({ error: "Action interdite sur son propre compte" }, 400);
    }

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
        const { error } = await admin.auth.resetPasswordForEmail(u.user.email);
        if (error) return json({ error: error.message }, 400);
        break;
      }
      case "change_role": {
        if (!body.role) return json({ error: "Rôle manquant" }, 400);
        await admin.from("user_roles").update({ actif: false }).eq("user_id", body.user_id);
        await admin.from("user_roles").insert({ user_id: body.user_id, role: body.role, actif: true });
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
      default:
        return json({ error: "Action inconnue" }, 400);
    }

    await admin.from("activity_logs").insert({
      actor_user_id: userData.user.id,
      action: `admin.${body.action}`,
      entity_type: "user",
      entity_id: body.user_id,
      metadata: { role: body.role, type_client: body.type_client },
    });

    return json({ ok: true });
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
