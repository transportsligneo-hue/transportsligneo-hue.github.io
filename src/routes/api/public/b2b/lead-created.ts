import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendTransactionalEmailServer, getAdminNotificationEmail } from "@/server/email-send";

const Schema = z.object({
  leadId: z.string().uuid(),
});

// Public endpoint called right after a fleet lead is created from the public form.
// We re-fetch from DB (zero-trust on client payload) and send the admin notification.
export const Route = createFileRoute("/api/public/b2b/lead-created")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: any;
        try { body = await request.json(); } catch { return Response.json({ error: "bad json" }, { status: 400 }); }
        const parsed = Schema.safeParse(body);
        if (!parsed.success) return Response.json({ error: "invalid payload" }, { status: 400 });

        const { data: lead, error: lErr } = await supabaseAdmin
          .from("b2b_fleet_leads")
          .select("id, numero, lead_score, score_category, structure_type, need_type, estimated_vehicle_count, frequency, start_delay, budget, description, company_id")
          .eq("id", parsed.data.leadId)
          .maybeSingle();

        if (lErr || !lead) return Response.json({ error: "lead not found" }, { status: 404 });

        const { data: company } = await supabaseAdmin
          .from("companies")
          .select("name, size, contact_name, contact_email, contact_phone")
          .eq("id", lead.company_id ?? "")
          .maybeSingle();

        // Only notify for hot/warm leads to avoid noise
        if (lead.score_category !== "hot" && lead.score_category !== "warm") {
          return Response.json({ skipped: "cold" });
        }

        const adminEmail = await getAdminNotificationEmail();
        await sendTransactionalEmailServer({
          templateName: "b2b-lead-flotte-admin",
          recipientEmail: adminEmail,
          idempotencyKey: `lead-flotte-${lead.id}`,
          templateData: {
            numero: lead.numero,
            scoreCategory: lead.score_category,
            leadScore: lead.lead_score,
            companyName: company?.name,
            structureType: lead.structure_type,
            size: company?.size,
            contactName: company?.contact_name,
            contactEmail: company?.contact_email,
            contactPhone: company?.contact_phone,
            needType: lead.need_type,
            vehicleCount: lead.estimated_vehicle_count,
            frequency: lead.frequency,
            startDelay: lead.start_delay,
            budget: lead.budget,
            description: lead.description,
          },
        });

        await supabaseAdmin.from("b2b_actions_history").insert({
          action_type: "admin_notified",
          related_id: lead.id,
          related_type: "fleet_lead",
          company_id: lead.company_id,
          metadata: { channel: "email", recipient: adminEmail },
        });

        return Response.json({ success: true });
      },
    },
  },
});
