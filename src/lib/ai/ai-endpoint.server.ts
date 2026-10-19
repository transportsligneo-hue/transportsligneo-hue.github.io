/**
 * Choix du fournisseur IA côté serveur.
 * - GEMINI_API_KEY défini → API Google Gemini (compatible OpenAI), utilisable hors Lovable (Vercel).
 * - sinon LOVABLE_API_KEY → passerelle IA Lovable (comportement historique).
 */
export type AiEndpoint = { url: string; headers: Record<string, string>; model: (m: string) => string };

export function resolveAiEndpoint(): AiEndpoint | null {
  const gemini = process.env.GEMINI_API_KEY;
  if (gemini) {
    return {
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${gemini}`, "x-goog-api-key": gemini },
      model: (m) => m.replace(/^google\//, "").replace(/^gemini-3[^ ]*/, "gemini-2.5-flash"),
    };
  }
  const lovable = process.env.LOVABLE_API_KEY;
  if (lovable) {
    return {
      url: "https://ai.gateway.lovable.dev/v1/chat/completions",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovable}` },
      model: (m) => m,
    };
  }
  return null;
}
