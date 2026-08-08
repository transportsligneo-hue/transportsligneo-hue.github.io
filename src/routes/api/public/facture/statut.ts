import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Statut minimal d'une facture, interrogé par la page de confirmation.
// La clé d'accès est l'identifiant d'intention de paiement Stripe (non devinable).
export const Route = createFileRoute("/api/public/facture/statut")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const pi = new URL(request.url).searchParams.get("pi");
        if (!pi || !/^pi_[A-Za-z0-9_]{6,}$/.test(pi)) {
          return Response.json({ error: "Paramètre invalide" }, { status: 400 });
        }
        const { data } = await supabaseAdmin
          .from("factures")
          .select("numero, prix_ttc, statut, paid_at, depart, arrivee, designation, client_email")
          .eq("stripe_payment_intent_id", pi)
          .maybeSingle();

        if (!data) return Response.json({ error: "Introuvable" }, { status: 404 });

        return Response.json({
          numero: data.numero,
          montant: Number(data.prix_ttc),
          paid: Boolean(data.paid_at) || data.statut === "payee",
          trajet: data.depart && data.arrivee ? `${data.depart} → ${data.arrivee}` : (data.designation ?? null),
          email: data.client_email ?? null,
        });
      },
    },
  },
});
