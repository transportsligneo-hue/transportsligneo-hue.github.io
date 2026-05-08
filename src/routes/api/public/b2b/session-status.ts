import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Public endpoint: returns minimal status for a Stripe session id only.
// No sensitive fields (no internal_notes, no Stripe IDs, no company_id).
export const Route = createFileRoute("/api/public/b2b/session-status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const sessionId = url.searchParams.get("session_id");
        if (!sessionId || sessionId.length < 10 || sessionId.length > 200) {
          return Response.json({ error: "Invalid session_id" }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
          .from("b2b_transport_requests")
          .select("numero, pickup_address, dropoff_address, scheduled_date, scheduled_time, estimated_price_ttc, vehicle_type, urgency, payment_status")
          .eq("stripe_session_id", sessionId)
          .maybeSingle();

        if (error) return Response.json({ error: "Lookup failed" }, { status: 500 });
        if (!data) return Response.json({ request: null });
        return Response.json({ request: data });
      },
    },
  },
});
