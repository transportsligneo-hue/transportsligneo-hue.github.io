/** Admin : crédits SMS restants chez Brevo (forfait). */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SmsCredits = { ok: true; credits: number | null; plan: string | null } | { ok: false; error: string };

export const smsCreditsGet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SmsCredits> => {
    const c = context as any;
    const [{ data: a }, { data: s }] = await Promise.all([
      c.supabase.rpc("has_role", { _user_id: c.userId, _role: "admin" }),
      c.supabase.rpc("has_role", { _user_id: c.userId, _role: "super_admin" }),
    ]);
    if (!a && !s) return { ok: false, error: "Accès réservé aux administrateurs." };
    const key = process.env["BREVO_API_KEY"];
    if (!key) return { ok: false, error: "Clé Brevo manquante." };
    try {
      const res = await fetch("https://api.brevo.com/v3/account", { headers: { "api-key": key, accept: "application/json" } });
      if (!res.ok) return { ok: false, error: `Brevo ${res.status}` };
      const json = (await res.json()) as any;
      const plans: any[] = Array.isArray(json?.plan) ? json.plan : [];
      const sms = plans.find((p) => String(p?.type ?? "").toLowerCase() === "sms");
      if (!sms) return { ok: true, credits: null, plan: null };
      return { ok: true, credits: Number(sms.credits ?? 0), plan: String(sms.type ?? "sms") };
    } catch {
      return { ok: false, error: "Brevo injoignable." };
    }
  });
