import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Démarre une vérification d'identité Didit (CNI / passeport + selfie) pour le convoyeur connecté. */
export const startIdVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { origin: string }) => d)
  .handler(async ({ data, context }) => {
    ;(await import("@/lib/demo-block.server")).assertNotDemo((context as { claims?: unknown }).claims);
    const key = process.env["DIDIT_API_KEY"];
    const wf = process.env["DIDIT_WORKFLOW_ID"];
    if (!key || !wf) throw new Error("La vérification d'identité n'est pas encore activée.");
    const origin = /^https:\/\/([a-z0-9-]+\.)*transportsligneo\.fr$/.test(data.origin) || data.origin.startsWith("http://localhost")
      ? data.origin : "https://transportsligneo.fr";
    const res = await fetch("https://verification.didit.me/v3/session/", {
      method: "POST",
      headers: { "x-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ workflow_id: wf, vendor_data: context.userId, callback: `${origin}/convoyeur/documents?idv=done` }),
    });
    if (!res.ok) {
      console.error("Didit", res.status, await res.text());
      throw new Error("Service de vérification indisponible, réessayez dans un instant.");
    }
    const j = (await res.json()) as { url: string; session_id: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any).from("id_verifications").insert({ user_id: context.userId, session_id: j.session_id, status: "pending" });
    return { url: j.url };
  });

/** Dernier statut de vérification du convoyeur connecté. */
export const getIdVerificationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await (context.supabase as any).from("id_verifications")
      .select("status, updated_at").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    return { status: (data?.status ?? "none") as string };
  });
