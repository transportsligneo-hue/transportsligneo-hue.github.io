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
  devis_id: string | null;
  facture_id: string | null;
  client_nom: string | null;
  client_prenom: string | null;
  client_email: string | null;
  client_telephone: string | null;
  paid_at: string | null;
  created_at: string;
  attributions?: {
    numero_mission: string | null;
    trajets?: { depart?: string | null; arrivee?: string | null; client_nom?: string | null } | null;
  } | null;
  devis?: { numero: string | null } | null;
  factures?: { numero: string | null } | null;
};

const SELECT_COLS =
  "id, provider, environment, amount_cents, currency, description, statut, revolut_order_id, checkout_url, mission_id, devis_id, facture_id, client_nom, client_prenom, client_email, client_telephone, paid_at, created_at, attributions:mission_id(numero_mission, trajets(depart, arrivee, client_nom)), devis:devis_id(numero), factures:facture_id(numero)";

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
      .select(SELECT_COLS)
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.missionId) q = q.eq("mission_id", data.missionId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as PaymentLinkRow[];
  });

export type CreatePaymentLinkInput = {
  provider: "revolut" | "stripe";
  amount: number;
  currency?: string;
  description?: string | null;
  missionId?: string | null;
  devisId?: string | null;
  factureId?: string | null;
  sandbox?: boolean;
  clientNom?: string | null;
  clientPrenom?: string | null;
  clientEmail?: string | null;
  clientTelephone?: string | null;
  checkoutUrl?: string | null;
};

/** Crée un lien de paiement Revolut (ou enregistre un lien Stripe existant). */
export const createPaymentLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CreatePaymentLinkInput) => {
    if (!input || !(input.amount > 0)) throw new Error("Montant invalide.");
    if (input.amount > 1_000_000) throw new Error("Montant trop élevé.");
    if (!input.missionId && !input.devisId && !input.factureId) {
      throw new Error("Rattachez le paiement à une mission, un devis ou une facture.");
    }
    if (input.clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.clientEmail.trim())) {
      throw new Error("Email invalide.");
    }
    return input;
  })
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
        email: data.clientEmail ?? null,
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
        devis_id: data.devisId ?? null,
        facture_id: data.factureId ?? null,
        client_nom: data.clientNom ?? null,
        client_prenom: data.clientPrenom ?? null,
        client_email: data.clientEmail ?? null,
        client_telephone: data.clientTelephone ?? null,
        revolut_order_id: revolutOrderId,
        checkout_url: checkoutUrl,
        created_by: context.userId,
      })
      .select(SELECT_COLS)
      .single();
    if (error) throw new Error(error.message);

    if (data.missionId) {
      await context.supabase.from("payment_link_attachments").insert({
        payment_link_id: (row as any).id,
        mission_id: data.missionId,
        action: "attach",
        performed_by: context.userId,
      });
    }
    return row as unknown as PaymentLinkRow;
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

/** Historique complet d'un lien : rattachements, envois et événements bancaires. */
export const getPaymentLinkHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { linkId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const [attachments, sends] = await Promise.all([
      context.supabase
        .from("payment_link_attachments")
        .select("id, action, mission_id, created_at")
        .eq("payment_link_id", data.linkId)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("payment_link_sends")
        .select("id, channel, destination, status, error, created_at")
        .eq("payment_link_id", data.linkId)
        .order("created_at", { ascending: false }),
    ]);
    return {
      attachments: (attachments.data ?? []) as any[],
      sends: (sends.data ?? []) as any[],
    };
  });

/** Envoie le lien de paiement par SMS ou par email au client. */
export const sendPaymentLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { linkId: string; channel: "sms" | "email"; destination?: string | null }) => {
    if (!input?.linkId) throw new Error("Lien introuvable.");
    if (input.channel !== "sms" && input.channel !== "email") throw new Error("Canal invalide.");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: link, error } = await context.supabase
      .from("payment_links")
      .select(SELECT_COLS)
      .eq("id", data.linkId)
      .single();
    if (error || !link) throw new Error("Lien introuvable.");
    const row = link as unknown as PaymentLinkRow;
    if (!row.checkout_url) throw new Error("Ce lien n'a pas d'URL de paiement.");

    const destination =
      (data.destination || "").trim() ||
      (data.channel === "sms" ? row.client_telephone : row.client_email) ||
      "";
    if (!destination) {
      throw new Error(
        data.channel === "sms" ? "Aucun numéro de téléphone." : "Aucune adresse email.",
      );
    }

    const montant = new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: row.currency || "EUR",
    }).format(row.amount_cents / 100);
    const reference =
      row.attributions?.numero_mission || row.devis?.numero || row.factures?.numero || null;

    let ok = false;
    let errorMessage: string | null = null;

    if (data.channel === "sms") {
      const { sendSms } = await import("@/lib/sms.server");
      const body = `Transports Ligneo${reference ? ` - ${reference}` : ""}\nRèglement de ${montant} :\n${row.checkout_url}`;
      const res = await sendSms({ to: destination, body, from: "LIGNEO" });
      ok = res.ok;
      errorMessage = res.error ?? null;
    } else {
      const { sendTransactionalEmailServer } = await import("@/server/email-send");
      const res = await sendTransactionalEmailServer({
        templateName: "message-manuel",
        recipientEmail: destination,
        templateData: {
          prenom: row.client_prenom ?? undefined,
          subject: `Votre lien de paiement — ${montant}`,
          titre: "Votre lien de paiement sécurisé",
          message: `${row.description ? `${row.description}. ` : ""}Montant à régler : ${montant}. Le paiement est sécurisé et immédiat.`,
          reference: reference ?? undefined,
          ctaLabel: `Payer ${montant}`,
          ctaUrl: row.checkout_url,
        },
      });
      ok = res.success;
      errorMessage = res.success ? null : (res.reason ?? "Envoi impossible");
    }

    await context.supabase.from("payment_link_sends").insert({
      payment_link_id: row.id,
      channel: data.channel,
      destination,
      status: ok ? "sent" : "failed",
      error: errorMessage,
      sent_by: context.userId,
    });

    if (!ok) throw new Error(errorMessage || "Envoi impossible.");
    return { ok: true, destination };
  });

/** Rafraîchit le statut depuis Revolut (secours si le webhook n'est pas reçu). */
export const refreshPaymentLinkStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { linkId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: link, error } = await context.supabase
      .from("payment_links")
      .select("id, provider, environment, revolut_order_id, statut, amount_cents, devis_id, facture_id, mission_id")
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

    // Le paiement vient d'être constaté : facture émise + envoyée au client.
    if (statut === "paid" && link.statut !== "paid") {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { ensureFactureForDevis, ensureFactureForMission, sendFactureDisponibleEmail, markFacturePaidAndSend } =
          await import("@/lib/facture-auto.server");
        if (link.facture_id) {
          await markFacturePaidAndSend(link.facture_id, {
            amountCents: link.amount_cents ?? null,
            modePaiement: "Revolut",
            paidAt: new Date().toISOString(),
          });
        } else if (link.devis_id) {
          const { data: devis } = await supabaseAdmin
            .from("devis")
            .select("*")
            .eq("id", link.devis_id)
            .maybeSingle();
          if (devis) {
            const facture = await ensureFactureForDevis(devis, {
              amountCents: link.amount_cents ?? null,
              missionId: link.mission_id ?? null,
              modePaiement: "Revolut",
              paidAt: new Date().toISOString(),
            });
            await sendFactureDisponibleEmail(facture);
            if (facture?.["id"]) {
              await supabaseAdmin
                .from("payment_links")
                .update({ facture_id: facture["id"] })
                .eq("id", link.id);
            }
          }
        } else if (link.mission_id) {
          const facture = await ensureFactureForMission(link.mission_id, {
            amountCents: link.amount_cents ?? null,
            modePaiement: "Revolut",
            paidAt: new Date().toISOString(),
          });
          await sendFactureDisponibleEmail(facture);
          if (facture?.["id"]) {
            await supabaseAdmin
              .from("payment_links")
              .update({ facture_id: facture["id"] })
              .eq("id", link.id);
          }
        }
      } catch (e) {
        console.error("[payment-links] facture auto error", e);
      }
    }
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
      .select("id, numero_mission, statut, created_at, trajets(depart, arrivee, client_nom, client_email, client_telephone, prix_client)")
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

/** Recherche de devis pour le sélecteur de rattachement. */
export const searchDevisForPaymentLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { q: string }) => ({ q: String(input?.q ?? "").slice(0, 80) }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const term = data.q.trim();
    let q = context.supabase
      .from("devis")
      .select("id, numero, nom, prenom, email, telephone, depart, arrivee, prix_estime, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (term) {
      const like = `%${term.replace(/[%,]/g, "")}%`;
      q = q.or(`numero.ilike.${like},nom.ilike.${like},email.ilike.${like}`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
  });

/** Annule un lien de paiement (côté Revolut puis en base). Impossible si déjà payé. */
export const cancelPaymentLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { linkId: string }) => {
    if (!input?.linkId) throw new Error("Lien introuvable.");
    return { linkId: input.linkId };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: link, error } = await context.supabase
      .from("payment_links")
      .select("id, provider, environment, revolut_order_id, statut")
      .eq("id", data.linkId)
      .single();
    if (error || !link) throw new Error("Lien introuvable.");
    if (link.statut === "paid") throw new Error("Ce lien est déjà payé : il ne peut pas être annulé.");

    let providerWarning: string | null = null;
    if (link.provider === "revolut" && link.revolut_order_id) {
      try {
        const { cancelRevolutOrder } = await import("@/lib/revolut-server");
        await cancelRevolutOrder(
          link.environment === "sandbox" ? "sandbox" : "production",
          link.revolut_order_id,
        );
      } catch (e) {
        providerWarning = e instanceof Error ? e.message : "Annulation Revolut impossible";
      }
    }

    const { error: upErr } = await context.supabase
      .from("payment_links")
      .update({ statut: "cancelled" })
      .eq("id", link.id);
    if (upErr) throw new Error(upErr.message);

    await context.supabase.from("payment_link_attachments").insert({
      payment_link_id: link.id,
      mission_id: null,
      action: "cancel",
      performed_by: context.userId,
    });

    return { ok: true, statut: "cancelled", providerWarning };
  });

/** Supprime définitivement un lien de paiement (jamais s'il a été payé). */
export const deletePaymentLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { linkId: string }) => {
    if (!input?.linkId) throw new Error("Lien introuvable.");
    return { linkId: input.linkId };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: link, error } = await context.supabase
      .from("payment_links")
      .select("id, provider, environment, revolut_order_id, statut")
      .eq("id", data.linkId)
      .single();
    if (error || !link) throw new Error("Lien introuvable.");
    if (link.statut === "paid") {
      throw new Error("Un lien payé ne peut pas être supprimé (traçabilité comptable).");
    }

    // On tente d'abord d'annuler côté Revolut pour que le lien ne soit plus payable.
    if (link.provider === "revolut" && link.revolut_order_id && link.statut !== "cancelled") {
      try {
        const { cancelRevolutOrder } = await import("@/lib/revolut-server");
        await cancelRevolutOrder(
          link.environment === "sandbox" ? "sandbox" : "production",
          link.revolut_order_id,
        );
      } catch {
        /* le lien est supprimé de la base même si Revolut refuse l'annulation */
      }
    }

    await context.supabase.from("payment_link_sends").delete().eq("payment_link_id", link.id);
    await context.supabase.from("payment_link_attachments").delete().eq("payment_link_id", link.id);
    const { error: delErr } = await context.supabase
      .from("payment_links")
      .delete()
      .eq("id", link.id);
    if (delErr) throw new Error(delErr.message);
    return { ok: true };
  });

/**
 * Envoie la facture au client une fois le lien de paiement réglé.
 * Fonctionne même si la mission n'a pas encore démarré : la facture est
 * créée à partir du devis si elle n'existe pas encore.
 */
export const sendFactureForPaymentLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { linkId: string; destination?: string | null }) => {
    if (!input?.linkId) throw new Error("Lien introuvable.");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: link, error } = await context.supabase
      .from("payment_links")
      .select(
        "id, provider, statut, amount_cents, currency, mission_id, devis_id, facture_id, client_email, client_nom, client_prenom, paid_at",
      )
      .eq("id", data.linkId)
      .single();
    if (error || !link) throw new Error("Lien introuvable.");
    if (link.statut !== "paid") throw new Error("Ce lien n'est pas encore payé.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ensureFactureForDevis, ensureFactureForMission } = await import(
      "@/lib/facture-auto.server"
    );
    const paymentOptions = {
      amountCents: link.amount_cents ?? null,
      modePaiement: link.provider === "revolut" ? "Revolut" : "Carte bancaire",
      paidAt: link.paid_at ?? new Date().toISOString(),
    };

    let facture: Record<string, any> | null = null;
    if (link.facture_id) {
      const { data: f } = await supabaseAdmin
        .from("factures")
        .select("*")
        .eq("id", link.facture_id)
        .maybeSingle();
      facture = (f ?? null) as Record<string, any> | null;
    }
    // Lors d'un renvoi, resynchroniser une facture déjà créée avec le devis
    // actuel afin de ne jamais expédier une ancienne désignation ou un ancien PDF.
    if (facture && link.mission_id) {
      const { data: attr } = await supabaseAdmin
        .from("attributions")
        .select("trajets(devis_id)")
        .eq("id", link.mission_id)
        .maybeSingle();
      const devisId = (attr as any)?.trajets?.devis_id as string | undefined;
      if (devisId) {
        const { data: devis } = await supabaseAdmin.from("devis").select("*").eq("id", devisId).maybeSingle();
        if (devis) {
          facture = await ensureFactureForDevis(devis, {
            ...paymentOptions,
            missionId: link.mission_id,
          });
        }
      }
    }
    if (!facture && link.devis_id) {
      const { data: devis } = await supabaseAdmin
        .from("devis")
        .select("*")
        .eq("id", link.devis_id)
        .maybeSingle();
      if (devis) {
        facture = await ensureFactureForDevis(devis, {
          ...paymentOptions,
          missionId: link.mission_id ?? null,
        });
      }
    }
    if (!facture && link.mission_id) {
      // Lien rattaché uniquement à une mission : la facture est créée à partir
      // de la mission (via son devis quand il existe), même si elle n'a pas démarré.
      facture = await ensureFactureForMission(link.mission_id, {
        ...paymentOptions,
      });
    }
    if (facture?.["id"] && !link.facture_id) {
      await supabaseAdmin
        .from("payment_links")
        .update({ facture_id: facture["id"] })
        .eq("id", link.id);
    }
    if (!facture) {
      throw new Error(
        "Impossible de créer la facture : aucune mission, devis ou facture exploitable sur ce lien.",
      );
    }


    const destination =
      (data.destination || "").trim() ||
      (facture["client_email"] as string | null) ||
      link.client_email ||
      "";
    if (!destination) throw new Error("Aucune adresse email pour ce client.");

    const { sendTransactionalEmailServer } = await import("@/server/email-send");
    const res = await sendTransactionalEmailServer({
      templateName: "facture-disponible",
      recipientEmail: destination,
      templateData: {
        prenom: facture["client_prenom"] ?? facture["client_nom"] ?? link.client_prenom ?? undefined,
        numero: facture["numero"] ?? undefined,
        montant: Number(facture["prix_ttc"] ?? (link.amount_cents ?? 0) / 100).toFixed(2),
        pdfUrl: facture["pdf_url"] ?? undefined,
      },
    });

    await context.supabase.from("payment_link_sends").insert({
      payment_link_id: link.id,
      channel: "email",
      destination,
      status: res.success ? "sent" : "failed",
      error: res.success ? null : (res.reason ?? "Envoi impossible"),
      sent_by: context.userId,
    });

    if (!res.success) throw new Error(res.reason ?? "Envoi impossible.");
    return { ok: true, destination, numero: (facture["numero"] as string | null) ?? null };
  });
