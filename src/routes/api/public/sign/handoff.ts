/**
 * /api/public/sign/handoff · signature d'un document depuis le téléphone.
 *
 * Deux actions, protégées par un lien secret (token 48 hex, usage unique,
 * 15 minutes de validité) :
 *   - `resolve` : le téléphone récupère le document et l'emplacement à signer.
 *   - `submit`  : le téléphone renvoie la signature (PNG data URL) + position GPS.
 *
 * Le token ne donne accès à AUCUNE autre donnée que le libellé du document
 * concerné, et une session ne peut être signée qu'une seule fois : une
 * signature ne peut donc jamais atterrir sur un autre document.
 */
import { createFileRoute } from "@tanstack/react-router";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const MAX_SIGNATURE_CHARS = 900_000; // ~650 Ko de PNG en base64

export const Route = createFileRoute("/api/public/sign/handoff")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: Record<string, unknown>;
        try {
          payload = (await request.json()) as Record<string, unknown>;
        } catch {
          return json({ ok: false, error: "Requête invalide" }, 400);
        }

        const action = String(payload.action ?? "");
        const token = String(payload.token ?? "");
        if (!/^[a-f0-9]{16,96}$/i.test(token)) return json({ ok: false, error: "Lien invalide" }, 400);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: session, error } = await supabaseAdmin
          .from("signature_handoff_sessions")
          .select("id, doc_type, slot, doc_label, signer_name, status, expires_at")
          .eq("token", token)
          .maybeSingle();

        if (error || !session) return json({ ok: false, error: "Lien inconnu ou expiré" }, 404);
        if (new Date(session.expires_at).getTime() < Date.now())
          return json({ ok: false, error: "Ce lien a expiré. Relancez la signature depuis l'ordinateur." }, 410);
        if (session.status === "signed")
          return json({ ok: false, error: "Ce document a déjà été signé." }, 409);

        if (action === "resolve") {
          return json({
            ok: true,
            doc_type: session.doc_type,
            slot: session.slot,
            doc_label: session.doc_label,
            signer_name: session.signer_name,
          });
        }

        if (action === "submit") {
          const signature = String(payload.signature_data ?? "");
          if (!signature.startsWith("data:image/png;base64,"))
            return json({ ok: false, error: "Signature illisible" }, 400);
          if (signature.length > MAX_SIGNATURE_CHARS)
            return json({ ok: false, error: "Signature trop volumineuse" }, 413);

          const lat = typeof payload.latitude === "number" ? payload.latitude : null;
          const lng = typeof payload.longitude === "number" ? payload.longitude : null;
          const signer = typeof payload.signer_name === "string" ? payload.signer_name.slice(0, 120) : null;

          const { error: upErr } = await supabaseAdmin
            .from("signature_handoff_sessions")
            .update({
              status: "signed",
              signature_data: signature,
              latitude: lat,
              longitude: lng,
              signer_name: signer || session.signer_name,
              signed_at: new Date().toISOString(),
            })
            .eq("id", session.id)
            .eq("status", "pending");

          if (upErr) return json({ ok: false, error: "Enregistrement impossible" }, 500);
          return json({ ok: true });
        }

        return json({ ok: false, error: "Action inconnue" }, 400);
      },
    },
  },
});
