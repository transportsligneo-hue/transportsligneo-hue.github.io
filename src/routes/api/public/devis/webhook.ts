import { createFileRoute } from "@tanstack/react-router";
import { verifyStripeWebhook, type StripeEnv } from "@/lib/stripe-server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Webhook Stripe pour le paiement des devis particuliers/pro.
// Configurer dans Stripe Dashboard : POST /api/public/devis/webhook?env=sandbox|live
export const Route = createFileRoute("/api/public/devis/webhook")({
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
          console.error("[devis/webhook] verification failed", e?.message);
          return new Response("Invalid signature", { status: 400 });
        }

        try {
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

              // 3. Auto-create mission if needed
              if (devis && !missionId && devis.user_id) {
                const { data: mission } = await supabaseAdmin
                  .from("missions")
                  .insert({
                    user_id: devis.user_id,
                    ville_depart: devis.depart,
                    ville_arrivee: devis.arrivee,
                    date_prise_en_charge: devis.date_souhaitee ?? new Date().toISOString().slice(0, 10),
                    type_trajet: devis.option_trajet === "aller_retour" ? "aller_retour" : "aller_simple",
                    options: [],
                    marque: devis.marque ?? null,
                    modele: devis.modele ?? null,
                    carburant: devis.carburant ?? null,
                    remarques: devis.message ?? null,
                    nom: devis.nom,
                    prenom: devis.prenom,
                    email: devis.email,
                    telephone: devis.telephone ?? null,
                    prix_total: devis.prix_estime,
                    statut: "confirmee",
                  } as any)
                  .select("id")
                  .single();

                missionId = mission?.id ?? null;
                if (missionId) {
                  await supabaseAdmin
                    .from("devis")
                    .update({ mission_id: missionId, converted_at: new Date().toISOString() })
                    .eq("id", devisId);
                }
              }

              // 4. Auto-create facture (payée)
              if (devis) {
                const prixTtc = Number(devis.prix_estime ?? 0);
                const prixHt = Math.round((prixTtc / 1.2) * 100) / 100;
                const prixTva = Math.round((prixTtc - prixHt) * 100) / 100;
                await supabaseAdmin.from("factures").insert({
                  mission_id: missionId,
                  client_email: devis.email,
                  client_nom: devis.nom,
                  client_prenom: devis.prenom,
                  type_facture: "particulier",
                  date_mission: devis.date_souhaitee ?? null,
                  prix_ht: prixHt,
                  tva_taux: 20,
                  prix_tva: prixTva,
                  prix_ttc: prixTtc,
                  statut: "payee",
                  mode_paiement: "carte",
                  date_paiement: new Date().toISOString().slice(0, 10),
                } as any);
              }

              // 5. Enqueue confirmation email
              try {
                await supabaseAdmin.rpc("enqueue_email", {
                  queue_name: "transactional_emails",
                  payload: {
                    to: devis?.email,
                    subject: `Paiement confirmé — ${devis?.numero ?? ""}`,
                    template: "devis-paye",
                    data: {
                      prenom: devis?.prenom,
                      numero: devis?.numero,
                      depart: devis?.depart,
                      arrivee: devis?.arrivee,
                      montant: Number(devis?.prix_estime ?? 0).toFixed(2),
                    },
                  },
                });
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
        } catch (e: any) {
          console.error("[devis/webhook] handler error", e);
          return new Response("Handler error", { status: 500 });
        }
        return Response.json({ received: true });
      },
    },
  },
});
