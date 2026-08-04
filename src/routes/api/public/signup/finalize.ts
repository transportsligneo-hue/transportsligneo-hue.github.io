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

        let uploaded = 0;

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
                if (uploaded >= MAX_FILES) break;
                const file = form.get(`doc_${docType}`);
                if (!(file instanceof File) || file.size === 0) continue;
                if (file.size > MAX_FILE_BYTES) continue;
                const mime = file.type || "application/octet-stream";
                if (!mime.startsWith("image/") && mime !== "application/pdf") continue;

                const ext = (file.name.split(".").pop() ?? "jpg").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "jpg";
                const path = `${userId}/${docType}-${Date.now()}.${ext}`;
                const buffer = new Uint8Array(await file.arrayBuffer());

                const { error: upErr } = await supabaseAdmin.storage
                  .from("convoyeur-documents")
                  .upload(path, buffer, { contentType: mime, upsert: true });
                if (upErr) continue;

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
          }

          const adminEmail = await getAdminNotificationEmail();
          await Promise.all([
            sendTransactionalEmailServer({
              templateName: "inscription-convoyeur",
              recipientEmail: email,
              idempotencyKey: `inscription-candidat-${userId}`,
              templateData: { prenom },
            }).catch(() => null),
            sendTransactionalEmailServer({
              templateName: "inscription-convoyeur",
              recipientEmail: adminEmail,
              idempotencyKey: `inscription-admin-${userId}`,
              templateData: {
                prenom: `${prenom} ${nom} (${email} · ${meta['telephone'] ?? ""} · ${meta['ville'] ?? ""})`,
              },
            }).catch(() => null),
          ]);

          await supabaseAdmin.from("admin_notifications").insert({
            type: "driver_action",
            titre: "Nouvelle inscription convoyeur",
            message: `${prenom} ${nom} · ${email} · ${meta['ville'] ?? ""}`,
            link: "/admin/convoyeurs",
            entity_type: "convoyeur",
            entity_id: userId,
            metadata: { documents: uploaded },
          });

          return ok({ success: true, uploaded });
        }

        // Clients (particulier / pro B2B / flotte)
        await sendTransactionalEmailServer({
          templateName: "welcome-client",
          recipientEmail: email,
          idempotencyKey: `welcome-${userId}`,
          templateData: { prenom },
        }).catch(() => null);

        const label =
          kind === "flotte" ? "Nouvelle inscription flotte"
          : kind === "pro" ? "Nouvelle inscription pro (B2B)"
          : "Nouvelle inscription client";

        await supabaseAdmin.from("admin_notifications").insert({
          type: "client_action",
          titre: label,
          message: `${meta['societe'] ? `${meta['societe']} · ` : ""}${prenom} ${nom} · ${email}`,
          link: "/admin/clients",
          entity_type: "user",
          entity_id: userId,
          metadata: { kind },
        });

        return ok({ success: true });
      },
    },
  },
});
