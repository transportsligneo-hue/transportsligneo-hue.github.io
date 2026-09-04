import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PaymentLinkRow = {
  id: string;
  provider: string;
  environment: string;
  amount_cents: number;
  currency: string;
  description: string | null;
  statut: string;
  revolut_order_id: string | null;
  checkout_url: string | null;
  mission_id: string | null;
  paid_at: string | null;
  created_at: string;
};

async function assertAdmin(context: any) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (isAdmin) return;
  const { data: isSuper } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "super_admin",
  });
  if (!isSuper) throw new Error("Accès réservé aux administrateurs.");
}

/** Liste les liens de paiement (option : filtrés sur une mission). */
export const listPaymentLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { missionId?: string | null } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let q = context.supabase
      .from("payment_links")
      .select(
        "id, provider, environment, amount_cents, currency, description, statut, revolut_order_id, checkout_url, mission_id, paid_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.missionId) q = q.eq("mission_id", data.missionId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as PaymentLinkRow[];
  });

/** Crée un lien de paiement Revolut (ou enregistre un lien Stripe existant). */
export const createPaymentLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      provider: "revolut" | "stripe";
      amount: number;
      currency?: string;
      description?: string | null;
      missionId?: string | null;
      sandbox?: boolean;
      email?: string | null;
      checkoutUrl?: string | null;
    }) => {
      if (!input || !(input.amount > 0)) throw new Error("Montant invalide.");
      if (input.amount > 1_000_000) throw new Error("Montant trop élevé.");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const currency = (data.currency || "EUR").toUpperCase().slice(0, 3);
    const environment = data.sandbox ? "sandbox" : "production";
    const amountMinor = Math.round(data.amount * 100);

    let revolutOrderId: string | null = null;
    let checkoutUrl: string | null = data.checkoutUrl ?? null;

    if (data.provider === "revolut") {
      const { createRevolutOrder } = await import("@/lib/revolut-server");
      const order = await createRevolutOrder({
        env: environment,
        amountMinor,
        currency,
        description: data.description ?? null,
        email: data.email ?? null,
      });
      revolutOrderId = order.id;
      checkoutUrl =
        order.checkout_url ??
        (order.token
          ? `https://${environment === "sandbox" ? "sandbox-" : ""}checkout.revolut.com/payment-link/${order.token}`
          : null);
    }

    const { data: row, error } = await context.supabase
      .from("payment_links")
      .insert({
        provider: data.provider,
        environment,
        amount_cents: amountMinor,
        currency,
        description: data.description ?? null,
        mission_id: data.missionId ?? null,
        revolut_order_id: revolutOrderId,
        checkout_url: checkoutUrl,
        created_by: context.userId,
      })
      .select(
        "id, provider, environment, amount_cents, currency, description, statut, revolut_order_id, checkout_url, mission_id, paid_at, created_at",
      )
      .single();
    if (error) throw new Error(error.message);

    if (data.missionId) {
      await context.supabase.from("payment_link_attachments").insert({
        payment_link_id: row.id,
        mission_id: data.missionId,
        action: "attach",
        performed_by: context.userId,
      });
    }
    return row as PaymentLinkRow;
  });

/** Rattache ou détache un lien de paiement d'une mission (historisé). */
export const setPaymentLinkMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { linkId: string; missionId: string | null }) => {
    if (!input?.linkId) throw new Error("Lien introuvable.");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("payment_links")
      .update({ mission_id: data.missionId })
      .eq("id", data.linkId);
    if (error) throw new Error(error.message);

    await context.supabase.from("payment_link_attachments").insert({
      payment_link_id: data.linkId,
      mission_id: data.missionId,
      action: data.missionId ? "attach" : "detach",
      performed_by: context.userId,
    });
    return { ok: true };
  });

/** Historique de rattachement d'un lien. */
export const getPaymentLinkHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { linkId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: rows, error } = await context.supabase
      .from("payment_link_attachments")
      .select("id, action, mission_id, created_at, performed_by")
      .eq("payment_link_id", data.linkId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Rafraîchit le statut depuis Revolut (secours si le webhook n'est pas reçu). */
export const refreshPaymentLinkStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { linkId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: link, error } = await context.supabase
      .from("payment_links")
      .select("id, provider, environment, revolut_order_id, statut")
      .eq("id", data.linkId)
      .single();
    if (error || !link) throw new Error("Lien introuvable.");
    if (link.provider !== "revolut" || !link.revolut_order_id) return { statut: link.statut };

    const { retrieveRevolutOrder, mapRevolutState } = await import("@/lib/revolut-server");
    const order = await retrieveRevolutOrder(
      link.environment === "sandbox" ? "sandbox" : "production",
      link.revolut_order_id,
    );
    const statut = mapRevolutState(order.state);
    await context.supabase
      .from("payment_links")
      .update({ statut, paid_at: statut === "paid" ? new Date().toISOString() : null })
      .eq("id", link.id);
    return { statut };
  });

/** Recherche de missions pour le sélecteur de rattachement. */
export const searchMissionsForPaymentLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { q: string }) => ({ q: String(input?.q ?? "").slice(0, 80) }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const term = data.q.trim();
    let q = context.supabase
      .from("attributions")
      .select("id, numero_mission, statut, created_at, trajets(depart, arrivee, client_nom, prix_client)")
      .order("created_at", { ascending: false })
      .limit(20);
    if (term) {
      const like = `%${term.replace(/[%,]/g, "")}%`;
      q = q.ilike("numero_mission", like);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];

  });
