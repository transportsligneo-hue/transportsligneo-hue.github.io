/**
 * Contrat de partenariat obligatoire : accès aux missions, versions du contrat,
 * notifications du parcours. La règle d'accès vit en base
 * (convoyeur_acces_missions + verrous sur offres / attributions) : ces fonctions
 * ne font que la lire, informer et administrer.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AccesMissions = "ok" | "suspendu" | "dossier" | "contrat" | "nouvelle_version";

export type MonAcces = {
  acces: AccesMissions;
  statut: string | null;
  versionCourante: number;
  versionSignee: number | null;
  signeLe: string | null;
  derogationJusquAu: string | null;
};

async function assertAdmin(context: { supabase: any; userId: string }) {
  const [{ data: a }, { data: s }] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" }),
  ]);
  if (!a && !s) throw new Error("Accès réservé aux administrateurs.");
}

const SITE = "https://www.transportsligneo.fr";

/** Convoyeur connecté : où en est-il dans son parcours d'activation ? */
export const monAccesMissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MonAcces> => {
    const { data, error } = await (context.supabase as any).rpc("mon_acces_missions");
    if (error || !data) {
      return { acces: "dossier", statut: null, versionCourante: 1, versionSignee: null, signeLe: null, derogationJusquAu: null };
    }
    const d = data as Record<string, any>;
    return {
      acces: (d.acces ?? "dossier") as AccesMissions,
      statut: d.statut ?? null,
      versionCourante: Number(d.version_courante ?? 1),
      versionSignee: d.version_signee == null ? null : Number(d.version_signee),
      signeLe: d.signe_le ?? null,
      derogationJusquAu: d.derogation_jusqu_au ?? null,
    };
  });

/**
 * Admin : le dossier d'un convoyeur vient d'être validé.
 * Notification dans son espace + push, et rappel côté admin d'envoyer le contrat
 * (l'envoi du contrat reste toujours manuel).
 */
export const notifierDossierValide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { convoyeurId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
    const { data: c } = await db.from("convoyeurs").select("id, user_id, prenom, nom").eq("id", data.convoyeurId).maybeSingle();
    if (!c) return { ok: false };
    const nom = [c.prenom, c.nom].filter(Boolean).join(" ") || "Un convoyeur";
    if (c.user_id) {
      await db.from("user_notifications").insert({
        user_id: c.user_id, type: "dossier_valide", titre: "Dossier validé",
        message: "Votre dossier est validé. Dernière étape : la signature de votre contrat de partenariat, que vous allez recevoir.",
        link: "/convoyeur/contrat", dedup_key: `dossier-valide-${c.id}`,
      });
      try {
        const { sendPushToUser } = await import("@/lib/push/send.server");
        await sendPushToUser(c.user_id, { title: "Dossier validé", body: "Dernière étape : signer votre contrat.", url: "/convoyeur/contrat", tag: `dossier-${c.id}` });
      } catch (e) { console.error("[contrat] push dossier", e); }
    }
    await db.from("admin_notifications").insert({
      type: "contrat_a_envoyer", titre: "Contrat à envoyer",
      message: `Le dossier de ${nom} est validé : envoyez-lui son contrat de partenariat.`,
      link: `/admin/convoyeurs/${c.id}`, entity_type: "convoyeur", entity_id: c.id,
    });
    return { ok: true };
  });

/**
 * Admin : publie une nouvelle version du contrat. Tous les convoyeurs actifs
 * passent en « nouvelle signature requise » (règle en base) et sont prévenus.
 */
export const publierVersionContrat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { libelle: string; resume?: string }) => {
    if (!d?.libelle?.trim()) throw new Error("Donnez un nom à cette version.");
    return { libelle: d.libelle.trim().slice(0, 120), resume: (d.resume ?? "").trim().slice(0, 2000) };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
    const { data: last } = await db.from("contrat_convoyeur_versions").select("version").order("version", { ascending: false }).limit(1).maybeSingle();
    const version = Number(last?.version ?? 0) + 1;
    const { error } = await db.from("contrat_convoyeur_versions").insert({ version, libelle: data.libelle, resume: data.resume || null, publie_par: context.userId });
    if (error) throw new Error(`Publication impossible : ${error.message}`);

    const { data: convs } = await db.from("convoyeurs").select("id, user_id, email, prenom, statut").eq("statut", "valide");
    let prevenus = 0;
    const { sendTransactionalEmailServer } = await import("@/server/email-send");
    const { sendPushToUser } = await import("@/lib/push/send.server");
    for (const c of (convs ?? []) as any[]) {
      if (c.user_id) {
        await db.from("user_notifications").insert({
          user_id: c.user_id, type: "contrat_nouvelle_version", titre: "Nouvelle version du contrat",
          message: `Le contrat de partenariat évolue (version ${version}). Vous allez recevoir la nouvelle version à signer pour continuer à prendre des missions.`,
          link: "/convoyeur/contrat", dedup_key: `contrat-v${version}-${c.id}`,
        });
        try { await sendPushToUser(c.user_id, { title: "Nouvelle version du contrat", body: "Une nouvelle signature est nécessaire pour continuer.", url: "/convoyeur/contrat", tag: `contrat-v${version}` }); } catch { /* non bloquant */ }
      }
      if (c.email) {
        await sendTransactionalEmailServer({
          templateName: "message-manuel", recipientEmail: c.email, idempotencyKey: `contrat-v${version}-${c.id}`,
          logMeta: { auto: true },
          templateData: {
            prenom: c.prenom ?? undefined, subject: "Nouvelle version de votre contrat de partenariat",
            titre: "Votre contrat de partenariat évolue",
            message: `Une nouvelle version du contrat (version ${version}) entre en vigueur. ${data.resume ? `Ce qui change : ${data.resume} ` : ""}Vous allez recevoir la nouvelle version à signer en ligne. Tant qu'elle n'est pas signée, l'accès aux nouvelles missions est suspendu. Les missions déjà acceptées peuvent être menées à leur terme.`,
            ctaLabel: "Voir mon contrat", ctaUrl: `${SITE}/convoyeur/contrat`,
          },
        }).catch(() => undefined);
      }
      prevenus++;
    }
    await db.from("admin_notifications").insert({
      type: "contrat_nouvelle_version", titre: `Contrat version ${version} publiée`,
      message: `${prevenus} convoyeur(s) doivent signer la nouvelle version.`, link: "/admin/contrats-convoyeurs",
    });
    return { version, prevenus };
  });

/** Admin : accès temporaire aux missions sans contrat à jour (ex. convoyeur déjà en route). */
export const derogationContrat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { convoyeurId: string; jours: number | null }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
    const jusqu = data.jours && data.jours > 0 ? new Date(Date.now() + Math.min(data.jours, 30) * 86_400_000).toISOString() : null;
    const { error } = await db.from("convoyeurs").update({ contrat_derogation_jusqu_au: jusqu }).eq("id", data.convoyeurId);
    if (error) throw new Error(error.message);
    return { jusqu };
  });
