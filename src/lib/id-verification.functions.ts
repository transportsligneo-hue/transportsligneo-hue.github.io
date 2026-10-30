import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Row = { status: string; session_id: string | null; updated_at: string | null; created_at: string | null };

const MAP: Record<string, string> = {
  Approved: "approved", Declined: "declined", "In Review": "review",
  Abandoned: "abandoned", Expired: "abandoned", "Kyc Expired": "abandoned",
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

/** Interroge Didit pour connaître le résultat réel d'une session (filet de sécurité si le webhook n'est pas arrivé). */
async function fetchDiditStatus(sessionId: string): Promise<string | null> {
  const key = process.env["DIDIT_API_KEY"];
  if (!key) return null;
  try {
    const res = await fetch(`https://verification.didit.me/v3/session/${encodeURIComponent(sessionId)}/decision/`, {
      headers: { "x-api-key": key },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { status?: string };
    if (!j?.status) return null;
    return MAP[j.status] ?? "pending";
  } catch {
    return null;
  }
}

/** Statut effectif d'un utilisateur : « approved » dès qu'une vérification a abouti, sinon la plus récente. */
async function effectiveStatus(userId: string, reconcile: boolean): Promise<{ status: string; updated_at: string | null }> {
  const sb = await admin();
  const { data } = await sb.from("id_verifications")
    .select("status, session_id, updated_at, created_at").eq("user_id", userId)
    .order("created_at", { ascending: false }).limit(10);
  const rows = (data ?? []) as Row[];
  if (!rows.length) return { status: "none", updated_at: null };
  const done = rows.find((r) => r.status === "approved");
  if (done) return { status: "approved", updated_at: done.updated_at };
  const latest = rows[0];
  if (reconcile && (latest.status === "pending" || latest.status === "review") && latest.session_id) {
    const live = await fetchDiditStatus(latest.session_id);
    if (live && live !== latest.status) {
      await sb.from("id_verifications")
        .update({ status: live, updated_at: new Date().toISOString() }).eq("session_id", latest.session_id);
      return { status: live, updated_at: new Date().toISOString() };
    }
  }
  return { status: latest.status, updated_at: latest.updated_at };
}

/** Démarre une vérification d'identité Didit (CNI / passeport + selfie) pour le convoyeur connecté. */
export const startIdVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { origin: string }) => d)
  .handler(async ({ data, context }) => {
    ;(await import("@/lib/demo-block.server")).assertNotDemo((context as { claims?: unknown }).claims);
    const key = process.env["DIDIT_API_KEY"];
    const wf = process.env["DIDIT_WORKFLOW_ID"];
    if (!key || !wf) throw new Error("La vérification d'identité n'est pas encore activée.");

    // Une identité déjà validée (ou en cours d'examen) ne peut pas être refaite.
    const current = await effectiveStatus(context.userId, true);
    if (current.status === "approved") throw new Error("Votre identité est déjà vérifiée.");
    if (current.status === "review") throw new Error("Votre vérification est en cours d'examen par notre équipe.");

    const origin = /^https:\/\/([a-z0-9-]+\.)*transportsligneo\.fr$/.test(data.origin) || data.origin.startsWith("http://localhost")
      ? data.origin : "https://transportsligneo.fr";
    const res = await fetch("https://verification.didit.me/v3/session/", {
      method: "POST",
      headers: { "x-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ workflow_id: wf, vendor_data: context.userId, callback: `${origin}/convoyeur/documents?idv=done` }),
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 160);
      console.error("Didit", res.status, detail);
      throw new Error("Service de vérification indisponible, réessayez dans un instant.");
    }
    const j = (await res.json()) as { url: string; session_id: string };
    const sb = await admin();
    await sb.from("id_verifications").insert({ user_id: context.userId, session_id: j.session_id, status: "pending" });
    return { url: j.url };
  });

/** Statut de vérification du convoyeur connecté (lu côté serveur, resynchronisé avec Didit si besoin). */
export const getIdVerificationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const r = await effectiveStatus(context.userId, true);
    return { status: r.status as string };
  });

/** Admin : statut de vérification d'identité de plusieurs comptes. */
export const adminGetIdVerifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userIds: z.array(z.string().uuid()).min(1).max(500) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await (context.supabase as any).rpc("has_role", { _user_id: context.userId, _role: "admin" });
    const { data: isSuper } = await (context.supabase as any).rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
    if (!isAdmin && !isSuper) throw new Error("Forbidden");
    const out: Record<string, { status: string; updated_at: string | null }> = {};
    if (data.userIds.length <= 3) {
      for (const id of data.userIds) out[id] = await effectiveStatus(id, true);
      return out;
    }
    const sb = await admin();
    const { data: rows } = await sb.from("id_verifications")
      .select("user_id, status, updated_at, created_at").in("user_id", data.userIds)
      .order("created_at", { ascending: false }).limit(5000);
    for (const r of (rows ?? []) as Array<{ user_id: string; status: string; updated_at: string | null }>) {
      const cur = out[r.user_id];
      if (!cur) out[r.user_id] = { status: r.status, updated_at: r.updated_at };
      else if (r.status === "approved" && cur.status !== "approved") out[r.user_id] = { status: "approved", updated_at: r.updated_at };
    }
    return out;
  });
