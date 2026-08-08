import { createFileRoute } from "@tanstack/react-router";
import { createStripeClient, type StripeEnv } from "@/lib/stripe-server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/facture/payment-intent")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: any;
        try { body = await request.json(); } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const { factureId, environment } = body ?? {};
        if (!factureId || !UUID_RE.test(String(factureId))) {
          return Response.json({ error: "Invalid factureId" }, { status: 400 });
        }
        const env: StripeEnv = environment === "live" ? "live" : "sandbox";

        const { data: facture, error } = await supabaseAdmin
          .from("factures")
          .select("id, numero, client_email, client_nom, client_prenom, client_societe, depart, arrivee, designation, prix_ht, prix_tva, prix_ttc, tva_taux, statut, paid_at, reference_client, reference_label, stripe_payment_intent_id")
          .eq("id", factureId)
          .maybeSingle();

        if (error || !facture) {
          return Response.json({ error: "Facture introuvable" }, { status: 404 });
        }
        if (facture.paid_at || facture.statut === "payee") {
          return Response.json({ error: "Facture déjà payée", alreadyPaid: true }, { status: 409 });
        }
        if (!["emise", "en_retard"].includes(String(facture.statut))) {
          return Response.json({ error: "Facture non payable" }, { status: 409 });
        }
        const ttc = Number(facture.prix_ttc);
        if (!ttc || ttc < 1) {
          return Response.json({ error: "Montant invalide" }, { status: 400 });
        }
        const amount = Math.round(ttc * 100);

        const summary = {
          numero: facture.numero,
          depart: facture.depart,
          arrivee: facture.arrivee,
          designation: facture.designation,
          clientEmail: facture.client_email,
          clientNom: [facture.client_prenom, facture.client_nom].filter(Boolean).join(" "),
          clientSociete: facture.client_societe,
          prixHt: Number(facture.prix_ht ?? 0),
          prixTva: Number(facture.prix_tva ?? 0),
          prixTtc: ttc,
          tvaTaux: Number(facture.tva_taux ?? 0),
          referenceClient: facture.reference_client ?? null,
          referenceLabel: facture.reference_label ?? null,
        };

        try {
          const stripe = createStripeClient(env);

          // Réutilise l'intention existante quand elle est encore payable.
          if (facture.stripe_payment_intent_id) {
            try {
              const existing = await stripe.paymentIntents.retrieve(facture.stripe_payment_intent_id);
              if (["requires_payment_method", "requires_confirmation", "requires_action"].includes(existing.status)) {
                const refreshed = existing.amount !== amount
                  ? await stripe.paymentIntents.update(existing.id, { amount })
                  : existing;
                return Response.json({ clientSecret: refreshed.client_secret, summary });
              }
            } catch { /* recreate below */ }
          }

          const metadata: Record<string, string> = {
            type: "facture_pro",
            facture_id: facture.id,
            facture_numero: facture.numero,
          };
          if (facture.reference_client) metadata['reference_client'] = facture.reference_client;

          const intent = await stripe.paymentIntents.create({
            amount,
            currency: "eur",
            description: `Facture ${facture.numero}`,
            automatic_payment_methods: { enabled: true },
            ...(facture.client_email && { receipt_email: facture.client_email }),
            metadata,
          });

          await supabaseAdmin
            .from("factures")
            .update({ stripe_payment_intent_id: intent.id })
            .eq("id", facture.id);

          return Response.json({ clientSecret: intent.client_secret, summary });
        } catch (e: any) {
          console.error("[facture/payment-intent] Stripe error", e?.message);
          return Response.json({ error: "Paiement indisponible — réessayez" }, { status: 500 });
        }
      },
    },
  },
});
