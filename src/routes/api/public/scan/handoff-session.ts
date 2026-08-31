/**
 * POST /api/public/scan/handoff-session
 *
 * Canal de pairage "Scanner depuis mon téléphone" — utilisable aussi bien par
 * un visiteur non connecté (formulaire de devis public) que par un admin.
 *
 * Actions :
 *  - create      : crée la session (token + code court à 6 caractères, 30 min)
 *  - poll        : le PC interroge sa session via SON token → statut + extractions
 *  - resolve     : le mobile échange un code court saisi à la main contre le token
 *  - status      : le mobile signale "document reçu, extraction en cours"
 *  - close       : fermeture explicite (bouton Terminer)
 *
 * Sécurité : le token (48 caractères aléatoires, présent uniquement dans le QR
 * et dans la mémoire du navigateur PC) est le seul secret. Sans token valide et
 * non expiré, aucune lecture ni aucune écriture n'est possible.
 */
import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const SESSION_TTL_MIN = 30;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomCode() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

export const Route = createFileRoute("/api/public/scan/handoff-session")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => null)) as {
            action?: string;
            token?: string;
            code?: string;
            context?: string;
            status?: string;
          } | null;

          const action = body?.action;
          if (!action) return json({ ok: false, error: "Action manquante" }, 400);

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          /* ── create ─────────────────────────────────────────────────── */
          if (action === "create") {
            const context = ["admin_mission", "client_reservation", "pro_demande"].includes(
              body?.context ?? "",
            )
              ? (body!.context as string)
              : "client_reservation";

            // Purge des sessions périmées (housekeeping léger).
            await supabaseAdmin
              .from("scan_handoff_sessions")
              .delete()
              .lt("expires_at", new Date(Date.now() - 2 * 3600_000).toISOString());

            const expiresAt = new Date(Date.now() + SESSION_TTL_MIN * 60_000).toISOString();
            let lastError: string | null = null;

            for (let attempt = 0; attempt < 5; attempt++) {
              const token = randomToken();
              const shortCode = randomCode();
              const { data, error } = await supabaseAdmin
                .from("scan_handoff_sessions")
                .insert({
                  token,
                  short_code: shortCode,
                  context,
                  status: "pending",
                  expires_at: expiresAt,
                })
                .select("id, token, short_code, expires_at")
                .single();
              if (!error && data) {
                return json({ ok: true, session: data });
              }
              lastError = error?.message ?? "Insertion impossible";
            }
            console.error("[handoff-session] create failed", lastError);
            return json({ ok: false, error: "Session non créée" }, 500);
          }

          /* ── resolve (code court saisi sur le mobile) ───────────────── */
          if (action === "resolve") {
            const code = (body?.code ?? "").trim().toUpperCase();
            if (!/^[A-Z0-9]{6}$/.test(code)) {
              return json({ ok: false, error: "Code invalide" }, 400);
            }
            const { data, error } = await supabaseAdmin
              .from("scan_handoff_sessions")
              .select("token, expires_at")
              .eq("short_code", code)
              .gt("expires_at", new Date().toISOString())
              .maybeSingle();
            if (error) {
              console.error("[handoff-session] resolve", error);
              return json({ ok: false, error: "Erreur serveur" }, 500);
            }
            if (!data) return json({ ok: false, error: "Code inconnu ou expiré" }, 404);
            return json({ ok: true, token: data.token });
          }

          /* ── les actions suivantes exigent un token ─────────────────── */
          const token = body?.token;
          if (!token || token.length < 16) {
            return json({ ok: false, error: "Token manquant" }, 400);
          }

          const { data: session, error: sErr } = await supabaseAdmin
            .from("scan_handoff_sessions")
            .select("id, status, expires_at, context")
            .eq("token", token)
            .maybeSingle();

          if (sErr) {
            console.error("[handoff-session] lookup", sErr);
            return json({ ok: false, error: "Erreur serveur" }, 500);
          }
          if (!session) return json({ ok: false, error: "Session inconnue" }, 404);
          if (new Date(session.expires_at).getTime() <= Date.now()) {
            return json({ ok: false, error: "Session expirée", expired: true }, 410);
          }

          if (action === "close") {
            await supabaseAdmin.from("scan_handoff_sessions").delete().eq("id", session.id);
            return json({ ok: true });
          }

          if (action === "status") {
            const next = body?.status === "scanning" ? "scanning" : "pending";
            await supabaseAdmin
              .from("scan_handoff_sessions")
              .update({ status: next })
              .eq("id", session.id);
            return json({ ok: true });
          }

          if (action === "poll") {
            const { data: rows } = await supabaseAdmin
              .from("scan_handoff_extractions")
              .select("id, extraction, created_at")
              .eq("session_id", session.id)
              .order("created_at", { ascending: true });
            return json({
              ok: true,
              status: session.status,
              expires_at: session.expires_at,
              extractions: rows ?? [],
            });
          }

          return json({ ok: false, error: "Action inconnue" }, 400);
        } catch (err) {
          console.error("[handoff-session] unexpected", err);
          return json({ ok: false, error: "Erreur interne" }, 500);
        }
      },
    },
  },
});
