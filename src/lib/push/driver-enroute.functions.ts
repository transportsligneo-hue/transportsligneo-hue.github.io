/**
 * Notification automatique au client quand le convoyeur prend la route
 * pour aller récupérer le véhicule (étape « en_route » de l'app Driver).
 *
 * Envoie un SMS au client (+ notification in-app / push si un compte existe).
 * Aucun suivi GPS n'est déclenché ici : le tracking démarre seulement au
 * départ du trajet avec le véhicule, après l'état des lieux d'enlèvement.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().regex(/^[0-9a-f-]{36}$/i);

function cleanPhone(value?: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 9 ? value.trim() : null;
}

export const notifyClientDriverEnRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { attributionId: string }) => ({ attributionId: uuid.parse(input.attributionId) }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: attr } = await supabaseAdmin
      .from("attributions")
      .select(
        "id, numero_mission, options_completion, convoyeur:convoyeurs(user_id, nom, prenom), trajet:trajets(depart, arrivee, date_trajet, immatriculation, vehicule_immatriculation, client_telephone, contact_depart_tel, devis_id, demande_id)",
      )
      .eq("id", data.attributionId)
      .maybeSingle();
    if (!attr) throw new Error("Attribution introuvable");

    const row = attr as any;
    const driverUserId = row?.convoyeur?.user_id as string | undefined;
    const [{ data: isAdmin }, { data: isSuper }] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" }),
    ]);
    if (driverUserId !== context.userId && !isAdmin && !isSuper) throw new Error("Forbidden");

    // Idempotence : un seul message « en route » par mission.
    const completion = (row.options_completion ?? {}) as Record<string, { done?: boolean; at?: string }>;
    if (completion["sms_en_route"]?.done) return { sent: false, reason: "already_sent" as const };

    const trajet = row.trajet ?? {};
    let clientUserId: string | null = null;
    let clientPhone: string | null = null;
    if (trajet.devis_id) {
      const { data: d } = await supabaseAdmin
        .from("devis")
        .select("user_id, telephone")
        .eq("id", trajet.devis_id)
        .maybeSingle();
      clientUserId = (d as any)?.user_id ?? null;
      clientPhone = cleanPhone((d as any)?.telephone);
    }
    if (trajet.demande_id && (!clientUserId || !clientPhone)) {
      const { data: d } = await supabaseAdmin
        .from("demandes_convoyage")
        .select("user_id, telephone")
        .eq("id", trajet.demande_id)
        .maybeSingle();
      clientUserId = clientUserId ?? ((d as any)?.user_id ?? null);
      clientPhone = clientPhone ?? cleanPhone((d as any)?.telephone);
    }
    clientPhone = clientPhone ?? cleanPhone(trajet.client_telephone) ?? cleanPhone(trajet.contact_depart_tel);

    const plaque = (trajet.immatriculation ?? trajet.vehicule_immatriculation ?? "")
      .toString()
      .toUpperCase()
      .trim();
    const driverName = [row?.convoyeur?.prenom, row?.convoyeur?.nom].filter(Boolean).join(" ").trim();
    const mission = row.numero_mission ? ` ${row.numero_mission}` : "";

    const smsBody = [
      `Transports Ligneo : votre convoyeur${driverName ? ` ${driverName}` : ""} est en route`,
      plaque ? ` pour récupérer le véhicule ${plaque}` : " pour récupérer votre véhicule",
      trajet.depart ? ` à ${trajet.depart}` : "",
      `.${mission ? ` Mission${mission}.` : ""} Vous serez informé du départ du convoyage.`,
    ].join("");

    let smsSent = false;
    if (clientPhone) {
      const { sendSms } = await import("@/lib/sms.server");
      const res = await sendSms({ to: clientPhone, body: smsBody, from: "Ligneo" });
      smsSent = res.ok;
      if (!res.ok) console.warn("[notifyClientDriverEnRoute] SMS échoué", res.error);
    }

    if (clientUserId) {
      const payload = {
        title: "Convoyeur en route 🚗",
        body: `Votre convoyeur se rend sur le lieu d'enlèvement${plaque ? ` · ${plaque}` : ""}.`,
        url: "/dashboard-client/missions",
        tag: `driver-enroute-${data.attributionId}`,
      };
      try {
        await supabaseAdmin.from("user_notifications").insert({
          user_id: clientUserId,
          type: "convoyeur_en_route",
          titre: payload.title,
          message: payload.body,
          link: payload.url,
        } as never);
        const { sendPushToUser } = await import("@/lib/push/send.server");
        await sendPushToUser(clientUserId, payload);
      } catch (e) {
        console.warn("[notifyClientDriverEnRoute] notif in-app/push échouée", e);
      }
    }

    await supabaseAdmin
      .from("attributions")
      .update({
        options_completion: {
          ...completion,
          sms_en_route: { done: true, at: new Date().toISOString() },
        },
      } as never)
      .eq("id", data.attributionId);

    return { sent: smsSent, phone: clientPhone ? true : false };
  });
