/**
 * Server functions publiques (aucune authentification) :
 * - suivi de mission par numéro + code confidentiel (données minimales)
 * - inscription newsletter
 * - réglages publics (liens stores)
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { PublicTracking } from "./public-tracking.server";

export type { PublicTracking };

const trackSchema = z.object({
  numero: z.string().trim().min(3).max(40),
  code: z.string().trim().min(4).max(16),
});

export const trackMissionPublic = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => trackSchema.parse(d))
  .handler(async ({ data }): Promise<PublicTracking> => {
    const { trackMission } = await import("./public-tracking.server");
    return trackMission({ numero: data.numero, code: data.code });
  });


const newsletterSchema = z.object({
  email: z.string().trim().email().max(255),
  source: z.string().trim().max(40).optional(),
});

export const subscribeNewsletter = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => newsletterSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();
    const { error } = await supabaseAdmin
      .from("newsletter_abonnes")
      .upsert(
        { email, source: data.source ?? "footer", unsubscribed_at: null },
        { onConflict: "email" },
      );
    if (error) throw new Error("Inscription impossible pour le moment.");

    // Liste d'attente convoyeur : accusé de réception candidat + alerte admin
    if ((data.source ?? "") === "convoyeur-waitlist") {
      const dateFr = new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "Europe/Paris",
      }).format(new Date());
      const sourceLabel = "Page Devenir convoyeur";

      try {
        const { sendTransactionalEmailServer, getAdminNotificationEmail } = await import(
          "@/server/email-send"
        );
        await sendTransactionalEmailServer({
          templateName: "waitlist-convoyeur",
          recipientEmail: email,
          idempotencyKey: `waitlist-convoyeur-${email}`,
          templateData: { email, date: dateFr, source: sourceLabel },
        });
        const adminEmail = await getAdminNotificationEmail();
        await sendTransactionalEmailServer({
          templateName: "waitlist-convoyeur-admin",
          recipientEmail: adminEmail,
          idempotencyKey: `waitlist-convoyeur-admin-${email}-${Date.now()}`,
          templateData: { email, date: dateFr, source: sourceLabel },
        });
      } catch (e) {
        console.error("[waitlist] email failed", e);
      }

      try {
        await supabaseAdmin.rpc("create_admin_notification", {
          _type: "convoyeur",
          _titre: "Nouvelle inscription liste d'attente convoyeur",
          _message: `${email} souhaite rejoindre le réseau de convoyeurs (${sourceLabel}).`,
          _link: "/admin/marketing",
          _entity_type: "newsletter_abonne",
          _entity_id: null,
        } as never);
      } catch (e) {
        console.error("[waitlist] admin notification failed", e);
      }
    }

    return { ok: true };
  });

export type StoreLinks = { ios: string | null; android: string | null };

export const getStoreLinks = createServerFn({ method: "GET" }).handler(
  async (): Promise<StoreLinks> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "store_links")
      .maybeSingle();
    const v = (data?.value ?? {}) as Record<string, unknown>;
    const clean = (x: unknown) =>
      typeof x === "string" && /^https:\/\//.test(x.trim()) ? x.trim() : null;
    return { ios: clean(v["ios"]), android: clean(v["android"]) };
  },
);

export type RegistrationGate = {
  client: boolean;
  pro: boolean;
  flotte: boolean;
  convoyeur: boolean;
};

export const getRegistrationGate = createServerFn({ method: "GET" }).handler(
  async (): Promise<RegistrationGate> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "registration_gate")
      .maybeSingle();
    const v = (data?.value ?? {}) as Record<string, unknown>;
    const bool = (x: unknown) => x === true;
    return {
      client: bool(v["client"]),
      pro: bool(v["pro"]),
      flotte: bool(v["flotte"]),
      convoyeur: bool(v["convoyeur"]),
    };
  },
);
