import { createServerFn } from "@tanstack/react-start";

/**
 * Chat conseiller pour visiteurs non connectés.
 * Le visiteur ne détient qu'un jeton aléatoire ; toutes les lectures/écritures
 * passent par ces fonctions et sont filtrées par ce jeton (jamais d'accès direct).
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TOKEN_RE = /^[a-f0-9]{48}$/;

function newToken() {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export const startVisitorChat = createServerFn({ method: "POST" })
  .inputValidator((i: { name: string; email: string; summary?: string; message: string }) => {
    const name = String(i?.name ?? "").trim().slice(0, 80);
    const email = String(i?.email ?? "").trim().toLowerCase().slice(0, 160);
    const message = String(i?.message ?? "").trim().slice(0, 2000);
    const summary = String(i?.summary ?? "").trim().slice(0, 1500);
    if (name.length < 2) throw new Error("Indiquez votre nom.");
    if (!EMAIL_RE.test(email)) throw new Error("Adresse email invalide.");
    if (message.length < 2) throw new Error("Écrivez votre message.");
    return { name, email, message, summary };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Anti-spam : 5 nouvelles conversations max par email et par heure
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await supabaseAdmin
      .from("chat_conversations")
      .select("id", { count: "exact", head: true })
      .eq("visitor_email", data.email)
      .gte("created_at", since);
    if ((count ?? 0) >= 5) throw new Error("Trop de demandes, réessayez plus tard.");

    const token = newToken();
    const { data: conv, error } = await supabaseAdmin
      .from("chat_conversations")
      .insert({
        kind: "conseiller",
        source: data.summary ? "vroomy" : "visiteur",
        visitor_name: data.name,
        visitor_email: data.email,
        visitor_token: token,
        vroomy_summary: data.summary || null,
      })
      .select("id")
      .single();
    if (error || !conv) throw new Error("Impossible d'ouvrir la conversation.");
    await supabaseAdmin.from("chat_messages").insert({
      conversation_id: conv.id,
      sender_type: "visiteur",
      body: data.message,
    });
    return { token };
  });

async function convForToken(token: string) {
  if (!TOKEN_RE.test(token)) throw new Error("Session invalide.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("chat_conversations")
    .select("id, status")
    .eq("visitor_token", token)
    .maybeSingle();
  if (!data) throw new Error("Conversation introuvable.");
  return { supabaseAdmin, conv: data };
}

export const listVisitorMessages = createServerFn({ method: "POST" })
  .inputValidator((i: { token: string }) => ({ token: String(i?.token ?? "") }))
  .handler(async ({ data }) => {
    const { supabaseAdmin, conv } = await convForToken(data.token);
    const { data: rows } = await supabaseAdmin
      .from("chat_messages")
      .select("id, sender_type, body, created_at, read_at")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: true })
      .limit(200);
    await supabaseAdmin.from("chat_conversations").update({ unread_participant: 0 }).eq("id", conv.id);
    return { status: conv.status, messages: rows ?? [] };
  });

export const sendVisitorMessage = createServerFn({ method: "POST" })
  .inputValidator((i: { token: string; body: string }) => {
    const body = String(i?.body ?? "").trim().slice(0, 2000);
    if (!body) throw new Error("Message vide.");
    return { token: String(i?.token ?? ""), body };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin, conv } = await convForToken(data.token);
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await supabaseAdmin
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conv.id)
      .eq("sender_type", "visiteur")
      .gte("created_at", since);
    if ((count ?? 0) >= 40) throw new Error("Trop de messages, patientez un instant.");
    await supabaseAdmin.from("chat_messages").insert({
      conversation_id: conv.id,
      sender_type: "visiteur",
      body: data.body,
    });
    return { ok: true };
  });
