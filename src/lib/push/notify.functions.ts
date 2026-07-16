import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const payloadSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().max(500).optional(),
  url: z.string().max(500).optional(),
  tag: z.string().max(100).optional(),
});

const uuid = z.string().regex(/^[0-9a-f-]{36}$/i);

async function insertUserNotification(
  supabaseAdmin: any,
  userId: string,
  type: string,
  payload: z.infer<typeof payloadSchema>,
) {
  try {
    await supabaseAdmin.from("user_notifications").insert({
      user_id: userId,
      type,
      titre: payload.title,
      message: payload.body ?? null,
      link: payload.url ?? null,
    });
  } catch (e) {
    console.warn("[notify] user_notifications insert failed", e);
  }
}

/** Push to a specific user (admin/super_admin only). */
export const pushToUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; payload: z.infer<typeof payloadSchema> }) => ({
    userId: uuid.parse(input.userId),
    payload: payloadSchema.parse(input.payload),
  }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    const { data: isSuper } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
    if (!isAdmin && !isSuper) throw new Error("Forbidden");
    const { sendPushToUser } = await import("@/lib/push/send.server");
    return sendPushToUser(data.userId, data.payload);
  });

/** Push to every active admin. Restricted to internal same-origin paths and
 * safe title/body defaults to prevent phishing/spam from arbitrary users. */
export const pushToAdmins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { payload: z.infer<typeof payloadSchema> }) => ({
    payload: payloadSchema.parse(input.payload),
  }))
  .handler(async ({ data }) => {
    // Force url to be an internal admin path only — never external, never arbitrary.
    const rawUrl = data.payload.url ?? "/admin/notifications";
    const safeUrl = typeof rawUrl === "string" && rawUrl.startsWith("/admin/") ? rawUrl : "/admin/notifications";
    const sanitized = {
      ...data.payload,
      url: safeUrl,
      title: data.payload.title.slice(0, 120),
      body: data.payload.body?.slice(0, 500),
    };
    const { sendPushToRole } = await import("@/lib/push/send.server");
    return sendPushToRole("admin", sanitized);
  });

/** Self-test push. */
export const pushToMe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { payload?: z.infer<typeof payloadSchema> }) => ({
    payload: payloadSchema.parse(
      input.payload ?? { title: "Notifications activées", body: "Vous recevrez les alertes ici." }
    ),
  }))
  .handler(async ({ data, context }) => {
    const { sendPushToUser } = await import("@/lib/push/send.server");
    return sendPushToUser(context.userId, data.payload);
  });

/**
 * Driver — mission attribuée. Caller: admin/super_admin (validation d'offre).
 * Pousse une notif + insère l'historique pour le convoyeur de l'attribution.
 */
export const notifyDriverAssigned = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { attributionId: string }) => ({ attributionId: uuid.parse(input.attributionId) }))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    const { data: isSuper } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
    if (!isAdmin && !isSuper) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("attributions")
      .select("id, numero_mission, convoyeur:convoyeurs(user_id), trajet:trajets(depart, arrivee, date_trajet, devis_id, demande_id)")
      .eq("id", data.attributionId)
      .maybeSingle();
    const driverUserId = (row as any)?.convoyeur?.user_id as string | undefined;
    const trajet = (row as any)?.trajet ?? {};

    const { sendPushToUser } = await import("@/lib/push/send.server");
    let driverResult = { sent: 0, removed: 0 };
    if (driverUserId) {
      const driverPayload = {
        title: "Mission attribuée 🚗",
        body: `${trajet.depart ?? ""} → ${trajet.arrivee ?? ""}${trajet.date_trajet ? ` · ${trajet.date_trajet}` : ""}`,
        url: "/convoyeur/missions",
        tag: `attribution-${data.attributionId}`,
      };
      await insertUserNotification(supabaseAdmin, driverUserId, "mission_attribuee", driverPayload);
      driverResult = await sendPushToUser(driverUserId, driverPayload);
    }

    // Notifier également le client
    try {
      let clientUserId: string | null = null;
      if (trajet.devis_id) {
        const { data: d } = await supabaseAdmin.from("devis").select("user_id").eq("id", trajet.devis_id).maybeSingle();
        clientUserId = (d as any)?.user_id ?? null;
      }
      if (!clientUserId && trajet.demande_id) {
        const { data: d } = await supabaseAdmin.from("demandes_convoyage").select("user_id").eq("id", trajet.demande_id).maybeSingle();
        clientUserId = (d as any)?.user_id ?? null;
      }
      if (clientUserId) {
        const clientPayload = {
          title: "Convoyeur assigné ✓",
          body: `Votre mission ${trajet.depart ?? ""} → ${trajet.arrivee ?? ""} est confirmée.`,
          url: "/dashboard-client/missions",
          tag: `client-attribution-${data.attributionId}`,
        };
        await insertUserNotification(supabaseAdmin, clientUserId, "convoyeur_assigne", clientPayload);
        await sendPushToUser(clientUserId, clientPayload);
      }
    } catch (e) {
      console.warn("[notify] client assign push failed", e);
    }

    return driverResult;
  });

/**
 * Client — mission terminée. Caller: convoyeur attribué OU admin.
 * Identifie le client (devis/demande/mission) lié et lui pousse la notif + historique.
 */
export const notifyClientMissionCompleted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { attributionId: string }) => ({ attributionId: uuid.parse(input.attributionId) }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: attr } = await supabaseAdmin
      .from("attributions")
      .select("id, numero_mission, convoyeur:convoyeurs(user_id), trajet:trajets(depart, arrivee, devis_id, demande_id)")
      .eq("id", data.attributionId)
      .maybeSingle();
    if (!attr) throw new Error("Attribution introuvable");

    // Auth : convoyeur de l'attribution OU admin
    const driverUserId = (attr as any)?.convoyeur?.user_id as string | undefined;
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    const { data: isSuper } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
    if (driverUserId !== context.userId && !isAdmin && !isSuper) throw new Error("Forbidden");

    const trajet = (attr as any)?.trajet ?? {};
    let clientUserId: string | null = null;
    let clientEmail: string | null = null;
    if (trajet.devis_id) {
      const { data: d } = await supabaseAdmin.from("devis").select("user_id, email").eq("id", trajet.devis_id).maybeSingle();
      clientUserId = (d as any)?.user_id ?? null;
      clientEmail = (d as any)?.email ?? null;
    }
    if (!clientUserId && trajet.demande_id) {
      const { data: d } = await supabaseAdmin.from("demandes_convoyage").select("user_id, email").eq("id", trajet.demande_id).maybeSingle();
      clientUserId = (d as any)?.user_id ?? null;
      clientEmail = clientEmail ?? (d as any)?.email ?? null;
    }
    if (!clientUserId && clientEmail) {
      const { data: p } = await supabaseAdmin.from("profiles").select("user_id").ilike("email", clientEmail).maybeSingle();
      clientUserId = (p as any)?.user_id ?? null;
    }
    if (!clientUserId) return { sent: 0, removed: 0 };

    const payload = {
      title: "Mission terminée ✓",
      body: `Votre véhicule a été livré · ${trajet.depart ?? ""} → ${trajet.arrivee ?? ""}`,
      url: "/dashboard-client/missions",
      tag: `mission-done-${data.attributionId}`,
    };
    await insertUserNotification(supabaseAdmin, clientUserId, "mission_terminee", payload);
    const { sendPushToUser } = await import("@/lib/push/send.server");
    return sendPushToUser(clientUserId, payload);
  });
