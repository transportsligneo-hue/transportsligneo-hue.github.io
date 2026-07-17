/**
 * POST /api/public/scan/handoff-extract
 *
 * Route publique appelée par la page mobile /scan/$token :
 *  1. Valide le token via RPC `resolve_scan_handoff_token` (RLS-safe, publique).
 *  2. Appelle Lovable AI Gateway (Gemini 2.5 Flash Vision) pour extraire les
 *     champs du document.
 *  3. Écrit le résultat via RPC `push_scan_handoff_extraction` (rate limit
 *     et validation TTL côté SQL).
 *
 * Sécurité : aucun bearer requis, mais aucun accès en lecture n'est offert —
 * la page mobile ne peut qu'écrire, et uniquement pour le token qu'elle
 * détient. La lecture se fait côté PC via Realtime + RLS `created_by = uid`.
 */
import { createFileRoute } from "@tanstack/react-router";
import type { DocumentType, ExtractionResult } from "@/lib/scanner/types";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const SYSTEM_PROMPT = `Tu es un OCR expert spécialisé dans les documents automobiles français.
Analyse l'image fournie et détermine son type parmi :
- carte_grise, cpi, bon_commande, bon_livraison, pv_livraison, pv_restitution,
  mandat, facture, devis, document_constructeur, inconnu.
Extrais tous les champs pertinents. Si un champ est illisible, laisse-le vide.
Ne devine JAMAIS un VIN ou une immatriculation.`;

const EXTRACTION_TOOL = {
  type: "function" as const,
  function: {
    name: "extract_auto_document",
    description: "Classifie et extrait tous les champs d'un document automobile français.",
    parameters: {
      type: "object",
      properties: {
        document_type: {
          type: "string",
          enum: [
            "carte_grise", "cpi", "bon_commande", "bon_livraison",
            "pv_livraison", "pv_restitution", "mandat", "facture",
            "devis", "document_constructeur", "inconnu",
          ],
        },
        confidence: { type: "number" },
        vin: { type: "string" }, immatriculation: { type: "string" },
        marque: { type: "string" }, modele: { type: "string" }, version: { type: "string" },
        energie: { type: "string" }, puissance: { type: "string" }, couleur: { type: "string" },
        date_mec: { type: "string" }, kilometrage: { type: "string" },
        titulaire_nom: { type: "string" }, titulaire_adresse: { type: "string" },
        client_nom: { type: "string" }, client_email: { type: "string" }, client_telephone: { type: "string" },
        concession: { type: "string" }, garage: { type: "string" },
        numero_commande: { type: "string" }, numero_dossier: { type: "string" }, numero_facture: { type: "string" },
        lieu_depart: { type: "string" }, lieu_arrivee: { type: "string" },
        date_livraison: { type: "string" }, observations: { type: "string" },
        warnings: { type: "array", items: { type: "string" } },
        raw_text: { type: "string" },
      },
      required: ["document_type", "confidence", "raw_text"],
    },
  },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}


export const Route = createFileRoute("/api/public/scan/handoff-extract")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        try {
          const body = await request.json().catch(() => null) as {
            token?: string; image_data_url?: string;
          } | null;
          if (!body?.token || !body?.image_data_url) {
            return jsonResponse({ ok: false, error: "Requête invalide" }, 400);
          }
          if (body.image_data_url.length > 15_000_000) {
            return jsonResponse({ ok: false, error: "Image trop grande" }, 413);
          }

          // Les RPC handoff sont SECURITY DEFINER mais NON exposées à anon.
          // On les appelle avec le client admin (service role) pour éviter
          // l'exposition publique tout en conservant leur logique TTL/rate-limit.
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // 1. Valider le token
          const { data: sess, error: sErr } = await supabaseAdmin.rpc("resolve_scan_handoff_token", {
            _token: body.token,
          });
          if (sErr) {
            console.error("[handoff-extract] resolve error", sErr);
            return jsonResponse({ ok: false, error: "Token invalide" }, 401);
          }
          const row = Array.isArray(sess) ? sess[0] : sess;
          if (!row) return jsonResponse({ ok: false, error: "Session expirée" }, 410);

          // 2. AI Gateway
          const apiKey = process.env.LOVABLE_API_KEY;
          if (!apiKey) {
            console.error("[handoff-extract] LOVABLE_API_KEY missing");
            return jsonResponse({ ok: false, error: "Service OCR non configuré" }, 500);
          }

          const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                {
                  role: "user",
                  content: [
                    { type: "text", text: "Classifie ce document et extrais tous les champs utiles." },
                    { type: "image_url", image_url: { url: body.image_data_url } },
                  ],
                },
              ],
              tools: [EXTRACTION_TOOL],
              tool_choice: { type: "function", function: { name: "extract_auto_document" } },
            }),
          });

          if (!aiRes.ok) {
            const t = await aiRes.text().catch(() => "");
            console.error("[handoff-extract] AI", aiRes.status, t.slice(0, 300));
            if (aiRes.status === 429) return jsonResponse({ ok: false, error: "Trop de scans, patientez." }, 429);
            if (aiRes.status === 402) return jsonResponse({ ok: false, error: "Crédits IA épuisés." }, 402);
            return jsonResponse({ ok: false, error: `Erreur OCR (${aiRes.status})` }, 502);
          }

          const json = await aiRes.json();
          const toolCall = json?.choices?.[0]?.message?.tool_calls?.[0];
          if (!toolCall?.function?.arguments) {
            return jsonResponse({ ok: false, error: "Extraction impossible" }, 422);
          }

          let parsed: Record<string, unknown> = {};
          try { parsed = JSON.parse(toolCall.function.arguments); } catch {
            return jsonResponse({ ok: false, error: "Réponse OCR malformée" }, 502);
          }

          const documentType = (parsed.document_type as DocumentType) ?? "inconnu";
          const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0.5;
          const fieldKeys = [
            "vin","immatriculation","marque","modele","version","energie","puissance","couleur",
            "date_mec","kilometrage","titulaire_nom","titulaire_adresse",
            "client_nom","client_email","client_telephone","concession","garage",
            "numero_commande","numero_dossier","numero_facture",
            "lieu_depart","lieu_arrivee","date_livraison","observations",
          ] as const;
          const fields: Record<string, string> = {};
          for (const k of fieldKeys) {
            const v = parsed[k];
            if (typeof v === "string" && v.trim()) fields[k] = v.trim();
          }
          const warnings = Array.isArray(parsed.warnings)
            ? (parsed.warnings as unknown[]).filter((w): w is string => typeof w === "string")
            : [];

          const extraction: ExtractionResult = {
            document_type: documentType,
            confidence,
            fields,
            raw_text: (parsed.raw_text as string) ?? "",
            warnings,
          };

          // 3. Push vers la DB (rate limit + TTL SQL-side)
          const { error: pErr } = await supabaseAdmin.rpc("push_scan_handoff_extraction", {
            _token: body.token,
            _extraction: extraction as never,
          });
          if (pErr) {
            console.error("[handoff-extract] push error", pErr);
            return jsonResponse({ ok: false, error: pErr.message }, 400);
          }

          return jsonResponse({ ok: true, extraction });
        } catch (err) {
          console.error("[handoff-extract] unexpected", err);
          return jsonResponse({ ok: false, error: "Erreur interne" }, 500);
        }
      },
    },
  },
});
