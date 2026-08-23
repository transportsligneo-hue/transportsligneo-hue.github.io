/**
 * Envoi de notifications natives (Capacitor Android/iOS) via Firebase Cloud
 * Messaging HTTP v1. Server-only : nécessite le secret FIREBASE_SERVICE_ACCOUNT
 * (le JSON complet du compte de service Firebase).
 *
 * Si le secret est absent, les fonctions renvoient { configured: false } sans
 * jamais lever d'erreur — les notifications web push continuent de fonctionner.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id: string;
};

/** Logo couleur (avec badge) utilisé comme visuel des notifications Android. */
const NOTIFICATION_IMAGE_URL = "https://transportsligneo.fr/logo-ligneo.png";

export type NativePushPayload = {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
  /** Grande image (https) affichée dans la notification Android. */
  image?: string;
};

function readServiceAccount(): ServiceAccount | null {
  const raw = process.env["FIREBASE_SERVICE_ACCOUNT"];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccount;
    if (!parsed.client_email || !parsed.private_key || !parsed.project_id) return null;
    return { ...parsed, private_key: parsed.private_key.replace(/\\n/g, "\n") };
  } catch {
    console.warn("[fcm] FIREBASE_SERVICE_ACCOUNT n'est pas un JSON valide");
    return null;
  }
}

function b64url(input: ArrayBuffer | string): string {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const bin = atob(body);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

let cachedToken: { token: string; exp: number } | null = null;

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp > now + 60) return cachedToken.token;

  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${header}.${claim}`),
  );
  const jwt = `${header}.${claim}.${b64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`FCM auth failed [${res.status}]: ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: json.access_token, exp: now + (json.expires_in ?? 3600) };
  return json.access_token;
}

export function fcmConfigured(): boolean {
  return readServiceAccount() !== null;
}

/** Envoie une notification native à tous les appareils enregistrés d'un utilisateur. */
export async function sendNativePushToUser(userId: string, payload: NativePushPayload) {
  const sa = readServiceAccount();
  const { data: tokens } = await supabaseAdmin
    .from("native_push_tokens")
    .select("token, platform")
    .eq("user_id", userId);

  if (!tokens?.length) return { configured: !!sa, devices: 0, sent: 0, removed: 0 };
  if (!sa) return { configured: false, devices: tokens.length, sent: 0, removed: 0 };

  const accessToken = await getAccessToken(sa);
  let sent = 0;
  const dead: string[] = [];

  for (const t of tokens) {
    try {
      const res = await fetch(
        `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token: t.token,
              notification: { title: payload.title, body: payload.body ?? "" },
              data: {
                url: payload.url ?? "/convoyeur",
                tag: payload.tag ?? "ligneo",
              },
              android: {
                priority: "HIGH",
                notification: {
                  channel_id: "missions",
                  // Petite icône : Android impose une silhouette monochrome
                  icon: "ic_notification",
                  // Teinte appliquée à la silhouette + accent système
                  color: "#2F5FFF",
                  // Visuel couleur (logo complet avec badge) affiché à l'ouverture
                  // de la notification (grande image) — seule façon d'avoir de la
                  // couleur et le badge sur Android.
                  image: payload.image ?? NOTIFICATION_IMAGE_URL,
                },
              },
              apns: {
                payload: { aps: { sound: "default", badge: 1 } },
              },
            },
          }),
        },
      );
      if (res.ok) {
        sent++;
      } else {
        const text = await res.text();
        console.warn(`[fcm] envoi échoué [${res.status}]: ${text}`);
        if (res.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/.test(text)) dead.push(t.token);
      }
    } catch (e) {
      console.warn("[fcm] erreur réseau", e);
    }
  }

  if (dead.length) {
    await supabaseAdmin.from("native_push_tokens").delete().eq("user_id", userId).in("token", dead);
  }
  return { configured: true, devices: tokens.length, sent, removed: dead.length };
}
