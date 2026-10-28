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
  numero: z.string().trim().min(3).max(40).optional(),
  plaque: z.string().trim().min(4).max(20).optional(),
  code: z.string().trim().min(4).max(16),
});

export const trackMissionPublic = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => trackSchema.parse(d))
  .handler(async ({ data }): Promise<PublicTracking> => {
    const { trackMission } = await import("./public-tracking.server");
    return trackMission({ numero: data.numero, plaque: data.plaque, code: data.code });
  });


const newsletterSchema = z.object({
  email: z.string().trim().email().max(255),
  source: z.string().trim().max(40).optional(),
  nom: z.string().trim().max(120).optional(),
  telephone: z.string().trim().max(30).optional(),
  ville: z.string().trim().max(120).optional(),
  adresse: z.string().trim().max(300).optional(),
});

export const subscribeNewsletter = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => newsletterSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();
    const isWaitlist = (data.source ?? "") === "convoyeur-waitlist";
    if (isWaitlist && (!data.nom || !data.telephone || !data.ville || !data.adresse)) {
      throw new Error("Merci de renseigner nom, téléphone, ville et adresse.");
    }
    if (isWaitlist) {
      // Candidat convoyeur : uniquement dans la liste d'attente, jamais dans la newsletter.
      const { error: wlErr } = await (supabaseAdmin as any).from("convoyeur_waitlist").upsert(
        { email, nom: data.nom, telephone: data.telephone, ville: data.ville, adresse: data.adresse, updated_at: new Date().toISOString() },
        { onConflict: "email" },
      );
      if (wlErr) {
        console.error("[waitlist] table insert failed", wlErr);
        throw new Error("Inscription impossible pour le moment.");
      }
    } else {
      const { error } = await supabaseAdmin
        .from("newsletter_abonnes")
        .upsert(
          { email, source: data.source ?? "footer", unsubscribed_at: null },
          { onConflict: "email" },
        );
      if (error) throw new Error("Inscription impossible pour le moment.");
    }

    // Liste d'attente convoyeur : accusé de réception candidat + alerte admin
    if (isWaitlist) {
      const dateFr = new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "Europe/Paris",
      }).format(new Date());
      const sourceLabel = "Page Devenir convoyeur";
      const details = {
        email, date: dateFr, source: sourceLabel,
        nom: data.nom, telephone: data.telephone, ville: data.ville, adresse: data.adresse,
      };

      // Cloche admin : insertion directe (le visiteur n'est pas connecté, la RPC refuserait)
      const { error: notifErr } = await supabaseAdmin.from("admin_notifications").insert({
        type: "convoyeur_waitlist",
        titre: "Nouvelle inscription liste d'attente convoyeur",
        message: `${data.nom} · ${data.telephone} · ${data.ville} — ${data.adresse} (${email})`,
        link: "/admin/liste-attente",
        entity_type: "convoyeur_waitlist",
        metadata: details,
      });
      if (notifErr) console.error("[waitlist] admin bell failed", notifErr);

      try {
        const { sendTransactionalEmailServer, getAdminNotificationEmail } = await import(
          "@/server/email-send"
        );
        const recipients = new Set(["contact@transportsligneo.fr", await getAdminNotificationEmail()]);
        for (const to of recipients) {
          await sendTransactionalEmailServer({
            templateName: "waitlist-convoyeur-admin",
            recipientEmail: to,
            idempotencyKey: `waitlist-convoyeur-admin-${email}-${to}-${Date.now()}`,
            templateData: details,
          });
        }
        await sendTransactionalEmailServer({
          templateName: "waitlist-convoyeur",
          recipientEmail: email,
          idempotencyKey: `waitlist-convoyeur-${email}`,
          templateData: details,
        });
      } catch (e) {
        console.error("[waitlist] email failed", e);
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
