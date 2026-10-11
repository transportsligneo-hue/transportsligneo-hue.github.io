import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UUID_RE = /^[0-9a-f-]{36}$/i;

/** Appelé après l'envoi d'un message par un utilisateur connecté. */
export const notifyChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { messageId: string }) => {
    if (!UUID_RE.test(String(i?.messageId))) throw new Error("Invalid id");
    return { messageId: i.messageId };
  })
  .handler(async ({ data, context }) => {
    // Le message doit être lisible par l'appelant et envoyé par lui.
    const { data: own } = await context.supabase
      .from("chat_messages")
      .select("id")
      .eq("id", data.messageId)
      .eq("sender_id", context.userId)
      .maybeSingle();
    if (!own) return { ok: false };
    const { notifyChatMessageById } = await import("./chat-notify.server");
    await notifyChatMessageById(data.messageId);
    return { ok: true };
  });
