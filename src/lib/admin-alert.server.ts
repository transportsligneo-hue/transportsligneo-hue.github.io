/**
 * Alerte admin côté serveur : cloche (admin_notifications) + notification push
 * vers tous les admins et super admins. Ne casse jamais le parcours appelant.
 */
export async function pushAdmins(title: string, body: string | undefined, url: string, tag?: string) {
  try {
    const { sendPushToRole } = await import("@/lib/push/send.server");
    const payload = { title: title.slice(0, 120), body: body?.slice(0, 500), url, tag };
    await Promise.allSettled([sendPushToRole("admin", payload), sendPushToRole("super_admin", payload)]);
  } catch (e) {
    console.warn("[pushAdmins] échec", e);
  }
}
