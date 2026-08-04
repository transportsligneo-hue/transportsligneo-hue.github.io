import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendTransactionalEmailServer, getAdminNotificationEmail } from "@/server/email-send";

/**
 * Finalisation d'inscription (appelée juste après signUp).
 *
 * Nécessaire parce que la confirmation d'email est active : `supabase.auth.signUp`
 * ne renvoie AUCUNE session, donc côté navigateur on ne peut ni uploader les
 * documents convoyeur, ni envoyer les emails transactionnels (401), ni créer la
 * notification admin (RLS). Ce endpoint public fait ce travail côté serveur.
 *
 * Sécurité : on n'accepte que des comptes créés il y a moins de 30 minutes,
 * encore non confirmés, et une seule fois (aucun document déjà présent).
 *
 * Observabilité : chaque exécution écrit une ligne dans `signup_events`
 * (documents reçus/rejetés, emails envoyés avec code d'erreur, notification).
 */

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 8;
const ALLOWED_DOC_TYPES = new Set([
  "permis",
  "permis_verso",
  "identite",
  "rib",
  "kbis",
  "assurance",
  "photo_profil",
]);
const KINDS = new Set(["convoyeur", "client", "pro", "flotte"]);

function ok(body: unknown, status = 200) {
  return Response.json(body, { status });
}

interface EmailLog {
  template: string;
  recipient: string;
  status: "sent" | "failed";
  code?: string;
  at: string;
}

interface RejectedDoc {
  type: string;
  reason: string;
  detail?: string;
}

async function logEmail(
  templateName: string,
  recipientEmail: string,
  templateData: Record<string, unknown>,
  idempotencyKey: string,
  out: EmailLog[],
): Promise<void> {
  const at = new Date().toISOString();
  try {
    const res = await sendTransactionalEmailServer({
      templateName,
      recipientEmail,
      idempotencyKey,
      templateData,
    });
    if (res.success) {
      console.info(`[signup/finalize] email ok template=${templateName} to=${recipientEmail} key=${idempotencyKey}`);
      out.push({ template: templateName, recipient: recipientEmail, status: "sent", at });
    } else {
      console.error(
        `[signup/finalize] email FAILED template=${templateName} to=${recipientEmail} code=${res.reason} key=${idempotencyKey}`,
      );
      out.push({ template: templateName, recipient: recipientEmail, status: "failed", code: res.reason ?? "unknown", at });
    }
  } catch (e) {
    const code = e instanceof Error ? e.message.slice(0, 200) : "exception";
    console.error(`[signup/finalize] email EXCEPTION template=${templateName} to=${recipientEmail} code=${code}`);
    out.push({ template: templateName, recipient: recipientEmail, status: "failed", code, at });
  }
}

export const Route = createFileRoute("/api/public/signup/finalize")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return ok({ error: "bad_request" }, 400);
        }

        const userId = String(form.get("userId") ?? "");
        const kind = String(form.get("kind") ?? "");
        if (!/^[0-9a-f-]{36}$/i.test(userId) || !KINDS.has(kind)) {
          return ok({ error: "invalid_payload" }, 400);
        }

        const { data: userRes, error: userErr } = await supabaseAdmin.auth.admin.getUserById(userId);
        const user = userRes?.user;
        if (userErr || !user) return ok({ error: "not_found" }, 404);

        // Fenêtre courte + compte non confirmé : empêche toute réutilisation du endpoint.
        const ageMs = Date.now() - new Date(user.created_at).getTime();
        if (ageMs > 30 * 60 * 1000) return ok({ error: "expired" }, 403);
        if (user.email_confirmed_at) return ok({ error: "already_confirmed" }, 403);

        const meta = (user.user_metadata ?? {}) as Record<string, string>;
        const prenom = meta['prenom'] ?? "";
        const nom = meta['nom'] ?? "";
        const email = user.email ?? "";

        const emails: EmailLog[] = [];
        const rejected: RejectedDoc[] = [];
        let uploaded = 0;
        let expected = 0;
        let notificationCreated = false;
        let errorMessage: string | null = null;

        if (kind === "convoyeur") {
          if (meta['role'] !== "convoyeur") return ok({ error: "role_mismatch" }, 403);

          const { data: convoyeur } = await supabaseAdmin
            .from("convoyeurs")
            .select("id")
            .eq("user_id", userId)
            .maybeSingle();

          if (convoyeur?.id) {
            const { count } = await supabaseAdmin
              .from("documents_convoyeurs")
              .select("id", { count: "exact", head: true })
              .eq("convoyeur_id", convoyeur.id);

            if ((count ?? 0) === 0) {
              let permisPath: string | null = null;
              for (const docType of ALLOWED_DOC_TYPES) {
                const file = form.get(`doc_${docType}`);
                if (!(file instanceof File) || file.size === 0) continue;
                expected += 1;
                if (uploaded >= MAX_FILES) {
                  rejected.push({ type: docType, reason: "too_many_files" });
                  continue;
                }
                if (file.size > MAX_FILE_BYTES) {
                  rejected.push({ type: docType, reason: "file_too_large", detail: `${Math.round(file.size / 1024)} Ko` });
                  continue;
                }
                const mime = file.type || "application/octet-stream";
                if (!mime.startsWith("image/") && mime !== "application/pdf") {
                  rejected.push({ type: docType, reason: "unsupported_type", detail: mime });
                  continue;
                }

                const ext = (file.name.split(".").pop() ?? "jpg").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "jpg";
                const path = `${userId}/${docType}-${Date.now()}.${ext}`;
                const buffer = new Uint8Array(await file.arrayBuffer());

                const { error: upErr } = await supabaseAdmin.storage
                  .from("convoyeur-documents")
                  .upload(path, buffer, { contentType: mime, upsert: true });
                if (upErr) {
                  console.error(`[signup/finalize] upload FAILED type=${docType} user=${userId} code=${upErr.message}`);
                  rejected.push({ type: docType, reason: "storage_error", detail: upErr.message.slice(0, 200) });
                  continue;
                }

                await supabaseAdmin.from("documents_convoyeurs").insert({
                  convoyeur_id: convoyeur.id,
                  type_document: docType,
                  nom_fichier: file.name.slice(0, 200),
                  url_fichier: path,
                  statut_validation: "en_attente",
                });
                if (docType === "permis") permisPath = path;
                uploaded += 1;
              }
              if (permisPath) {
                await supabaseAdmin
                  .from("convoyeurs")
                  .update({ permis_photo_url: permisPath })
                  .eq("id", convoyeur.id);
              }
            }
          } else {
            errorMessage = "Fiche convoyeur introuvable (trigger handle_new_user).";
            console.error(`[signup/finalize] convoyeur row missing user=${userId}`);
          }

          const adminEmail = await getAdminNotificationEmail();
          await logEmail("inscription-convoyeur", email, { prenom }, `inscription-candidat-${userId}`, emails);
          await logEmail(
            "inscription-convoyeur",
            adminEmail,
            { prenom: `${prenom} ${nom} (${email} · ${meta['telephone'] ?? ""} · ${meta['ville'] ?? ""})` },
            `inscription-admin-${userId}`,
            emails,
          );

          const { error: notifErr } = await supabaseAdmin.from("admin_notifications").insert({
            type: "driver_action",
            titre: "Nouvelle inscription convoyeur",
            message: `${prenom} ${nom} · ${email} · ${meta['ville'] ?? ""}`,
            link: "/admin/convoyeurs",
            entity_type: "convoyeur",
            entity_id: userId,
            metadata: { documents: uploaded },
          });
          if (notifErr) {
            console.error(`[signup/finalize] notification FAILED user=${userId} code=${notifErr.message}`);
            errorMessage = errorMessage ?? notifErr.message.slice(0, 200);
          } else {
            notificationCreated = true;
          }
        } else {
          // Clients (particulier / pro B2B / flotte)
          await logEmail("welcome-client", email, { prenom }, `welcome-${userId}`, emails);

          const label =
            kind === "flotte" ? "Nouvelle inscription flotte"
            : kind === "pro" ? "Nouvelle inscription pro (B2B)"
            : "Nouvelle inscription client";

          const { error: notifErr } = await supabaseAdmin.from("admin_notifications").insert({
            type: "client_action",
            titre: label,
            message: `${meta['societe'] ? `${meta['societe']} · ` : ""}${prenom} ${nom} · ${email}`,
            link: "/admin/clients",
            entity_type: "user",
            entity_id: userId,
            metadata: { kind },
          });
          if (notifErr) {
            console.error(`[signup/finalize] notification FAILED user=${userId} code=${notifErr.message}`);
            errorMessage = notifErr.message.slice(0, 200);
          } else {
            notificationCreated = true;
          }
        }

        const emailsFailed = emails.filter((e) => e.status === "failed").length;
        const status =
          errorMessage || emailsFailed > 0 || rejected.length > 0
            ? emails.length > 0 && emailsFailed === emails.length && !notificationCreated
              ? "failed"
              : "partial"
            : "ok";

        const { error: logErr } = await supabaseAdmin.from("signup_events").insert({
          user_id: userId,
          email,
          full_name: `${prenom} ${nom}`.trim() || null,
          kind,
          documents_expected: expected,
          documents_uploaded: uploaded,
          documents_rejected: rejected,
          emails,
          notification_created: notificationCreated,
          status,
          error_message: errorMessage,
        });
        if (logErr) console.error(`[signup/finalize] signup_events insert failed code=${logErr.message}`);

        console.info(
          `[signup/finalize] done user=${userId} kind=${kind} status=${status} docs=${uploaded}/${expected} emails_failed=${emailsFailed} notif=${notificationCreated}`,
        );

        return ok({ success: status !== "failed", status, uploaded, expected, rejected, emails, notificationCreated });
      },
    },
  },
});
