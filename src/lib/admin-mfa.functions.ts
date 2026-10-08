import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Double authentification admin par SMS.
 * Un admin doit saisir un code reçu sur son téléphone enregistré (admin_mfa_phones)
 * pour chaque nouvelle session de connexion. Le numéro ne peut pas être changé
 * depuis l'écran de connexion.
 */

const CODE_TTL_MIN = 10;
const SESSION_TTL_HOURS = 12;
const MAX_SENDS_PER_10MIN = 3;
const MAX_ATTEMPTS = 5;

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return `•• •• •• ${d.slice(-4, -2)} ${d.slice(-2)}`;
}

type Ctx = { supabase: any; userId: string; claims: any };

async function assertAdmin(ctx: Ctx) {
  const { data: roles } = await ctx.supabase
    .from("user_roles").select("role").eq("user_id", ctx.userId).eq("actif", true);
  const ok = (roles ?? []).some((r: { role: string }) => r.role === "admin" || r.role === "super_admin");
  if (!ok) throw new Error("Action réservée aux administrateurs");
  const sessionId = String(ctx.claims?.session_id ?? "");
  if (!sessionId) throw new Error("Session invalide, reconnectez-vous");
  return sessionId;
}

export const getAdminMfaStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sessionId = await assertAdmin(context as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s } = await supabaseAdmin.from("admin_mfa_sessions").select("expires_at")
      .eq("user_id", context.userId).eq("session_id", sessionId).maybeSingle();
    const { data: p } = await supabaseAdmin.from("admin_mfa_phones").select("phone")
      .eq("user_id", context.userId).maybeSingle();
    const verified = !!s && new Date(s.expires_at).getTime() > Date.now();
    return { verified, hasPhone: !!p?.phone, maskedPhone: p?.phone ? maskPhone(p.phone) : null };
  });

export const requestAdminMfaCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sessionId = await assertAdmin(context as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p } = await supabaseAdmin.from("admin_mfa_phones").select("phone")
      .eq("user_id", context.userId).maybeSingle();
    if (!p?.phone) throw new Error("Aucun numéro enregistré pour ce compte. Contactez le super admin.");

    const since = new Date(Date.now() - 10 * 60_000).toISOString();
    const { count } = await supabaseAdmin.from("admin_mfa_challenges")
      .select("id", { count: "exact", head: true }).eq("user_id", context.userId).gte("created_at", since);
    if ((count ?? 0) >= MAX_SENDS_PER_10MIN) throw new Error("Trop de codes envoyés. Réessayez dans 10 minutes.");

    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const code = String(buf[0] % 1_000_000).padStart(6, "0");
    const { error } = await supabaseAdmin.from("admin_mfa_challenges").insert({
      user_id: context.userId,
      session_id: sessionId,
      code_hash: await sha256Hex(`${context.userId}:${code}`),
      expires_at: new Date(Date.now() + CODE_TTL_MIN * 60_000).toISOString(),
    });
    if (error) throw new Error("Création du code impossible");

    const { sendSms } = await import("@/lib/sms.server");
    const res = await sendSms({
      to: p.phone,
      body: `Transports Ligneo : votre code d'accès à l'administration est ${code}. Valable ${CODE_TTL_MIN} min. Ne le communiquez à personne.`,
    });
    if (!res.ok) {
      console.error("[admin-mfa] sms failed", res.error);
      throw new Error("Envoi du SMS impossible. Réessayez dans un instant.");
    }
    return { sent: true, maskedPhone: maskPhone(p.phone) };
  });

export const verifyAdminMfaCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => {
    const code = String(input?.code ?? "").replace(/\D/g, "");
    if (code.length !== 6) throw new Error("Le code contient 6 chiffres");
    return { code };
  })
  .handler(async ({ data, context }) => {
    const sessionId = await assertAdmin(context as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ch } = await supabaseAdmin.from("admin_mfa_challenges")
      .select("id, code_hash, attempts, expires_at")
      .eq("user_id", context.userId).eq("session_id", sessionId).is("consumed_at", null)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!ch || new Date(ch.expires_at).getTime() < Date.now()) throw new Error("Code expiré. Demandez un nouveau code.");
    if (ch.attempts >= MAX_ATTEMPTS) throw new Error("Trop d'essais. Demandez un nouveau code.");

    const ok = (await sha256Hex(`${context.userId}:${data.code}`)) === ch.code_hash;
    if (!ok) {
      await supabaseAdmin.from("admin_mfa_challenges").update({ attempts: ch.attempts + 1 }).eq("id", ch.id);
      throw new Error("Code incorrect");
    }
    await supabaseAdmin.from("admin_mfa_challenges").update({ consumed_at: new Date().toISOString() }).eq("id", ch.id);
    await supabaseAdmin.from("admin_mfa_sessions").upsert({
      user_id: context.userId,
      session_id: sessionId,
      verified_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + SESSION_TTL_HOURS * 3600_000).toISOString(),
    });
    return { verified: true };
  });
