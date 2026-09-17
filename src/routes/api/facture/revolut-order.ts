import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createRevolutOrder, type RevolutEnv } from "@/lib/revolut-server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Crée une commande Revolut Pay pour une facture. La clé secrète Revolut
// reste strictement côté serveur ; seule l'URL de paiement est renvoyée.
export const Route = createFileRoute("/api/facture/revolut-order")({
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
        const env: RevolutEnv = environment === "live" || environment === "production"
          ? "production"
          : "sandbox";

        const { data: facture, error } = await supabaseAdmin
          .from("factures")
          .select("id, numero, client_email, client_nom, client_prenom, prix_ttc, statut, paid_at, designation")
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
        const amountCents = Math.round(ttc * 100);

        try {
          const order = await createRevolutOrder({
            env,
            amountMinor: amountCents,
            currency: "EUR",
            description: `Facture ${facture.numero}`,
            reference: facture.numero,
            email: facture.client_email,
          });

          if (!order?.checkout_url) {
            return Response.json({ error: "Revolut n'a pas renvoyé de lien de paiement" }, { status: 502 });
          }

          await supabaseAdmin.from("payment_links").insert({
            provider: "revolut",
            environment: env === "production" ? "live" : "sandbox",
            amount_cents: amountCents,
            currency: "EUR",
            description: facture.designation ?? `Facture ${facture.numero}`,
            facture_id: facture.id,
            client_email: facture.client_email,
            client_nom: facture.client_nom,
            client_prenom: facture.client_prenom,
            revolut_order_id: order.id,
            checkout_url: order.checkout_url,
            statut: "pending",
          } as never);

          return Response.json({ checkoutUrl: order.checkout_url, orderId: order.id });
        } catch (e: any) {
          console.error("[facture/revolut-order]", e?.message);
          return Response.json({ error: e?.message ?? "Revolut indisponible" }, { status: 500 });
        }
      },
    },
  },
});
