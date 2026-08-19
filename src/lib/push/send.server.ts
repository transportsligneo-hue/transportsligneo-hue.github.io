// Server-only Web Push sender. Imported lazily from server fns/handlers.
import webpush from "web-push";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

let configured = false;
function configure() {
  if (configured) return;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:contact@transportsligneo.fr";
  if (!pub || !priv) throw new Error("Missing VAPID keys");
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
}

export type PushPayload = {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  requireInteraction?: boolean;
  data?: Record<string, unknown>;
};

/**
 * Sends a push to every subscription of a user. Auto-cleans dead endpoints (404/410).
 * Returns { sent, removed }.
 */
export async function sendPushToUser(userId: string, payload: PushPayload) {
  // 1) Push natif (app Capacitor driver) — indépendant du web push
  let native = { configured: false, devices: 0, sent: 0, removed: 0 };
  try {
    const { sendNativePushToUser } = await import("@/lib/push/fcm.server");
    native = await sendNativePushToUser(userId, {
      title: payload.title,
      body: payload.body,
      url: payload.url,
      tag: payload.tag,
    });
  } catch (e) {
    console.warn("[push] natif indisponible", e);
  }

  // 2) Web push (navigateur)
  let sent = 0;
  const dead: string[] = [];
  try {
    configure();
    const { data: subs } = await supabaseAdmin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth_key")
      .eq("user_id", userId);

    if (subs?.length) {
      const body = JSON.stringify(payload);
      await Promise.all(
        subs.map(async (s) => {
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } },
              body,
              { TTL: 3600 }
            );
            sent++;
          } catch (e: any) {
            const code = e?.statusCode;
            if (code === 404 || code === 410) dead.push(s.endpoint);
            else console.warn("[push] send failed", code, e?.body || e?.message);
          }
        })
      );
      if (dead.length) {
        await supabaseAdmin
          .from("push_subscriptions")
          .delete()
          .eq("user_id", userId)
          .in("endpoint", dead);
      }
    }
  } catch (e) {
    console.warn("[push] web push indisponible", e);
  }

  return {
    sent: sent + native.sent,
    removed: dead.length + native.removed,
    web: { sent, removed: dead.length },
    native,
  };
}


/**
 * Sends to all users with a given role (admin, super_admin, etc.).
 */
export async function sendPushToRole(
  role: "admin" | "super_admin" | "client" | "convoyeur" | "manager" | "sous_traitant",
  payload: PushPayload
) {
  configure();
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", role)
    .eq("actif", true);
  if (!roles?.length) return { sent: 0, removed: 0, users: 0 };
  let sent = 0, removed = 0;
  for (const r of roles) {
    const res = await sendPushToUser(r.user_id, payload);
    sent += res.sent; removed += res.removed;
  }
  return { sent, removed, users: roles.length };
}
