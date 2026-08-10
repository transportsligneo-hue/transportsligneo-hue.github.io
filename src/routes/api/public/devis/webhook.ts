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
              if (devis) {
                // Idempotence : ne pas recréer la facture si le webhook est rejoué
                const { data: existingFacture } = await supabaseAdmin
                  .from("factures")
                  .select("id")
                  .eq("stripe_session_id", sessionId)
                  .maybeSingle();

                const prixTtc = Number(devis.prix_estime ?? 0);
                const prixHt = Math.round((prixTtc / 1.2) * 100) / 100;
                const prixTva = Math.round((prixTtc - prixHt) * 100) / 100;
                const factureNumero = /^DEV-TLG-\d{4}-#?\d{3}$/.test(devis.numero ?? "")
                  ? (devis.numero as string).replace("DEV-TLG", "FAC-TLG")
                  : undefined;
                const vehiculeLabel = [devis.marque, devis.modele].filter(Boolean).join(" ");
                const designation = [
                  "Convoyage automobile par conducteur professionnel",
                  vehiculeLabel || null,
                  devis.option_trajet === "aller_retour" ? "Livraison + restitution" : "Livraison simple",
                ]
                  .filter(Boolean)
                  .join(" — ");

                if (!existingFacture) await supabaseAdmin.from("factures").insert({
                  ...(factureNumero && { numero: factureNumero }),
                  mission_id: missionId,
                  client_email: devis.email,
                  client_nom: devis.nom,
                  client_prenom: devis.prenom,
                  type_facture: "particulier",
                  date_mission: devis.date_souhaitee ?? null,
                  depart: devis.depart ?? null,
                  arrivee: devis.arrivee ?? null,
                  distance_km: devis.distance_km ?? null,
                  designation,
                  reference_label: "Devis",
                  reference_client: devis.numero ?? null,
                  prix_ht: prixHt,
                  tva_taux: 20,
                  prix_tva: prixTva,
                  prix_ttc: prixTtc,
                  statut: "payee",
                  mode_paiement: "carte",
                  date_paiement: new Date().toISOString().slice(0, 10),
                  paid_at: new Date().toISOString(),
                  amount_paid_cents: amount || Math.round(prixTtc * 100),
                  stripe_session_id: sessionId ?? null,
                  stripe_payment_intent_id: paymentIntentId ?? null,
                } as any);


                // Aligner la séquence FAC-TLG pour éviter les collisions futures
                if (factureNumero) {
                  const suffix = parseInt(factureNumero.slice(-3), 10);
                  const year = parseInt(factureNumero.split("-")[2], 10);
                  await supabaseAdmin
                    .from("mission_sequences")
                    .update({ current_value: suffix, updated_at: new Date().toISOString() })
                    .eq("prefix", "FAC-TLG")
                    .eq("year", year)
                    .lt("current_value", suffix);
                }
              }

              // 5. Enqueue confirmation email (template registry → file d'attente rendue)
              try {
                if (devis?.email) {
                  const { sendTransactionalEmailServer } = await import("@/server/email-send");
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
        } catch (e: any) {
          console.error("[devis/webhook] handler error", e);
          return new Response("Handler error", { status: 500 });
        }
        return Response.json({ received: true });
      },
    },
  },
});
