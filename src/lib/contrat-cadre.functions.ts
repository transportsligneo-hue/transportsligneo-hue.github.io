import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: a } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  const { data: s } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
  if (!a && !s) throw new Error("Forbidden");
}

async function notifyClient(userId: string, titre: string, message: string, link: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await (supabaseAdmin as any).from("user_notifications").insert({ user_id: userId, type: "demande_rapide", titre, message, link });
  try {
    const { sendPushToUser } = await import("@/lib/push/send.server");
    await sendPushToUser(userId, { title: titre, body: message, url: link, tag: `dr-${Date.now()}` });
  } catch (e) {
    console.warn("[contrat-cadre] push", e);
  }
}

/** Convertit la demande en missions avec un compte admin (celui qui valide, ou un super_admin en auto). */
async function convertir(demandeId: string, adminUserId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.rpc(
    "service_convert_demande_to_missions" as never,
    { _demande_id: demandeId, _converted_by: adminUserId } as never,
  );
  if (error) throw new Error(error.message);
}

/**
 * Appelé juste après l'envoi d'une demande rapide par le client :
 * fige la preuve (compte, IP, date du contrat, tarif appliqué) et, si le contrat
 * autorise la validation automatique, lance la création des missions.
 */
export const enregistrerDemandeRapide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { demandeId: string }) => z.object({ demandeId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: d } = await db.from("demandes_convoyage").select("*").eq("id", data.demandeId).maybeSingle();
    if (!d || d.user_id !== context.userId || !d.sans_devis || !d.contrat_cadre_id) throw new Error("Demande introuvable");
    const { data: c } = await db.from("contrats_cadres").select("*").eq("id", d.contrat_cadre_id).maybeSingle();
    if (!c) throw new Error("Contrat introuvable");

    const ip = getRequestIP({ xForwardedFor: true }) ?? getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-real-ip") ?? null;
    const preuve = {
      numero_dr: d.numero_dr,
      compte_user_id: context.userId,
      email: d.email,
      ip,
      user_agent: getRequestHeader("user-agent") ?? null,
      envoye_le: new Date().toISOString(),
      contrat_id: c.id,
      contrat_signe_le: c.signe_le,
      contrat_valable_jusqua: c.valable_jusqua,
      remise_pct: c.remise_pct,
      plafond_ttc: c.plafond_ttc,
      tarif_applique_ttc: d.prix_estime,
      trajet: `${d.depart} → ${d.arrivee}`,
      immatriculation: d.vehicule_immatriculation ?? d.immatriculation ?? null,
    };
    await db.from("demandes_convoyage").update({ preuve_contrat: preuve }).eq("id", d.id);

    if (c.validation_auto) {
      const { data: admin } = await db.from("user_roles").select("user_id").eq("role", "super_admin").limit(1).maybeSingle();
      if (admin?.user_id) {
        await db.from("demandes_convoyage").update({
          validation_cadre: "validee", validation_cadre_par: null, validation_cadre_at: new Date().toISOString(),
        }).eq("id", d.id);
        await convertir(d.id, admin.user_id);
        await notifyClient(context.userId, `Demande ${d.numero_dr} confirmée`, "Votre demande est validée, un convoyeur va être attribué.", "/dashboard-pro");
        return { ok: true as const, auto: true as const, numero: d.numero_dr as string };
      }
    }
    return { ok: true as const, auto: false as const, numero: d.numero_dr as string };
  });

export const validerDemandeRapide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { demandeId: string }) => z.object({ demandeId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: d } = await db.from("demandes_convoyage").select("id, user_id, numero_dr, validation_cadre").eq("id", data.demandeId).maybeSingle();
    if (!d) throw new Error("Demande introuvable");
    if (d.validation_cadre === "validee") return { ok: true };
    await db.from("demandes_convoyage").update({
      validation_cadre: "validee", validation_cadre_par: context.userId, validation_cadre_at: new Date().toISOString(),
    }).eq("id", d.id);
    await convertir(d.id, context.userId);
    if (d.user_id) await notifyClient(d.user_id, `Demande ${d.numero_dr} confirmée`, "Votre demande est validée, un convoyeur va être attribué.", "/dashboard-pro");
    return { ok: true };
  });

export const refuserDemandeRapide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { demandeId: string; motif: string }) =>
    z.object({ demandeId: z.string().uuid(), motif: z.string().trim().min(1).max(500) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: d } = await db.from("demandes_convoyage").select("id, user_id, numero_dr").eq("id", data.demandeId).maybeSingle();
    if (!d) throw new Error("Demande introuvable");
    await db.from("demandes_convoyage").update({
      validation_cadre: "refusee", validation_cadre_par: context.userId, validation_cadre_at: new Date().toISOString(),
      motif_refus_cadre: data.motif, statut: "annulee",
    }).eq("id", d.id);
    if (d.user_id) await notifyClient(d.user_id, `Demande ${d.numero_dr} non retenue`, data.motif, "/dashboard-pro");
    return { ok: true };
  });
