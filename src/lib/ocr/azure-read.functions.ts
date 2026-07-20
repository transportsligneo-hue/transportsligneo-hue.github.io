/**
 * azure-read.functions.ts · OCR fiable via Azure AI Vision Read API v3.2.
 *
 * Server function TanStack : la clé Azure reste sur le serveur, jamais dans
 * le bundle client. Retourne les lignes de texte détectées + un texte concaténé.
 *
 * Configuration :
 *   - AZURE_VISION_ENDPOINT  ex. https://<resource>.cognitiveservices.azure.com
 *   - AZURE_VISION_KEY       clé Ocp-Apim-Subscription-Key
 *
 * Tant que ces variables ne sont pas définies, la fonction renvoie
 * { ok:false, error:"azure_not_configured" } — le code appelant tombe
 * automatiquement sur le pipeline Gemini existant (aucune régression).
 *
 * Palier gratuit : F0 = 5000 lectures/mois.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  image_data_url: z.string().min(100).max(15_000_000),
});

export interface AzureLine {
  text: string;
  confidence?: number;
  bbox?: number[];
}

export type AzureReadResult =
  | { ok: true; text: string; lines: AzureLine[] }
  | { ok: false; error: string };

function dataUrlToBytes(dataUrl: string): Uint8Array | null {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  try {
    const bin = atob(m[2]);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  } catch {
    return null;
  }
}

async function pollAzureResult(operationLoc: string, key: string): Promise<AzureReadResult> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 700));
    const r = await fetch(operationLoc, { headers: { "Ocp-Apim-Subscription-Key": key } });
    if (!r.ok) return { ok: false, error: `azure_poll_${r.status}` };
    const json = (await r.json()) as {
      status?: string;
      analyzeResult?: { readResults?: Array<{ lines?: Array<{ text?: string; boundingBox?: number[]; confidence?: number }> }> };
    };
    if (json.status === "succeeded") {
      const lines: AzureLine[] = [];
      for (const page of json.analyzeResult?.readResults ?? []) {
        for (const l of page.lines ?? []) {
          if (typeof l.text === "string" && l.text.trim()) {
            lines.push({ text: l.text.trim(), confidence: l.confidence, bbox: l.boundingBox });
          }
        }
      }
      return { ok: true, lines, text: lines.map((l) => l.text).join("\n") };
    }
    if (json.status === "failed") return { ok: false, error: "azure_analysis_failed" };
  }
  return { ok: false, error: "azure_timeout" };
}

export const azureReadOcr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const parsed = InputSchema.safeParse(input);
    if (!parsed.success) return { __ok: false as const, error: "invalid_input" };
    return { __ok: true as const, ...parsed.data };
  })
  .handler(async ({ data }): Promise<AzureReadResult> => {
    if (!data.__ok) return { ok: false, error: data.error };

    const endpoint = process.env.AZURE_VISION_ENDPOINT?.replace(/\/+$/, "");
    const key = process.env.AZURE_VISION_KEY;
    if (!endpoint || !key) {
      // Stub explicite tant qu'Azure n'est pas configuré.
      return { ok: false, error: "azure_not_configured" };
    }

    const bytes = dataUrlToBytes(data.image_data_url);
    if (!bytes) return { ok: false, error: "invalid_data_url" };

    try {
      const analyzeUrl = `${endpoint}/vision/v3.2/read/analyze?language=fr`;
      const submit = await fetch(analyzeUrl, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": key,
          "Content-Type": "application/octet-stream",
        },
        body: new Blob([bytes as BlobPart], { type: "application/octet-stream" }),
      });
      if (!submit.ok) {
        const t = await submit.text().catch(() => "");
        console.error("[azure-read] submit error", submit.status, t.slice(0, 200));
        return { ok: false, error: `azure_submit_${submit.status}` };
      }
      const operationLoc = submit.headers.get("operation-location");
      if (!operationLoc) return { ok: false, error: "azure_no_operation_location" };

      return await pollAzureResult(operationLoc, key);
    } catch (err) {
      console.error("[azure-read] unexpected", err);
      return { ok: false, error: "azure_exception" };
    }
  });
