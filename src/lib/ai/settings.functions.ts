/**
 * updateAiSettings — modification des paramètres IA (admin uniquement).
 * getAiUsageStats — statistiques agrégées 30j pour la page admin.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Patch = z.record(z.string(), z.union([z.boolean(), z.string(), z.record(z.string(), z.string())]));

export const updateAiSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const p = Patch.safeParse(input);
    return p.success ? { __ok: true as const, patch: p.data } : { __ok: false as const, error: "Payload invalide" };
  })
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    if (!data.__ok) return { ok: false, error: data.error };
    // Vérif rôle admin via RLS : la RPC has_role
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    const { data: isSuper } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "super_admin",
    });
    if (!isAdmin && !isSuper) return { ok: false, error: "Réservé aux administrateurs" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row } = await (supabaseAdmin.from("ai_settings" as any) as any)
      .select("id").limit(1).maybeSingle();
    if (!row?.id) return { ok: false, error: "Paramètres IA introuvables" };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin.from("ai_settings" as any) as any)
      .update(data.patch).eq("id", row.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

export type AiUsageStats = {
  total_calls_30d: number;
  success_rate: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
  by_capability: Array<{ capability: string; calls: number; success_rate: number; avg_latency_ms: number }>;
  by_day: Array<{ day: string; calls: number }>;
};

export const getAiUsageStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true; stats: AiUsageStats } | { ok: false; error: string }> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    const { data: isSuper } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
    if (!isAdmin && !isSuper) return { ok: false, error: "Réservé aux administrateurs" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin.from("ai_usage_events" as any) as any)
      .select("capability, success, latency_ms, created_at").gte("created_at", since).limit(50000);
    if (error) return { ok: false, error: error.message };

    const rows = (data ?? []) as Array<{ capability: string; success: boolean; latency_ms: number | null; created_at: string }>;
    const latencies = rows.map(r => r.latency_ms ?? 0).filter(n => n > 0).sort((a, b) => a - b);
    const p95 = latencies.length ? latencies[Math.floor(latencies.length * 0.95)] : 0;
    const avg = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
    const successRate = rows.length ? rows.filter(r => r.success).length / rows.length : 0;

    const byCap = new Map<string, { calls: number; success: number; latency: number }>();
    for (const r of rows) {
      const b = byCap.get(r.capability) ?? { calls: 0, success: 0, latency: 0 };
      b.calls++;
      if (r.success) b.success++;
      b.latency += r.latency_ms ?? 0;
      byCap.set(r.capability, b);
    }
    const by_capability = [...byCap.entries()].map(([capability, v]) => ({
      capability, calls: v.calls,
      success_rate: v.calls ? v.success / v.calls : 0,
      avg_latency_ms: v.calls ? Math.round(v.latency / v.calls) : 0,
    })).sort((a, b) => b.calls - a.calls);

    const byDay = new Map<string, number>();
    for (const r of rows) {
      const d = r.created_at.slice(0, 10);
      byDay.set(d, (byDay.get(d) ?? 0) + 1);
    }
    const by_day = [...byDay.entries()].sort(([a],[b]) => a.localeCompare(b))
      .map(([day, calls]) => ({ day, calls }));

    return {
      ok: true,
      stats: {
        total_calls_30d: rows.length,
        success_rate: successRate,
        avg_latency_ms: avg,
        p95_latency_ms: p95,
        by_capability,
        by_day,
      },
    };
  });
