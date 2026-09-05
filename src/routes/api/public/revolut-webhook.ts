import { createFileRoute } from "@tanstack/react-router";
import { verifyRevolutSignature, mapRevolutState } from "@/lib/revolut-server";

// Webhook Revolut Merchant : mise à jour du statut des liens de paiement.
export const Route = createFileRoute("/api/public/revolut-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["REVOLUT_WEBHOOK_SECRET"];
        if (!secret) {
          console.error("[revolut-webhook] REVOLUT_WEBHOOK_SECRET missing");
          return new Response("Not configured", { status: 500 });
        }

        const rawBody = await request.text();
        const ok = await verifyRevolutSignature({
          rawBody,
          signatureHeader: request.headers.get("revolut-signature"),
          timestampHeader: request.headers.get("revolut-request-timestamp"),
          secret,
        });
        if (!ok) return new Response("Invalid signature", { status: 401 });

        let payload: any;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const orderId: string | undefined = payload?.order_id ?? payload?.id;
        const eventType: string = String(payload?.event ?? payload?.type ?? "");
        if (!orderId) return Response.json({ received: true, ignored: "no order id" });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Idempotence : un même événement n'est traité qu'une seule fois.
        const eventKey = `${orderId}:${eventType}:${payload?.timestamp ?? ""}`;
        const { error: dupError } = await supabaseAdmin
          .from("payment_link_events")
          .insert({ provider: "revolut", event_key: eventKey, event_type: eventType, payload });
        if (dupError) {
          if (dupError.code === "23505") {
            return Response.json({ received: true, duplicate: true });
          }
          console.error("[revolut-webhook] event log error", dupError.message);
        }

        const statut =
          eventType === "ORDER_COMPLETED"
            ? "paid"
            : eventType === "ORDER_CANCELLED"
              ? "cancelled"
              : eventType === "ORDER_AUTHORISED"
                ? "processing"
                : eventType === "ORDER_PAYMENT_FAILED"
                  ? "failed"
                  : mapRevolutState(payload?.state);

        const { data: updatedLinks, error } = await supabaseAdmin
          .from("payment_links")
          .update({
            statut,
            paid_at: statut === "paid" ? new Date().toISOString() : null,
          })
          .eq("revolut_order_id", orderId)
          .select("id, amount_cents, devis_id, facture_id, mission_id");
        if (error) {
          console.error("[revolut-webhook] update error", error.message);
          return new Response("Handler error", { status: 500 });
        }

        // Paiement encaissé → facture émise et envoyée immédiatement au client,
        // même si aucune mission n'a encore été créée à partir du devis.
        if (statut === "paid") {
          const link = (updatedLinks ?? [])[0];
          try {
            const { ensureFactureForDevis, sendFactureDisponibleEmail, markFacturePaidAndSend } =
              await import("@/lib/facture-auto.server");

            if (link?.facture_id) {
              await markFacturePaidAndSend(link.facture_id, {
                amountCents: link.amount_cents ?? null,
                modePaiement: "Revolut",
                paidAt: payload?.timestamp ?? new Date().toISOString(),
              });
            } else if (link?.devis_id) {
              const { data: devis } = await supabaseAdmin
                .from("devis")
                .select("*")
                .eq("id", link.devis_id)
                .maybeSingle();
              if (devis) {
                await supabaseAdmin
                  .from("devis")
                  .update({
                    paid_at: new Date().toISOString(),
                    amount_paid_cents: link.amount_cents ?? null,
                    updated_at: new Date().toISOString(),
                  } as never)
                  .eq("id", link.devis_id);
                const facture = await ensureFactureForDevis(devis, {
                  amountCents: link.amount_cents ?? null,
                  missionId: link.mission_id ?? null,
                    modePaiement: "Revolut",
                    paidAt: payload?.timestamp ?? new Date().toISOString(),
                });
                await sendFactureDisponibleEmail(facture);
                if (facture?.["id"] && link.id) {
                  await supabaseAdmin
                    .from("payment_links")
                    .update({ facture_id: facture["id"] })
                    .eq("id", link.id);
                }
              }
            }
          } catch (e) {
            console.error("[revolut-webhook] facture auto error", e);
          }
        }


        return Response.json({ received: true });
      },
    },
  },
});
