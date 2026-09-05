// Handlers partagés des webhooks Stripe — utilisés par les routes
// /api/public/devis/webhook, /api/public/facture/webhook,
// /api/public/b2b/webhook et la route unifiée /api/public/stripe-webhook.
// La signature Stripe est vérifiée par la route appelante (verifyStripeWebhook).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendTransactionalEmailServer, getAdminNotificationEmail } from "@/server/email-send";

type StripeEvent = { type: string; data: { object: any } };

/** Convertit un devis payé : statut, missions, facture, emails, notifications admin. */
export async function handleDevisWebhookEvent(event: StripeEvent): Promise<void> {
  if (event.type === "checkout.session.completed") {
    const s = event.data.object;
    const devisId = s?.metadata?.devis_id;
    const sessionId = s?.id;
    const paymentIntentId = typeof s?.payment_intent === "string" ? s.payment_intent : s?.payment_intent?.id;
    const amount = Number(s?.amount_total ?? 0);

    if (devisId) {
      // 1. Fetch full devis
      const { data: devis } = await supabaseAdmin
        .from("devis")
        .select("*")
        .eq("id", devisId)
        .maybeSingle();

      // 2. Mark devis paid
      await supabaseAdmin
        .from("devis")
        .update({
          statut: "convertit",
          paid_at: new Date().toISOString(),
          stripe_session_id: sessionId,
          stripe_payment_intent_id: paymentIntentId ?? null,
          amount_paid_cents: amount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", devisId);

      let missionId: string | null = devis?.mission_id ?? null;

      // 3. Auto-create / complete missions through the shared AR-safe conversion flow
      if (devis) {
        const { data: convertedRows, error: conversionError } = await supabaseAdmin.rpc(
          "admin_convert_devis_to_missions" as never,
          {
            _devis_id: devis.id,
            _converted_by: devis.user_id ?? null,
            _mission_status: "confirmee",
          } as never,
        );
        if (conversionError) throw conversionError;

        const rows = (convertedRows ?? []) as Array<{ mission_id: string; leg: string }>;
        const mainMission = rows.find((row) => row.leg === "aller" || row.leg === "simple") ?? rows[0];
        missionId = mainMission?.mission_id ?? missionId;
      }

      // 4. Auto-create facture (payée) — numéro aligné sur le devis (DEV-TLG-YYYY-### → FAC-TLG-YYYY-###)
      //    puis envoi immédiat de la facture au client, même sans mission créée.
      if (devis) {
        const { ensureFactureForDevis, sendFactureDisponibleEmail } = await import(
          "@/lib/facture-auto.server"
        );
        const facture = await ensureFactureForDevis(devis, {
          amountCents: amount,
          missionId,
          sessionId: sessionId ?? null,
          paymentIntentId: paymentIntentId ?? null,
        });
        await sendFactureDisponibleEmail(facture);
      }


      // 5. Enqueue confirmation email (template registry → file d'attente rendue)
      try {
        if (devis?.email) {
          await sendTransactionalEmailServer({
            templateName: "devis-paye",
            recipientEmail: devis.email,
            idempotencyKey: `devis-paye-${devisId}`,
            templateData: {
              prenom: devis?.prenom,
              numero: devis?.numero,
              depart: devis?.depart,
              arrivee: devis?.arrivee,
              prix: Number(devis?.prix_estime ?? amount / 100).toFixed(2),
            },
          });
        }
      } catch (e) {
        console.error("[devis/webhook] email error", e);
      }

      // 6. Notify admin (history + push)
      try {
        await supabaseAdmin.rpc("create_admin_notification", {
          _type: "b2b_paiement",
          _titre: "Paiement devis confirmé",
          _message: `Devis ${devis?.numero ?? devisId} payé · ${(amount / 100).toFixed(2)} €`,
          _link: `/admin/devis/${devisId}`,
          _entity_type: "devis",
          _entity_id: devisId,
          _metadata: { session_id: sessionId, amount_cents: amount, mission_id: missionId },
        });
      } catch (e) {
        console.error("[devis/webhook] notification error", e);
      }
      try {
        const { sendPushToRole } = await import("@/lib/push/send.server");
        await sendPushToRole("admin", {
          title: "Paiement reçu 💳",
          body: `Devis ${devis?.numero ?? devisId} · ${(amount / 100).toFixed(2)} €`,
          url: `/admin/devis/${devisId}`,
          tag: `paiement-devis-${devisId}`,
        });
      } catch (e) {
        console.error("[devis/webhook] push error", e);
      }
    }
  } else if (event.type === "payment_intent.payment_failed") {
    const pi = event.data.object;
    const devisId = pi?.metadata?.devis_id;
    if (devisId) {
      await supabaseAdmin
        .from("devis")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", devisId);
    }
  }
}

/** Marque une facture pro comme payée et notifie (admin + client). */
export async function handleFactureWebhookEvent(event: StripeEvent): Promise<void> {
  if (event.type === "checkout.session.completed" || event.type === "payment_intent.succeeded") {
    const s = event.data.object;
    // Filter to facture sessions only — ignore other types routed to this URL.
    if (s?.metadata?.type !== "facture_pro") {
      return;
    }
    const isIntent = event.type === "payment_intent.succeeded";
    const factureId = s?.metadata?.facture_id;
    const sessionId = isIntent ? null : s?.id;
    const paymentIntentId = isIntent
      ? s?.id
      : (typeof s?.payment_intent === "string" ? s.payment_intent : s?.payment_intent?.id);
    const amount = Number((isIntent ? s?.amount_received ?? s?.amount : s?.amount_total) ?? 0);

    if (factureId) {
      const { data: facture } = await supabaseAdmin
        .from("factures")
        .select("*")
        .eq("id", factureId)
        .maybeSingle();

      // Idempotence : ne rien refaire si déjà encaissée.
      if (facture?.paid_at || facture?.statut === "payee") {
        return;
      }

      await supabaseAdmin
        .from("factures")
        .update({
          statut: "payee",
          mode_paiement: "carte",
          date_paiement: new Date().toISOString().slice(0, 10),
          paid_at: new Date().toISOString(),
          ...(sessionId ? { stripe_session_id: sessionId } : {}),
          stripe_payment_intent_id: paymentIntentId ?? null,
          amount_paid_cents: amount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", factureId);

      // Notify admin (history + push)
      try {
        await supabaseAdmin.rpc("create_admin_notification", {
          _type: "facture_paiement",
          _titre: "Facture payée en ligne",
          _message: `Facture ${facture?.numero ?? factureId} payée · ${(amount / 100).toFixed(2)} €`,
          _link: `/admin/factures`,
          _entity_type: "facture",
          _entity_id: factureId,
          _metadata: { session_id: sessionId, amount_cents: amount },
        });
      } catch (e) {
        console.error("[facture/webhook] notification error", e);
      }
      try {
        const { sendPushToRole } = await import("@/lib/push/send.server");
        await sendPushToRole("admin", {
          title: "Paiement reçu 💳",
          body: `Facture ${facture?.numero ?? factureId} · ${(amount / 100).toFixed(2)} €`,
          url: `/admin/factures`,
          tag: `paiement-facture-${factureId}`,
        });
      } catch (e) {
        console.error("[facture/webhook] push error", e);
      }

      // Send confirmation email (template registry → file d'attente rendue)
      if (facture?.client_email) {
        try {
          await sendTransactionalEmailServer({
            templateName: "paiement-confirme",
            recipientEmail: facture.client_email,
            idempotencyKey: `facture-payee-${factureId}`,
            templateData: {
              prenom: facture.client_prenom ?? facture.client_nom ?? undefined,
              numero: facture.numero,
              montant: (amount / 100).toFixed(2),
              date: new Date().toLocaleDateString("fr-FR"),
            },
          });
        } catch (e) {
          console.error("[facture/webhook] email error", e);
        }
      }
    }
  }
}

/** Confirme le paiement d'une demande B2B ponctuelle et notifie l'admin. */
export async function handleB2BWebhookEvent(event: StripeEvent): Promise<void> {
  if (event.type === "checkout.session.completed") {
    const s = event.data.object;
    const requestId = s?.metadata?.b2b_request_id;
    const sessionId = s?.id;
    const paymentIntentId = typeof s?.payment_intent === "string" ? s.payment_intent : s?.payment_intent?.id;

    if (requestId) {
      await supabaseAdmin
        .from("b2b_transport_requests")
        .update({
          payment_status: "paid",
          stripe_session_id: sessionId,
          stripe_payment_intent_id: paymentIntentId ?? null,
          operational_status: "a_dispatcher",
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      // Re-fetch full request + company
      const { data: req2 } = await supabaseAdmin
        .from("b2b_transport_requests")
        .select("id, numero, pickup_address, dropoff_address, scheduled_date, scheduled_time, vehicle_type, urgency, estimated_price_ttc, company_id")
        .eq("id", requestId)
        .maybeSingle();

      const { data: company } = req2?.company_id
        ? await supabaseAdmin.from("companies")
            .select("name, contact_name, contact_email, contact_phone")
            .eq("id", req2.company_id).maybeSingle()
        : { data: null as any };

      await supabaseAdmin.from("b2b_actions_history").insert({
        action_type: "payment_succeeded",
        related_id: requestId,
        related_type: "transport_request",
        company_id: req2?.company_id ?? null,
        metadata: { session_id: sessionId, payment_intent_id: paymentIntentId },
      });

      // === Notification admin: paiement B2B ===
      const adminEmail = await getAdminNotificationEmail();
      await sendTransactionalEmailServer({
        templateName: "b2b-paiement-admin",
        recipientEmail: adminEmail,
        idempotencyKey: `b2b-paid-${requestId}`,
        templateData: {
          numero: req2?.numero,
          pickup: req2?.pickup_address,
          dropoff: req2?.dropoff_address,
          scheduledDate: req2?.scheduled_date,
          scheduledTime: req2?.scheduled_time,
          vehicleType: req2?.vehicle_type,
          urgency: req2?.urgency,
          prixTtc: req2?.estimated_price_ttc,
          companyName: company?.name,
          contactName: company?.contact_name,
          contactEmail: company?.contact_email,
          contactPhone: company?.contact_phone,
        },
      });

      // === Détection auto: conversion ponctuel → flotte ===
      if (req2?.company_id) {
        const { data: paidRows } = await supabaseAdmin
          .from("b2b_transport_requests")
          .select("estimated_price_ttc")
          .eq("company_id", req2.company_id)
          .eq("payment_status", "paid");

        const paidCount = paidRows?.length ?? 0;
        if (paidCount >= 3) {
          // Already notified ?
          const { data: alreadyNotified } = await supabaseAdmin
            .from("b2b_actions_history")
            .select("id")
            .eq("company_id", req2.company_id)
            .eq("action_type", "conversion_suggested")
            .limit(1).maybeSingle();

          if (!alreadyNotified) {
            const totalAmount = paidRows!.reduce(
              (s, r) => s + (Number(r.estimated_price_ttc) || 0), 0
            );
            await sendTransactionalEmailServer({
              templateName: "b2b-conversion-suggestion-admin",
              recipientEmail: adminEmail,
              idempotencyKey: `b2b-conversion-${req2.company_id}`,
              templateData: {
                companyName: company?.name,
                contactName: company?.contact_name,
                contactEmail: company?.contact_email,
                contactPhone: company?.contact_phone,
                paidCount,
                totalAmount,
              },
            });
            await supabaseAdmin.from("b2b_actions_history").insert({
              action_type: "conversion_suggested",
              related_id: req2.company_id,
              related_type: "company",
              company_id: req2.company_id,
              metadata: { paid_count: paidCount, total_amount: totalAmount },
            });
          }
        }
      }
    }
  } else if (event.type === "payment_intent.payment_failed") {
    const pi = event.data.object;
    const requestId = pi?.metadata?.b2b_request_id;
    if (requestId) {
      await supabaseAdmin
        .from("b2b_transport_requests")
        .update({ payment_status: "failed", updated_at: new Date().toISOString() })
        .eq("id", requestId);
    }
  } else {
    console.log("[b2b/webhook] unhandled", event.type);
  }
}