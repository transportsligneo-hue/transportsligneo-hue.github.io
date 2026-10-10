import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Double authentification SMS optionnelle pour clients, pros, flottes et convoyeurs.
 * Activée par l'utilisateur dans ses paramètres après vérification du numéro.
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

function cleanPhone(raw: string): string {
  const p = String(raw ?? "").replace(/[^\d+]/g, "");
  const digits = p.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) throw new Error("Numéro de téléphone invalide");
  return p;
}

type Ctx = { supabase: any; userId: string; claims: any };

function sessionOf(ctx: Ctx) {
  const sessionId = String(ctx.claims?.session_id ?? "");
  if (!sessionId) throw new Error("Session invalide, reconnectez-vous");
  return sessionId;
}

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
}

async function sendCode(ctx: Ctx, phone: string, purpose: "login" | "enroll") {
  const sessionId = sessionOf(ctx);
  const db = await admin();
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const { count } = await db.from("user_mfa_challenges")
    .select("id", { count: "exact", head: true }).eq("user_id", ctx.userId).gte("created_at", since);
  if ((count ?? 0) >= MAX_SENDS_PER_10MIN) throw new Error("Trop de codes envoyés. Réessayez dans 10 minutes.");

  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const code = String(buf[0] % 1_000_000).padStart(6, "0");
  const { error } = await db.from("user_mfa_challenges").insert({
    user_id: ctx.userId, session_id: sessionId, purpose, phone,
    code_hash: await sha256Hex(`${ctx.userId}:${code}`),
    expires_at: new Date(Date.now() + CODE_TTL_MIN * 60_000).toISOString(),
  });
  if (error) throw new Error("Création du code impossible");

  const { sendSms } = await import("@/lib/sms.server");
  const res = await sendSms({
    to: phone,
    body: `Transports Ligneo : votre code de sécurité est ${code}. Valable ${CODE_TTL_MIN} min. Ne le communiquez à personne.`,
  });
  if (!res.ok) {
    console.error("[user-mfa] sms failed", res.error);
    throw new Error("Envoi du SMS impossible. Réessayez dans un instant.");
  }
  return { sent: true, maskedPhone: maskPhone(phone) };
}

async function checkCode(ctx: Ctx, code: string, purpose: "login" | "enroll") {
  const sessionId = sessionOf(ctx);
  const db = await admin();
  const { data: ch } = await db.from("user_mfa_challenges")
    .select("id, code_hash, attempts, expires_at, phone")
    .eq("user_id", ctx.userId).eq("session_id", sessionId).eq("purpose", purpose).is("consumed_at", null)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!ch || new Date(ch.expires_at).getTime() < Date.now()) throw new Error("Code expiré. Demandez un nouveau code.");
  if (ch.attempts >= MAX_ATTEMPTS) throw new Error("Trop d'essais. Demandez un nouveau code.");
  const ok = (await sha256Hex(`${ctx.userId}:${code}`)) === ch.code_hash;
  if (!ok) {
    await db.from("user_mfa_challenges").update({ attempts: ch.attempts + 1 }).eq("id", ch.id);
    throw new Error("Code incorrect");
  }
  await db.from("user_mfa_challenges").update({ consumed_at: new Date().toISOString() }).eq("id", ch.id);
  await db.from("user_mfa_sessions").upsert({
    user_id: ctx.userId, session_id: sessionId,
    verified_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + SESSION_TTL_HOURS * 3600_000).toISOString(),
  });
  return { db, phone: ch.phone as string };
}

const codeValidator = (input: { code: string }) => {
  const code = String(input?.code ?? "").replace(/\D/g, "");
  if (code.length !== 6) throw new Error("Le code contient 6 chiffres");
  return { code };
};

export const getUserMfaStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    const db = await admin();
    const { data: s } = await db.from("user_mfa_settings").select("enabled, phone").eq("user_id", ctx.userId).maybeSingle();
    const enabled = !!s?.enabled && !!s?.phone;
    let verified = !enabled;
    if (enabled) {
      const sessionId = String(ctx.claims?.session_id ?? "");
      const { data: sess } = await db.from("user_mfa_sessions").select("expires_at")
        .eq("user_id", ctx.userId).eq("session_id", sessionId).maybeSingle();
      verified = !!sess && new Date(sess.expires_at).getTime() > Date.now();
    }
    return { enabled, verified, maskedPhone: s?.phone ? maskPhone(s.phone) : null };
  });

export const requestLoginMfaCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    const db = await admin();
    const { data: s } = await db.from("user_mfa_settings").select("enabled, phone").eq("user_id", ctx.userId).maybeSingle();
    if (!s?.enabled || !s.phone) throw new Error("Double authentification non activée");
    return sendCode(ctx, s.phone, "login");
  });

export const verifyLoginMfaCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(codeValidator)
  .handler(async ({ data, context }) => {
    await checkCode(context as Ctx, data.code, "login");
    return { verified: true };
  });

export const requestMfaEnrollment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { phone: string }) => ({ phone: cleanPhone(input?.phone) }))
  .handler(async ({ data, context }) => sendCode(context as Ctx, data.phone, "enroll"));

export const confirmMfaEnrollment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(codeValidator)
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const { db, phone } = await checkCode(ctx, data.code, "enroll");
    const { error } = await db.from("user_mfa_settings").upsert({
      user_id: ctx.userId, enabled: true, phone, updated_at: new Date().toISOString(),
    });
    if (error) throw new Error("Activation impossible");
    return { enabled: true, maskedPhone: maskPhone(phone) };
  });

export const disableUserMfa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    const db = await admin();
    // Désactivation seulement depuis une session déjà vérifiée (ou sans MFA).
    const { data: s } = await db.from("user_mfa_settings").select("enabled").eq("user_id", ctx.userId).maybeSingle();
    if (s?.enabled) {
      const { data: sess } = await db.from("user_mfa_sessions").select("expires_at")
        .eq("user_id", ctx.userId).eq("session_id", sessionOf(ctx)).maybeSingle();
      if (!sess || new Date(sess.expires_at).getTime() < Date.now()) throw new Error("Session non vérifiée");
    }
    await db.from("user_mfa_settings").upsert({ user_id: ctx.userId, enabled: false, updated_at: new Date().toISOString() });
    return { enabled: false };
  });
