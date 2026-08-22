import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { LoyaltyAccount, LoyaltyReward, LoyaltyTier } from "@/lib/loyalty";

/** Compte fidélité du client connecté (créé à la volée si absent). */
export const getMyLoyalty = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    let { data: account } = await supabaseAdmin
      .from("loyalty_accounts")
      .select("*")
      .eq("client_id", userId)
      .maybeSingle();

    if (!account) {
      const email = (context.claims as { email?: string } | null)?.email ?? null;
      const { data: created } = await supabaseAdmin
        .from("loyalty_accounts")
        .insert({ client_id: userId, email })
        .select("*")
        .maybeSingle();
      account = created ?? null;
    }

    const [{ data: rewards }, { data: tiers }] = await Promise.all([
      account
        ? supabaseAdmin
            .from("loyalty_rewards_history")
            .select("*")
            .eq("loyalty_account_id", account.id)
            .order("date_calcul", { ascending: false })
        : Promise.resolve({ data: [] as unknown[] }),
      supabaseAdmin.from("loyalty_settings").select("*").order("sort_order"),
    ]);

    return {
      account: (account ?? null) as LoyaltyAccount | null,
      rewards: (rewards ?? []) as unknown as LoyaltyReward[],
      tiers: (tiers ?? []) as unknown as LoyaltyTier[],
    };
  });

/** Applique tout ou partie du solde d'avoir sur un devis du client connecté. */
export const applyAvoirToDevis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ devisId: z.string().uuid(), montant: z.number().positive().max(100000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: devis } = await supabaseAdmin
      .from("devis")
      .select("id, user_id, prix_estime, avoir_applique, paid_at")
      .eq("id", data.devisId)
      .maybeSingle();
    if (!devis || devis.user_id !== context.userId) throw new Error("Devis introuvable");
    if (devis.paid_at) throw new Error("Ce devis est déjà payé");

    const restant = Number(devis.prix_estime ?? 0) - Number(devis.avoir_applique ?? 0);
    const montant = Math.min(Math.round(data.montant * 100) / 100, Math.max(restant, 0));
    if (montant <= 0) throw new Error("Aucun montant déductible sur ce devis");

    // RPC SECURITY DEFINER : vérifie le solde, consomme les avoirs les plus proches
    // de l'expiration et trace la ligne d'utilisation.
    const { error } = await context.supabase.rpc("loyalty_apply_avoir", {
      _montant: montant,
      _mission_id: null,
      _devis_id: data.devisId,
    } as never);
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("devis")
      .update({ avoir_applique: Number(devis.avoir_applique ?? 0) + montant })
      .eq("id", data.devisId);

    return { ok: true as const, montant };
  });

async function assertAdmin(context: { supabase: any; userId: string }) {
  const [{ data: a }, { data: s }] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" }),
  ]);
  if (!a && !s) throw new Error("Accès refusé");
}

export interface AdminLoyaltyRow {
  account: LoyaltyAccount;
  clientNom: string;
  clientEmail: string;
  societe: string | null;
  typeClient: string | null;
  rewards: LoyaltyReward[];
}

/** Liste complète des comptes fidélité (admin). */
export const adminListLoyalty = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rows: AdminLoyaltyRow[]; tiers: LoyaltyTier[] }> => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: accounts }, { data: rewards }, { data: tiers }] = await Promise.all([
      supabaseAdmin.from("loyalty_accounts").select("*").order("solde_avoir", { ascending: false }),
      supabaseAdmin.from("loyalty_rewards_history").select("*").order("date_calcul", { ascending: false }),
      supabaseAdmin.from("loyalty_settings").select("*").order("sort_order"),
    ]);

    const ids = (accounts ?? []).map((a) => a.client_id);
    const { data: profiles } = ids.length
      ? await supabaseAdmin
          .from("profiles")
          .select("user_id, nom, prenom, email, societe, type_client")
          .in("user_id", ids)
      : { data: [] as never[] };

    const byUser = new Map((profiles ?? []).map((p) => [p.user_id, p]));
    const rewardsByAccount = new Map<string, LoyaltyReward[]>();
    for (const r of (rewards ?? []) as unknown as LoyaltyReward[]) {
      const list = rewardsByAccount.get(r.loyalty_account_id) ?? [];
      list.push(r);
      rewardsByAccount.set(r.loyalty_account_id, list);
    }

    const rows: AdminLoyaltyRow[] = (accounts ?? []).map((a) => {
      const p = byUser.get(a.client_id);
      return {
        account: a as unknown as LoyaltyAccount,
        clientNom: [p?.prenom, p?.nom].filter(Boolean).join(" ") || "Client",
        clientEmail: p?.email ?? a.email ?? "",
        societe: p?.societe ?? null,
        typeClient: p?.type_client ?? null,
        rewards: rewardsByAccount.get(a.id) ?? [],
      };
    });

    return { rows, tiers: (tiers ?? []) as unknown as LoyaltyTier[] };
  });

/** Ajustement manuel d'un avoir / taux, note justificative obligatoire. */
export const adminAdjustLoyalty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        accountId: z.string().uuid(),
        montantAvoir: z.number().min(-100000).max(100000),
        taux: z.number().min(0).max(100).default(0),
        note: z.string().trim().min(3).max(1000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { error } = await context.supabase.rpc("admin_loyalty_adjust", {
      _account_id: data.accountId,
      _montant_avoir: data.montantAvoir,
      _taux: data.taux,
      _note: data.note,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Modification du barème (paliers / taux) depuis l'admin. */
export const adminUpdateLoyaltyTier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        seuil_km_min: z.number().min(0),
        seuil_km_max: z.number().min(0).nullable(),
        taux: z.number().min(0).max(100),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { error } = await context.supabase
      .from("loyalty_settings")
      .update({
        seuil_km_min: data.seuil_km_min,
        seuil_km_max: data.seuil_km_max,
        taux: data.taux,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
