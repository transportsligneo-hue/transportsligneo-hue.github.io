/**
 * Webhook Yousign — réception des statuts de signature.
 *
 * Yousign signe la charge utile avec le secret configuré côté Yousign
 * (en-tête `X-Yousign-Signature-256: sha256=<hex>`). La signature est
 * vérifiée avant tout traitement.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";

const BUCKET = "contrats-convoyeurs";

async function notifyAdmin(
  admin: any,
  _fn: string,
  args: { p_type: string; p_title: string; p_message: string; p_link: string | null },
) {
  try {
    await admin.rpc("create_admin_notification", args as never);
  } catch {
    /* la notification admin ne doit jamais faire échouer le webhook */
  }
}

function verify(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const provided = header.startsWith("sha256=") ? header.slice(7) : header;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/public/yousign-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["YOUSIGN_WEBHOOK_SECRET"];
        if (!secret) return new Response("Webhook not configured", { status: 503 });

        const raw = await request.text();
        const header =
          request.headers.get("x-yousign-signature-256") ??
          request.headers.get("X-Yousign-Signature-256");
        if (!verify(raw, header, secret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: any;
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }

        const eventName: string = payload?.event_name ?? payload?.event ?? "";
        const sr = payload?.data?.signature_request ?? payload?.signature_request ?? null;
        const signatureRequestId: string | undefined = sr?.id;
        if (!signatureRequestId) return new Response("ok");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: contrat } = await supabaseAdmin
          .from("convoyeur_contrats")
          .select("id, convoyeur_id, nom_complet, statut")
          .eq("yousign_signature_request_id", signatureRequestId)
          .maybeSingle();
        if (!contrat) return new Response("ok");

        const now = new Date().toISOString();

        if (eventName === "signature_request.done") {
          let path: string | null = null;
          try {
            const ys = await import("@/lib/yousign.server");
            const detail = await ys.getSignatureRequest(signatureRequestId);
            const docId =
              detail.documents?.find((d) => d.nature === "signable_document")?.id ??
              detail.documents?.[0]?.id;
            if (docId) {
              const bytes = await ys.downloadSignedDocument(signatureRequestId, docId);
              path = `${contrat.convoyeur_id ?? "sans-convoyeur"}/${contrat.id}.pdf`;
              const up = await supabaseAdmin.storage
                .from(BUCKET)
                .upload(path, bytes, { contentType: "application/pdf", upsert: true });
              if (up.error) path = null;
            }
          } catch {
            path = null;
          }

          await supabaseAdmin
            .from("convoyeur_contrats")
            .update({
              statut: "signe",
              signed_at: now,
              ...(path ? { signed_pdf_path: path } : {}),
            })
            .eq("id", contrat.id);

          await notifyAdmin(supabaseAdmin, "create_admin_notification", {
            p_type: "contrat_signe",
            p_title: "Contrat de partenariat signé",
            p_message: `${contrat.nom_complet ?? "Un convoyeur"} a signé son contrat de partenariat.`,
            p_link: contrat.convoyeur_id ? `/admin/convoyeurs/${contrat.convoyeur_id}` : null,
          });
        } else if (eventName === "signature_request.declined") {
          const reason: string | null =
            payload?.data?.signer?.decline_reason ?? sr?.decline_reason ?? null;
          await supabaseAdmin
            .from("convoyeur_contrats")
            .update({ statut: "refuse", declined_at: now, decline_reason: reason })
            .eq("id", contrat.id);
          await notifyAdmin(supabaseAdmin, "create_admin_notification", {
            p_type: "contrat_refuse",
            p_title: "Contrat de partenariat refusé",
            p_message: `${contrat.nom_complet ?? "Un convoyeur"} a refusé de signer son contrat.${reason ? ` Motif : ${reason}` : ""}`,
            p_link: contrat.convoyeur_id ? `/admin/convoyeurs/${contrat.convoyeur_id}` : null,
          });
        } else if (eventName === "signature_request.expired") {
          await supabaseAdmin
            .from("convoyeur_contrats")
            .update({ statut: "expire", expired_at: now })
            .eq("id", contrat.id);
          await notifyAdmin(supabaseAdmin, "create_admin_notification", {
            p_type: "contrat_expire",
            p_title: "Contrat de partenariat expiré",
            p_message: `La demande de signature de ${contrat.nom_complet ?? "un convoyeur"} a expiré.`,
            p_link: contrat.convoyeur_id ? `/admin/convoyeurs/${contrat.convoyeur_id}` : null,
          });
        }

        return new Response("ok");
      },
    },
  },
});
