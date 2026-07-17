/**
 * scan-document.functions.ts
 *
 * Server function : extraction OCR + classification pour tout document auto
 * français scanné dans TRANSPORTS LIGNEO (carte grise, CPI, bon de commande,
 * bon de livraison, PV livraison/restitution, mandat, facture, devis,
 * document constructeur).
 *
 * Utilise Lovable AI Gateway (Gemini 2.5 Flash Vision) avec tool-calling
 * strict pour obtenir un objet structuré normalisé (ExtractedFields).
 *
 * SÉCURITÉ :
 *  - Requiert un bearer token Supabase valide (utilisateur connecté).
 *  - La clé LOVABLE_API_KEY reste côté serveur.
 *  - Rate limit best-effort via header (pas de store persistant).
 *
 * L'appelant transmet le fichier en base64 (data URL). Le serveur ne stocke
 * rien — c'est au front d'uploader dans le bucket approprié si besoin.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { DocumentType, ExtractionResult } from "./types";

const InputSchema = z.object({
  /** Data URL base64 : `data:image/jpeg;base64,...` */
  image_data_url: z.string().min(100).max(15_000_000),
  /** Hint optionnel : si l'utilisateur choisit un type de doc, on le passe au modèle. */
  hint_type: z.string().optional(),
});

type Result =
  | { ok: true; extraction: ExtractionResult }
  | { ok: false; error: string };

const SYSTEM_PROMPT = `Tu es un OCR expert spécialisé dans les documents automobiles français.
Analyse l'image fournie et détermine son type parmi :
- carte_grise, cpi, bon_commande, bon_livraison, pv_livraison, pv_restitution,
  mandat, facture, devis, document_constructeur, inconnu.

Extrait ensuite TOUS les champs pertinents en respectant strictement le schéma
demandé. Si un champ est illisible ou absent, laisse-le vide (chaîne vide).
Ne devine JAMAIS un VIN ou une immatriculation : mieux vaut vide qu'inventé.

Pour l'immatriculation FR : format "AA-123-AA" (majuscules, avec tirets).
Pour le VIN : 17 caractères alphanumériques (sans I, O, Q).
Pour les dates : format "JJ/MM/AAAA" français.
Pour raw_text : recopie fidèlement tout le texte visible sur le document.`;

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
          description: "Type détecté du document.",
        },
        confidence: {
          type: "number",
          description: "Confiance globale de la classification et de l'extraction, entre 0 et 1.",
        },
        // Véhicule
        vin: { type: "string", description: "Numéro VIN (17 caractères)." },
        immatriculation: { type: "string", description: "Plaque FR format AA-123-AA." },
        marque: { type: "string" },
        modele: { type: "string" },
        version: { type: "string" },
        energie: { type: "string" },
        puissance: { type: "string" },
        couleur: { type: "string" },
        date_mec: { type: "string", description: "Date de première mise en circulation JJ/MM/AAAA." },
        kilometrage: { type: "string", description: "Kilométrage relevé, chiffres uniquement." },
        // Titulaire / client
        titulaire_nom: { type: "string" },
        titulaire_adresse: { type: "string" },
        client_nom: { type: "string" },
        client_email: { type: "string" },
        client_telephone: { type: "string" },
        // Contexte pro
        concession: { type: "string" },
        garage: { type: "string" },
        numero_commande: { type: "string" },
        numero_dossier: { type: "string" },
        numero_facture: { type: "string" },
        // Livraison
        lieu_depart: { type: "string" },
        lieu_arrivee: { type: "string" },
        date_livraison: { type: "string", description: "JJ/MM/AAAA." },
        observations: { type: "string" },
        // Warnings + texte brut
        warnings: {
          type: "array",
          items: { type: "string" },
          description: "Anomalies détectées : flou, coupure, illisibilité partielle, etc.",
        },
        raw_text: {
          type: "string",
          description: "Texte brut OCR du document, aussi complet que possible.",
        },
      },
      required: ["document_type", "confidence", "raw_text"],
    },
  },
};

export const scanDocumentExtract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const parsed = InputSchema.safeParse(input);
    if (!parsed.success) {
      return { __ok: false as const, error: "Requête invalide" };
    }
    return { __ok: true as const, ...parsed.data };
  })
  .handler(async ({ data }): Promise<Result> => {
    try {
      if (!data.__ok) return { ok: false, error: data.error };

      // Auth : bearer token Supabase validé par le middleware requireSupabaseAuth.
      // Toute requête sans token valide est rejetée en amont (401).

      const apiKey = process.env.LOVABLE_API_KEY;
      if (!apiKey) {
        console.error("[scan-document] LOVABLE_API_KEY missing");
        return { ok: false, error: "Service OCR non configuré" };
      }

      const hint = data.hint_type
        ? `\n\nHint (peut être erroné, à vérifier) : le document est probablement de type "${data.hint_type}".`
        : "";

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: SYSTEM_PROMPT + hint },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Classifie ce document et extrais toutes les informations utiles pour créer une mission de convoyage.",
                },
                { type: "image_url", image_url: { url: data.image_data_url } },
              ],
            },
          ],
          tools: [EXTRACTION_TOOL],
          tool_choice: { type: "function", function: { name: "extract_auto_document" } },
        }),
      });

      if (!aiRes.ok) {
        const txt = await aiRes.text().catch(() => "");
        console.error("[scan-document] AI error", aiRes.status, txt.slice(0, 500));
        if (aiRes.status === 429) return { ok: false, error: "Trop de scans, patientez quelques secondes." };
        if (aiRes.status === 402) return { ok: false, error: "Crédits IA épuisés — contactez l'administrateur." };
        return { ok: false, error: `Erreur OCR (${aiRes.status})` };
      }

      const json = await aiRes.json();
      const toolCall = json?.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) {
        console.error("[scan-document] no tool_call in response", JSON.stringify(json).slice(0, 500));
        return { ok: false, error: "Extraction impossible sur ce document" };
      }

      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.error("[scan-document] parse error", e);
        return { ok: false, error: "Réponse OCR malformée" };
      }

      const documentType = (parsed.document_type as DocumentType) ?? "inconnu";
      const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0.5;

      const fieldKeys = [
        "vin", "immatriculation", "marque", "modele", "version",
        "energie", "puissance", "couleur", "date_mec", "kilometrage",
        "titulaire_nom", "titulaire_adresse",
        "client_nom", "client_email", "client_telephone",
        "concession", "garage",
        "numero_commande", "numero_dossier", "numero_facture",
        "lieu_depart", "lieu_arrivee", "date_livraison", "observations",
      ] as const;

      const fields: Record<string, string> = {};
      for (const k of fieldKeys) {
        const v = parsed[k];
        if (typeof v === "string" && v.trim()) fields[k] = v.trim();
      }

      const warnings = Array.isArray(parsed.warnings)
        ? (parsed.warnings as unknown[]).filter((w): w is string => typeof w === "string")
        : [];

      return {
        ok: true,
        extraction: {
          document_type: documentType,
          confidence,
          fields,
          raw_text: (parsed.raw_text as string) ?? "",
          warnings,
        },
      };
    } catch (err) {
      console.error("[scan-document] unexpected", err);
      return { ok: false, error: "Erreur interne" };
    }
  });
