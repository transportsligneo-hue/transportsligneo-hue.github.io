import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Phase 2 — Validation d'une attribution par le convoyeur.
 * Le convoyeur accepte ou refuse une attribution qui lui a été assignée
 * (mode 'directe') ou qu'il a remportée (mode 'catalogue').
 */
export const respondToAttribution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        attributionId: z.string().uuid(),
        action: z.enum(["accepte", "refuse"]),
        motif: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Récupérer l'attribution + convoyeur associé
    const { data: attr, error: aErr } = await supabase
      .from("attributions")
      .select("id, convoyeur_id, statut, statut_convoyeur, trajet_id, mode, convoyeurs:convoyeur_id(user_id)")
      .eq("id", data.attributionId)
      .maybeSingle();
    if (aErr) throw aErr;
    if (!attr) throw new Error("Attribution introuvable");

    const convoyeurUserId = (attr as { convoyeurs?: { user_id?: string } }).convoyeurs?.user_id;
    if (convoyeurUserId !== userId) throw new Error("Forbidden");

    if (attr.statut_convoyeur !== "en_attente") {
      return { ok: true, alreadyResponded: true, statut_convoyeur: attr.statut_convoyeur };
    }
    if (data.action === "refuse" && !data.motif) {
      throw new Error("Un motif est requis pour refuser une attribution.");
    }

    const now = new Date().toISOString();
    const { error: uErr } = await supabase
      .from("attributions")
      .update({
        statut_convoyeur: data.action,
        repondu_at: now,
        refus_motif: data.action === "refuse" ? data.motif ?? null : null,
        // Sur refus, on remet l'attribution en 'annulee' pour que l'admin puisse réattribuer.
        // Sur accept, on active la course.
        statut: data.action === "accepte" ? "active" : "annulee",
      })
      .eq("id", data.attributionId);
    if (uErr) throw uErr;

    // Notification admin complète : les champs de la table sont `titre` (pas `title`).
    // On enrichit depuis les enregistrements liés pour que l'admin identifie
    // immédiatement le conducteur, la mission, le trajet et le motif du refus.
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const [{ data: trajet }, { data: convoyeur }] = await Promise.all([
        supabaseAdmin.from("trajets").select("*").eq("id", attr.trajet_id).maybeSingle(),
        supabaseAdmin.from("convoyeurs").select("*").eq("id", attr.convoyeur_id).maybeSingle(),
      ]);

      const driver = convoyeur as Record<string, any> | null;
      const trip = trajet as Record<string, any> | null;
      const driverName = [driver?.prenom, driver?.nom].filter(Boolean).join(" ") || "Convoyeur";
      const missionNumber = String(trip?.numero_mission || (attr as any).numero_mission || attr.id.slice(0, 8));
      const from = String(trip?.depart || trip?.adresse_depart || trip?.ville_depart || "Non renseigné");
      const to = String(trip?.arrivee || trip?.adresse_arrivee || trip?.ville_arrivee || "Non renseigné");
      const refusal = data.action === "refuse";
      const titre = refusal ? `Mission ${missionNumber} refusée par ${driverName}` : `Mission ${missionNumber} acceptée par ${driverName}`;
      const message = [
        `${driverName}${driver?.telephone ? ` · ${driver.telephone}` : ""}${driver?.email ? ` · ${driver.email}` : ""}`,
        `${from} → ${to}`,
        `Mission : ${missionNumber}`,
        refusal ? `Motif du refus : ${data.motif || "Non communiqué"}` : "Le convoyeur a accepté la mission.",
      ].join("\n");
      const { data: createdNotif, error: notifError } = await supabaseAdmin.from("admin_notifications").insert({
        type: refusal ? "attribution_refusee" : "attribution_acceptee",
        titre,
        message,
        link: `/admin/missions/${attr.id}`,
        entity_type: "attribution",
        entity_id: attr.id,
        metadata: {
          attribution_id: attr.id,
          trajet_id: attr.trajet_id,
          convoyeur_id: attr.convoyeur_id,
          convoyeur_nom: driverName,
          convoyeur_telephone: driver?.telephone ?? null,
          convoyeur_email: driver?.email ?? null,
          numero_mission: missionNumber,
          depart: from,
          arrivee: to,
          motif: refusal ? data.motif ?? null : null,
          statut_convoyeur: data.action,
          repondu_at: now,
        },
      } as never).select("id").single();
      if (notifError) {
        console.error("[respondToAttribution] notification admin failed", notifError);
      } else if (createdNotif?.id) {
        // Envoi email immédiat aux destinataires configurés dans l'admin.
        // Le dispatcher planifié reste le filet de sécurité si l'envoi échoue.
        try {
          const { data: settingsRow } = await supabaseAdmin
            .from("app_settings").select("value").eq("key", "admin_alert_emails").maybeSingle();
          const settings = ((settingsRow as { value?: any } | null)?.value ?? {}) as { enabled?: boolean; emails?: string[] };
          let recipients = (settings.emails ?? []).filter((email) => typeof email === "string" && email.includes("@"));
          if (!recipients.length) {
            const { getAdminNotificationEmail } = await import("@/server/email-send");
            recipients = [await getAdminNotificationEmail()];
          }
          if (settings.enabled !== false && recipients.length) {
            const { sendTransactionalEmailServer } = await import("@/server/email-send");
            let allEmailsSent = true;
            let emailAttempted = false;
            for (const recipientEmail of [...new Set(recipients)]) {
              const result = await sendTransactionalEmailServer({
                templateName: "alerte-admin",
                recipientEmail,
                idempotencyKey: `admin-alert-${createdNotif.id}-${recipientEmail}`,
                templateData: {
                  titre,
                  message,
                  categorie: refusal ? "Refus de mission par un convoyeur" : "Acceptation de mission par un convoyeur",
                  lien: `https://transportsligneo.fr/admin/missions/${attr.id}`,
                  recu_le: new Date(now).toLocaleString("fr-FR", { timeZone: "Europe/Paris" }),
                  details: [
                    { label: "Convoyeur", value: driverName },
                    { label: "Téléphone", value: String(driver?.telephone ?? "Non renseigné") },
                    { label: "Email", value: String(driver?.email ?? "Non renseigné") },
                    { label: "Mission", value: missionNumber },
                    { label: "Trajet", value: `${from} → ${to}` },
                    ...(refusal ? [{ label: "Motif du refus", value: data.motif || "Non communiqué" }] : []),
                  ],
                },
              });
              emailAttempted = true;
              allEmailsSent = allEmailsSent && result.success;
            }
            if (emailAttempted && allEmailsSent) {
              await supabaseAdmin.from("admin_notifications")
                .update({ email_sent_at: new Date().toISOString() }).eq("id", createdNotif.id);
            }
          }
        } catch (emailError) {
          console.error("[respondToAttribution] admin email failed", emailError);
        }
      }
    } catch (notificationError) {
      // La réponse du convoyeur reste enregistrée même si la notification échoue.
      console.error("[respondToAttribution] notification admin error", notificationError);
    }

    return { ok: true, statut_convoyeur: data.action, repondu_at: now };
  });
