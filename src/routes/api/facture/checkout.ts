import { createFileRoute } from "@tanstack/react-router";
import { createStripeClient, type StripeEnv } from "@/lib/stripe-server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_RETURN_HOSTS = new Set<string>([
  "transportsligneo.fr",
  "www.transportsligneo.fr",
  "transportsligneo.lovable.app",
]);

function isAllowedReturnUrl(input: string, requestOrigin: string): boolean {
  try {
    const u = new URL(input);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    if (u.origin === requestOrigin) return true;
    if (ALLOWED_RETURN_HOSTS.has(u.hostname)) return true;
    if (/\.lovable\.app$/.test(u.hostname)) return true;
    return false;
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/facture/checkout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: any;
        try { body = await request.json(); } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const { factureId, returnUrl, environment } = body ?? {};
        if (!factureId || !UUID_RE.test(String(factureId))) {
          return Response.json({ error: "Invalid factureId" }, { status: 400 });
        }
        if (!returnUrl || typeof returnUrl !== "string") {
          return Response.json({ error: "Missing returnUrl" }, { status: 400 });
        }
        const requestOrigin = new URL(request.url).origin;
        if (!isAllowedReturnUrl(returnUrl, requestOrigin)) {
          return Response.json({ error: "Invalid returnUrl" }, { status: 400 });
        }
        const env: StripeEnv = environment === "live" ? "live" : "sandbox";

        const { data: facture, error } = await supabaseAdmin
          .from("factures")
          .select("id, numero, client_email, client_nom, client_prenom, client_societe, depart, arrivee, designation, prix_ttc, statut, stripe_session_id, paid_at, reference_client, reference_label")
          .eq("id", factureId)
          .maybeSingle();
        if (error || !facture) {
          return Response.json({ error: "Facture introuvable" }, { status: 404 });
        }
        if (facture.paid_at || facture.statut === "payee") {
          return Response.json({ error: "Facture déjà payée" }, { status: 409 });
        }
        if (!["emise", "en_retard"].includes(String(facture.statut))) {
          return Response.json({ error: "Facture non payable" }, { status: 409 });
        }
        const ttc = Number(facture.prix_ttc);
        if (!ttc || ttc < 1) {
          return Response.json({ error: "Montant invalide" }, { status: 400 });
        }

        try {
          const stripe = createStripeClient(env);

          if (facture.stripe_session_id) {
            try {
              const existing = await stripe.checkout.sessions.retrieve(facture.stripe_session_id);
              if (existing.status === "open" && existing.client_secret) {
                return Response.json({ clientSecret: existing.client_secret });
              }
            } catch { /* recreate */ }
          }

          const trajet = facture.depart && facture.arrivee
            ? `${facture.depart} → ${facture.arrivee}`
            : (facture.designation ?? "Prestation transport");

          const session = await stripe.checkout.sessions.create({
            line_items: [{
              price_data: {
                currency: "eur",
                product_data: {
                  name: `Facture ${facture.numero}`,
                  description: trajet,
                },
                unit_amount: Math.round(ttc * 100),
              },
              quantity: 1,
            }],
            mode: "payment",
            ui_mode: "embedded",
            payment_method_types: ["card"],
            return_url: returnUrl,
            ...(facture.client_email && { customer_email: facture.client_email }),
            metadata: {
              type: "facture_pro",
              facture_id: facture.id,
              facture_numero: facture.numero,
              ...(facture.reference_client && { reference_client: facture.reference_client }),
            },
            payment_intent_data: {
              description: `Facture ${facture.numero}`,
              metadata: {
                type: "facture_pro",
                facture_id: facture.id,
                facture_numero: facture.numero,
              },
            },
          });

          await supabaseAdmin
            .from("factures")
            .update({ stripe_session_id: session.id })
            .eq("id", facture.id);

          return Response.json({ clientSecret: session.client_secret });
        } catch (e: any) {
          console.error("[facture/checkout] Stripe error", e?.message);
          return Response.json({ error: "Checkout failed — please try again" }, { status: 500 });
        }
      },
    },
  },
});
