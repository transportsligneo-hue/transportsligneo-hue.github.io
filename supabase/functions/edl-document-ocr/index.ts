/**
 * edl-document-ocr — OCR + classification pour documents EDL (PV livraison, carte grise).
 *
 * Input: { storage_path: string, document_type: "pv_livraison" | "carte_grise" }
 * Lit l'image depuis le bucket inspection-photos via signed URL,
 * envoie à Lovable AI (Gemini Vision) pour OCR + extraction structurée.
 *
 * Output: {
 *   document_type, raw_text, structured: { ... },
 *   classification: "admin" | "client" | "driver"
 * }
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { storage_path, document_type } = await req.json();
    if (!storage_path || !document_type) {
      return new Response(JSON.stringify({ error: "Missing storage_path or document_type" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: signed, error: sErr } = await admin.storage
      .from("inspection-photos")
      .createSignedUrl(storage_path, 60);
    if (sErr || !signed) throw new Error(`Signed URL failed: ${sErr?.message}`);

    // Schema selon type document
    const isCG = document_type === "carte_grise";
    const tool = {
      type: "function",
      function: {
        name: "extract_document",
        description: isCG
          ? "Extract all key fields from a French vehicle registration (carte grise)."
          : "Extract all key fields from a French delivery/handover form (PV de livraison).",
        parameters: {
          type: "object",
          properties: isCG ? {
            immatriculation: { type: "string" },
            vin: { type: "string" },
            marque: { type: "string" },
            modele: { type: "string" },
            date_premiere_immatriculation: { type: "string" },
            puissance_fiscale: { type: "string" },
            energie: { type: "string" },
            titulaire_nom: { type: "string" },
            titulaire_adresse: { type: "string" },
            raw_text: { type: "string" },
          } : {
            date_livraison: { type: "string" },
            lieu_livraison: { type: "string" },
            client_nom: { type: "string" },
            immatriculation: { type: "string" },
            kilometrage: { type: "string" },
            etat_general: { type: "string" },
            observations: { type: "string" },
            raw_text: { type: "string" },
          },
          required: ["raw_text"],
        },
      },
    };

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "Tu es un OCR expert pour documents véhicules français. Extrais les champs avec précision. Si un champ est illisible, mets une chaîne vide.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: `Extrait les informations de ce ${isCG ? "document carte grise" : "PV de livraison"}.` },
              { type: "image_url", image_url: { url: signed.signedUrl } },
            ],
          },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "extract_document" } },
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI gateway error", aiRes.status, t);
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit, réessayez dans un instant" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits AI épuisés" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway: ${aiRes.status}`);
    }

    const aiData = await aiRes.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let structured: Record<string, unknown> = {};
    try {
      structured = toolCall?.function?.arguments
        ? JSON.parse(toolCall.function.arguments)
        : {};
    } catch (e) {
      console.error("Parse error", e);
    }

    const classification = isCG ? "admin" : "client";

    return new Response(JSON.stringify({
      document_type,
      classification,
      structured,
      raw_text: structured.raw_text ?? "",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("edl-document-ocr error:", err);
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : "Unknown error",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
