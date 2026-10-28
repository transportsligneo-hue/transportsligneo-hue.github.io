/**
 * Actions admin sur les comptes (suspendre, rôle, e-mail, mot de passe…).
 * Passe par des fonctions de la base (SQL) : plus de dépendance à une fonction externe injoignable.
 * Garde la même forme de retour que supabase.functions.invoke : { data, error }.
 */
import { supabase } from "@/integrations/supabase/client";

type Payload = {
  action: string;
  user_id: string;
  role?: string;
  type_client?: string;
  email?: string;
  profile?: Record<string, unknown>;
  redirect_to?: string;
};
type Result = { data: any; error: { message: string } | null };

const fail = (m: string): Result => ({ data: { error: m }, error: { message: m } });

export async function invokeAdminUserAction(p: Payload): Promise<Result> {
  const db = supabase as any;
  try {
    switch (p.action) {
      case "suspend":
      case "reactivate":
      case "change_role":
      case "activate_role":
      case "change_type_client": {
        const { error } = await db.rpc("admin_user_action", {
          _action: p.action, _user: p.user_id, _role: p.role ?? null, _type: p.type_client ?? null,
        });
        return error ? fail(error.message) : { data: { ok: true }, error: null };
      }
      case "delete": {
        const { error } = await db.rpc("supprimer_compte_admin", { _user: p.user_id });
        return error ? fail(error.message) : { data: { ok: true }, error: null };
      }
      case "change_email": {
        const { error } = await db.rpc("admin_change_email", { _user: p.user_id, _email: p.email ?? "" });
        return error ? fail(error.message) : { data: { ok: true }, error: null };
      }
      case "update_profile": {
        const { error } = await db.rpc("admin_update_profile", { _user: p.user_id, _profile: p.profile ?? {} });
        return error ? fail(error.message) : { data: { ok: true }, error: null };
      }
      case "get_account_status": {
        const { data, error } = await db.rpc("admin_account_status", { _user: p.user_id });
        return error ? fail(error.message) : { data: data ?? {}, error: null };
      }
      case "reset_password":
      case "invite_account": {
        let email = p.email;
        if (!email) {
          const { data } = await db.rpc("admin_account_status", { _user: p.user_id });
          email = data?.email;
        }
        if (!email) return fail("Email introuvable");
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: p.redirect_to });
        if (error) return fail(error.message);
        return { data: { ok: true, ...(p.action === "invite_account" ? { fallback: "reset_password" } : {}) }, error: null };
      }
      default:
        return fail("Action inconnue");
    }
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Action échouée");
  }
}
