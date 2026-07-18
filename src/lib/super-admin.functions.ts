import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Vérifie que l'appelant est Super Admin (throw 403 sinon). */
export const verifySuperAdminAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isSuper } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!isSuper) throw new Response("Forbidden", { status: 403 });
    return { ok: true as const };
  });

const RoleSchema = z.enum(["super_admin", "admin", "manager", "convoyeur", "sous_traitant", "client"]);

/** Liste tous les utilisateurs ayant au moins un rôle privilégié (admin, super_admin, manager). */
export const listPrivilegedUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isSuper } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!isSuper) throw new Response("Forbidden", { status: 403 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role, actif, created_at")
      .in("role", ["super_admin", "admin", "manager"])
      .order("created_at", { ascending: false });
    if (error) throw error;

    const userIds = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
    const profileMap = new Map<string, { email: string | null; nom: string | null; prenom: string | null }>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("user_id, email, nom, prenom")
        .in("user_id", userIds);
      for (const p of profiles ?? []) {
        profileMap.set(p.user_id as string, {
          email: (p as { email?: string | null }).email ?? null,
          nom: (p as { nom?: string | null }).nom ?? null,
          prenom: (p as { prenom?: string | null }).prenom ?? null,
        });
      }
    }

    // Regrouper par user
    const grouped = new Map<string, { user_id: string; email: string | null; nom: string | null; prenom: string | null; roles: { role: string; actif: boolean }[] }>();
    for (const r of roles ?? []) {
      const key = r.user_id as string;
      const prof = profileMap.get(key) ?? { email: null, nom: null, prenom: null };
      if (!grouped.has(key)) grouped.set(key, { user_id: key, ...prof, roles: [] });
      grouped.get(key)!.roles.push({ role: r.role as string, actif: r.actif !== false });
    }
    return Array.from(grouped.values());
  });

/** Accorde ou retire un rôle sensible (admin / super_admin / manager). */
export const superAdminSetRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ target_user_id: z.string().uuid(), role: RoleSchema, actif: z.boolean() }).parse(raw),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.rpc("super_admin_set_role", {
      _target_user_id: data.target_user_id,
      _role: data.role,
      _actif: data.actif,
    });
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true as const };
  });

/** Renvoie les 100 derniers événements du journal d'audit sécurité. */
export const listSecurityAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("admin_security_audit")
      .select("id, actor_user_id, action, target_user_id, details, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Response(error.message, { status: 403 });
    return data ?? [];
  });

/** Recherche un utilisateur par email pour l'inviter dans le panel Super Admin. */
export const findUserByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ email: z.string().email() }).parse(raw))
  .handler(async ({ context, data }) => {
    const { data: isSuper } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!isSuper) throw new Response("Forbidden", { status: 403 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("user_id, email, nom, prenom")
      .ilike("email", data.email)
      .maybeSingle();
    if (!profile) return null;
    return {
      user_id: profile.user_id as string,
      email: (profile as { email?: string | null }).email ?? null,
      nom: (profile as { nom?: string | null }).nom ?? null,
      prenom: (profile as { prenom?: string | null }).prenom ?? null,
    };
  });
