import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const ALLOWED_ORIGIN_RE = /^https:\/\/([a-z0-9-]+\.)*(transportsligneo\.fr|lovable\.app)$/i;
const ALLOWED_EXACT = new Set(["capacitor://localhost", "https://localhost", "http://localhost"]);
function originAllowed(origin: string | null): boolean {
  if (!origin) return true;
  return ALLOWED_EXACT.has(origin) || ALLOWED_ORIGIN_RE.test(origin);
}

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "https://www.transportsligneo.fr",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

interface CreateAccountPayload {
  email: string;
  password: string;
  prenom: string;
  nom: string;
  telephone?: string;
  role: "admin" | "super_admin" | "convoyeur" | "client" | "manager" | "sous_traitant";
  type_client?: "particulier" | "b2b" | "flotte";
  societe?: string;
  siret?: string;
  organization_id?: string;
  member_role?: "owner" | "admin" | "member";
}

Deno.serve(async (req) => {
  const reqOrigin = req.headers.get("Origin");
  if (!originAllowed(reqOrigin)) {
    return new Response(JSON.stringify({ error: "Origine non autorisée" }), { status: 403, headers: { "Content-Type": "application/json" } });
  }
  if (reqOrigin) corsHeaders["Access-Control-Allow-Origin"] = reqOrigin;
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth" }, 401);

    // Vérifier l'identité du caller via anon + jeton user
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

    // Vérifier le rôle admin/super_admin du caller (service role)
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("actif", true);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin" || r.role === "super_admin");
    if (!isAdmin) return json({ error: "Forbidden — admin only" }, 403);

    const body = (await req.json()) as CreateAccountPayload;
    if (!body.email || !body.password || !body.role) return json({ error: "Missing fields" }, 400);

    // Crée le compte (auto-confirmé car action admin)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        prenom: body.prenom ?? "",
        nom: body.nom ?? "",
        telephone: body.telephone ?? "",
        societe: body.societe ?? "",
        siret: body.siret ?? "",
        // handle_new_user n'autorise que client/convoyeur — sinon role mis à 'client' par défaut
        role: body.role === "convoyeur" ? "convoyeur" : "client",
      },
    });
    if (createErr || !created.user) return json({ error: createErr?.message ?? "Create failed" }, 400);

    const newUserId = created.user.id;

    // Forcer le rôle final demandé pour tous les types de compte.
    await admin.from("user_roles").update({ actif: false }).eq("user_id", newUserId);
    await admin
      .from("user_roles")
      .upsert(
        { user_id: newUserId, role: body.role, actif: true },
        { onConflict: "user_id,role" },
      );

    if (body.role === "convoyeur") {
      await admin.from("convoyeurs").upsert(
        {
          user_id: newUserId,
          email: body.email.toLowerCase().trim(),
          prenom: body.prenom ?? "",
          nom: body.nom ?? "",
          telephone: body.telephone ?? "",
          statut: "valide",
          account_status: "active",
        },
        { onConflict: "user_id" },
      );
    }


    // Mettre à jour le profil : type de compte (particulier / b2b / flotte) + identité
    {
      const profilePatch: Record<string, unknown> = {};
      if (body.type_client) profilePatch.type_client = body.type_client;
      if (body.societe) profilePatch.societe = body.societe;
      if (body.siret) profilePatch.siret = body.siret;
      if (body.telephone) profilePatch.telephone = body.telephone;
      if (body.prenom) profilePatch.prenom = body.prenom;
      if (body.nom) profilePatch.nom = body.nom;
      if (Object.keys(profilePatch).length > 0) {
        await admin.from("profiles").update(profilePatch).eq("user_id", newUserId);
      }
    }

    // Rattacher à une organisation si fourni
    if (body.organization_id) {
      await admin.from("organization_members").insert({
        organization_id: body.organization_id,
        user_id: newUserId,
        member_role: body.member_role ?? "member",
        status: "active",
        invited_by: userData.user.id,
      });
    }

    // Audit log
    await admin.from("activity_logs").insert({
      actor_user_id: userData.user.id,
      action: "admin.create_user",
      entity_type: "user",
      entity_id: newUserId,
      organization_id: body.organization_id ?? null,
      metadata: { role: body.role, email: body.email },
    });

    return json({ ok: true, user_id: newUserId });
  } catch (err) {
    console.error("[admin-create-account] error", err);
    return json({ error: "Internal server error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
