import { createFileRoute } from "@tanstack/react-router";
import { verifyStripeWebhook, type StripeEnv } from "@/lib/stripe-server";
import { handleB2BWebhookEvent } from "@/lib/stripe-webhooks.server";

// Public endpoint: Stripe webhook for B2B one-off transport payments.
// Signature verification protects this route.
export const Route = createFileRoute("/api/public/b2b/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const rawEnv = url.searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          return Response.json({ received: true, ignored: "invalid env" }, { status: 200 });
        }
        const env: StripeEnv = rawEnv;

        let event: { type: string; data: { object: any } };
        try {
          event = await verifyStripeWebhook(request, env);
        } catch (e: any) {
          console.error("[b2b/webhook] verification failed", e?.message);
          return new Response("Invalid signature", { status: 400 });
        }

        try {
          await handleB2BWebhookEvent(event);
        } catch (e: any) {
          console.error("[b2b/webhook] handler error", e);
          return new Response("Handler error", { status: 500 });
        }
        return Response.json({ received: true });
      },
    },
  },
});