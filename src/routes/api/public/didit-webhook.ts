import { createFileRoute } from "@tanstack/react-router";

// Webhook Didit : met à jour le statut de la vérification d'identité (signature HMAC-SHA256 du corps brut).
export const Route = createFileRoute("/api/public/didit-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["DIDIT_WEBHOOK_SECRET"];
        if (!secret) return new Response("Not configured", { status: 500 });
        const raw = await request.text();
        const ts = Number(request.headers.get("x-timestamp") ?? 0);
        if (!ts || Math.abs(Date.now() / 1000 - ts) > 300) return new Response("Stale", { status: 401 });
        let p: any;
        try { p = JSON.parse(raw); } catch { return new Response("Bad JSON", { status: 400 }); }

        const hmac = async (msg: string) => {
          const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
          return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg))), (b) => b.toString(16).padStart(2, "0")).join("");
        };
        const canon = (v: any): any => Array.isArray(v) ? v.map(canon)
          : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v;
        const eq = (a: string, b: string) => { if (!a || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
        const h = (n: string) => (request.headers.get(n) ?? "").toLowerCase();
        const v2 = await hmac(JSON.stringify(canon(p)));
        const okSig = eq(v2, h("x-signature-v2")) || eq(await hmac(raw), h("x-signature"));
        if (!okSig) return new Response("Invalid signature", { status: 401 });

        const sessionId = String(p.session_id ?? "");
        if (!sessionId) return new Response("ok");
        const MAP: Record<string, string> = { Approved: "approved", Declined: "declined", "In Review": "review", Abandoned: "abandoned", Expired: "abandoned" };
        const status = MAP[String(p.status ?? "")] ?? "pending";
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await (supabaseAdmin as any).from("id_verifications")
          .update({ status, detail: p.decision ?? null, updated_at: new Date().toISOString() }).eq("session_id", sessionId);
        return new Response("ok");
      },
    },
  },
});
