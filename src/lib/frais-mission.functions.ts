import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: a } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  const { data: s } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
  if (!a && !s) throw new Error("Forbidden");
}

/** Prévient le convoyeur (cloche + push) de la décision sur un de ses frais. */
export const notifyFraisDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { fraisId: string }) => z.object({ fraisId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: f } = await (supabaseAdmin as any)
      .from("frais_mission")
      .select("id, type, montant_ttc, statut, motif_refus, convoyeurs(user_id)")
      .eq("id", data.fraisId)
      .maybeSingle();
    const userId = f?.convoyeurs?.user_id as string | undefined;
    if (!f || !userId || f.statut === "attente") return { ok: false };

    const nom = f.type === "peage" ? "Péage" : "Carburant";
    const montant = Number(f.montant_ttc).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
    const ok = f.statut === "valide";
    const titre = ok ? `${nom} validé · ${montant}` : `${nom} refusé · ${montant}`;
    const message = ok
      ? "Ce montant sera ajouté à votre rémunération de la mission."
      : `Motif : ${f.motif_refus ?? "non précisé"}`;

    await (supabaseAdmin as any).from("user_notifications").insert({
      user_id: userId,
      type: ok ? "frais_valide" : "frais_refuse",
      titre,
      message,
      link: "/convoyeur/finances",
      metadata: { frais_id: f.id },
    });
    try {
      const { sendPushToUser } = await import("@/lib/push/send.server");
      await sendPushToUser(userId, { title: titre, body: message, url: "/convoyeur/finances", tag: `frais-${f.id}` });
    } catch (e) {
      console.warn("[frais] push", e);
    }
    return { ok: true };
  });

/**
 * Détecteur d'images générées par IA (Sightengine, offre gratuite 2 000/mois).
 * Inactif tant que SIGHTENGINE_API_USER / SIGHTENGINE_API_SECRET ne sont pas définis.
 */
export const analyserTicketIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { fraisId: string }) => z.object({ fraisId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const user = process.env.SIGHTENGINE_API_USER;
    const secret = process.env.SIGHTENGINE_API_SECRET;
    if (!user || !secret) return { ok: false as const, raison: "non_configure" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: f } = await (supabaseAdmin as any)
      .from("frais_mission").select("id, photo_path, controles").eq("id", data.fraisId).maybeSingle();
    if (!f?.photo_path) return { ok: false as const, raison: "pas_de_photo" as const };

    const { data: blob, error } = await supabaseAdmin.storage.from("frais-tickets").download(f.photo_path);
    if (error || !blob) return { ok: false as const, raison: "telechargement" as const };

    const form = new FormData();
    form.append("media", blob, "ticket.jpg");
    form.append("models", "genai");
    form.append("api_user", user);
    form.append("api_secret", secret);
    const res = await fetch("https://api.sightengine.com/1.0/check.json", { method: "POST", body: form });
    const json: any = await res.json().catch(() => null);
    const score = json?.type?.ai_generated;
    if (json?.status !== "success" || typeof score !== "number") {
      return { ok: false as const, raison: "api" as const };
    }
    await (supabaseAdmin as any)
      .from("frais_mission")
      .update({ controles: { ...(f.controles ?? {}), ia: score } })
      .eq("id", f.id);
    return { ok: true as const, score };
  });
