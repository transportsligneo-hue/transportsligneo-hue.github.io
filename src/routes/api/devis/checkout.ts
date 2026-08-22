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

export const Route = createFileRoute("/api/devis/checkout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: any;
        try { body = await request.json(); } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const { devisId, returnUrl, environment } = body ?? {};
        if (!devisId || !UUID_RE.test(String(devisId))) {
          return Response.json({ error: "Invalid devisId" }, { status: 400 });
        }
        if (!returnUrl || typeof returnUrl !== "string") {
          return Response.json({ error: "Missing returnUrl" }, { status: 400 });
        }
        const requestOrigin = new URL(request.url).origin;
        if (!isAllowedReturnUrl(returnUrl, requestOrigin)) {
          return Response.json({ error: "Invalid returnUrl" }, { status: 400 });
        }
        const env: StripeEnv = environment === "live" ? "live" : "sandbox";

        const { data: devis, error } = await supabaseAdmin
          .from("devis")
          .select("id, numero, depart, arrivee, prix_estime, avoir_applique, statut, email, nom, prenom, stripe_session_id, paid_at")
          .eq("id", devisId)
          .maybeSingle();
        if (error || !devis) {
          return Response.json({ error: "Devis introuvable" }, { status: 404 });
        }
        if (devis.paid_at) {
          return Response.json({ error: "Devis déjà payé" }, { status: 409 });
        }
        // Le devis doit avoir été validé par l'admin avant paiement
        if (!["accepte", "envoye"].includes(String(devis.statut))) {
          return Response.json({ error: "Devis non payable" }, { status: 409 });
        }
        // Compte Kilomètres : l'avoir déjà appliqué est déduit du montant à régler.
        const avoir = Number((devis as { avoir_applique?: number }).avoir_applique ?? 0);
        const ttc = Math.max(Number(devis.prix_estime) - avoir, 0);
        if (!ttc || ttc < 1) {
          return Response.json({ error: "Montant invalide" }, { status: 400 });
        }

        try {
          const stripe = createStripeClient(env);

          // Un avoir appliqué change le montant : on ne réutilise pas l'ancienne session.
          if (devis.stripe_session_id && avoir <= 0) {
            try {
              const existing = await stripe.checkout.sessions.retrieve(devis.stripe_session_id);
              if (existing.status === "open" && existing.client_secret) {
                return Response.json({ clientSecret: existing.client_secret });
              }
            } catch { /* recreate */ }
          }

          const session = await stripe.checkout.sessions.create({
            line_items: [{
              price_data: {
                currency: "eur",
                product_data: {
                  name: `Convoyage ${devis.numero}`,
                  description: `${devis.depart} → ${devis.arrivee}${avoir > 0 ? ` — avoir fidélité déduit : ${avoir.toFixed(2)} €` : ""}`,
                },
                unit_amount: Math.round(ttc * 100),
              },
              quantity: 1,
            }],
            mode: "payment",
            ui_mode: "embedded",
            payment_method_types: ["card"],
            return_url: returnUrl,
            ...(devis.email && { customer_email: devis.email }),
            metadata: {
              devis_id: devis.id,
              devis_numero: devis.numero,
            },
            payment_intent_data: {
              metadata: {
                devis_id: devis.id,
                devis_numero: devis.numero,
              },
            },
          });

          await supabaseAdmin
            .from("devis")
            .update({ stripe_session_id: session.id })
            .eq("id", devis.id);

          return Response.json({ clientSecret: session.client_secret });
        } catch (e: any) {
          console.error("[devis/checkout] Stripe error", e?.message);
          return Response.json({ error: "Checkout failed — please try again" }, { status: 500 });
        }
      },
    },
  },
});
