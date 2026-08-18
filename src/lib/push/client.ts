import { savePushSubscription, deletePushSubscription } from "@/lib/push.functions";

// Public VAPID key — safe to ship to the browser.
export const VAPID_PUBLIC_KEY =
  "BDCUDLILPNBpmveF-xyqd9PfhXk0W_Zoabl78nEr3rCIpDHIdH6vUBNLAi8VwFVhQtFSjJS8ejS2-ppDVstQ8Rc";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function bufToB64Url(buf: ArrayBuffer | null) {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function isCapacitorWebView() {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } };
  return w.Capacitor?.isNativePlatform?.() === true;
}

export function pushSupported() {
  // Dans la WebView Capacitor, le Web Push (SW + PushManager) n'est pas fiable :
  // on le considère non supporté, le natif prend le relais.
  if (isCapacitorWebView()) return false;
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}


export async function getSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function subscribeToPush() {
  if (!pushSupported()) throw new Error("Notifications non supportées");
  let reg = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!reg) reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Permission refusée");

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }
  const json = sub.toJSON() as any;
  await savePushSubscription({
    data: {
      endpoint: sub.endpoint,
      p256dh: json?.keys?.p256dh ?? bufToB64Url(sub.getKey("p256dh")),
      auth_key: json?.keys?.auth ?? bufToB64Url(sub.getKey("auth")),
      user_agent: navigator.userAgent.slice(0, 500),
    },
  });
  return sub;
}

export async function unsubscribeFromPush() {
  const sub = await getSubscription();
  if (!sub) return;
  try { await deletePushSubscription({ data: { endpoint: sub.endpoint } }); } catch {}
  await sub.unsubscribe();
}
