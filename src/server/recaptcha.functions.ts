import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  token: z.string().min(10).max(4000),
  action: z.string().min(1).max(64),
  minScore: z.number().min(0).max(1).optional(),
});

/**
 * Vérifie un token reCAPTCHA v3 côté serveur.
 * Le secret est stocké dans RECAPTCHA_SECRET_KEY.
 */
export const verifyRecaptcha = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const secret = process.env.RECAPTCHA_SECRET_KEY;
    if (!secret) {
      console.warn("[recaptcha] RECAPTCHA_SECRET_KEY missing");
      return { ok: true, skipped: true, score: null as number | null };
    }

    try {
      const body = new URLSearchParams({ secret, response: data.token });
      const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const json = (await res.json()) as {
        success: boolean;
        score?: number;
        action?: string;
        "error-codes"?: string[];
      };

      const minScore = data.minScore ?? 0.5;
      const ok =
        json.success &&
        (json.score ?? 1) >= minScore &&
        (!json.action || json.action === data.action);

      return {
        ok,
        skipped: false,
        score: json.score ?? null,
        errors: json["error-codes"] ?? [],
      };
    } catch (err) {
      console.error("[recaptcha] verify failed", err);
      return { ok: false, skipped: false, score: null, errors: ["network"] };
    }
  });
