// Facturation automatique dès qu'un paiement est encaissé (Stripe ou Revolut).
// Une facture payée est créée à partir du devis même si aucune mission n'existe
// encore, puis envoyée immédiatement au client par email.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendTransactionalEmailServer } from "@/server/email-send";

export type FactureRow = Record<string, any>;

/** Retrouve la facture déjà émise pour un devis (idempotence des webhooks). */
async function findFactureForDevis(devis: FactureRow, sessionId?: string | null) {
  if (sessionId) {
    const { data } = await supabaseAdmin
      .from("factures")
      .select("*")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();
    if (data) return data as FactureRow;
  }
  if (devis?.numero) {
    const { data } = await supabaseAdmin
      .from("factures")
      .select("*")
      .eq("reference_client", devis.numero)
      .maybeSingle();
    if (data) return data as FactureRow;
  }
  return null;
}

export interface EnsureFactureOptions {
  amountCents?: number | null;
  missionId?: string | null;
  sessionId?: string | null;
  paymentIntentId?: string | null;
  modePaiement?: string;
}

/**
 * Crée (ou retrouve) la facture payée correspondant à un devis réglé.
 * Fonctionne même si la mission n'a pas encore été créée : `mission_id` reste
 * simplement vide et pourra être renseigné plus tard.
 */
export async function ensureFactureForDevis(
  devis: FactureRow,
  options: EnsureFactureOptions = {},
): Promise<FactureRow | null> {
  if (!devis) return null;

  const existing = await findFactureForDevis(devis, options.sessionId ?? null);
  if (existing) {
    // La mission a pu être créée après coup : on complète le lien si besoin.
    if (options.missionId && !existing["mission_id"]) {
      await supabaseAdmin
        .from("factures")
        .update({ mission_id: options.missionId })
        .eq("id", existing["id"]);
    }
    return existing;
  }

  const amountCents = Number(options.amountCents ?? 0);
  const prixTtc = Number(devis["prix_estime"] ?? (amountCents ? amountCents / 100 : 0));
  const prixHt = Math.round((prixTtc / 1.2) * 100) / 100;
  const prixTva = Math.round((prixTtc - prixHt) * 100) / 100;
  const factureNumero = /^DEV-TLG-\d{4}-#?\d{3}$/.test(devis["numero"] ?? "")
    ? String(devis["numero"]).replace("DEV-TLG", "FAC-TLG")
    : undefined;
  const vehiculeLabel = [devis["marque"], devis["modele"]].filter(Boolean).join(" ");
  const designation = [
    "Convoyage automobile par conducteur professionnel",
    vehiculeLabel || null,
    devis["option_trajet"] === "aller_retour" ? "Livraison + restitution" : "Livraison simple",
  ]
    .filter(Boolean)
    .join(" — ");

  const { data: inserted, error } = await supabaseAdmin
    .from("factures")
    .insert({
      ...(factureNumero && { numero: factureNumero }),
      mission_id: options.missionId ?? devis["mission_id"] ?? null,
      client_email: devis["email"],
      client_nom: devis["nom"],
      client_prenom: devis["prenom"],
      type_facture: "particulier",
      date_mission: devis["date_souhaitee"] ?? null,
      depart: devis["depart"] ?? null,
      arrivee: devis["arrivee"] ?? null,
      distance_km: devis["distance_km"] ?? null,
      designation,
      reference_label: "Devis",
      reference_client: devis["numero"] ?? null,
      prix_ht: prixHt,
      tva_taux: 20,
      prix_tva: prixTva,
      prix_ttc: prixTtc,
      statut: "payee",
      mode_paiement: options.modePaiement ?? "carte",
      date_paiement: new Date().toISOString().slice(0, 10),
      paid_at: new Date().toISOString(),
      amount_paid_cents: amountCents || Math.round(prixTtc * 100),
      stripe_session_id: options.sessionId ?? null,
      stripe_payment_intent_id: options.paymentIntentId ?? null,
    } as never)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("[facture-auto] insert error", error.message);
    return null;
  }

  // Aligner la séquence FAC-TLG pour éviter les collisions futures
  if (factureNumero) {
    const suffix = parseInt(factureNumero.slice(-3), 10);
    const year = parseInt(factureNumero.split("-")[2] ?? "0", 10);
    await supabaseAdmin
      .from("mission_sequences")
      .update({ current_value: suffix, updated_at: new Date().toISOString() })
      .eq("prefix", "FAC-TLG")
      .eq("year", year)
      .lt("current_value", suffix);
  }

  return (inserted ?? null) as FactureRow | null;
}

/** Envoie immédiatement la facture au client (email "Facture disponible"). */
export async function sendFactureDisponibleEmail(facture: FactureRow | null): Promise<void> {
  if (!facture?.["client_email"]) return;
  try {
    await sendTransactionalEmailServer({
      templateName: "facture-disponible",
      recipientEmail: facture["client_email"],
      idempotencyKey: `facture-disponible-${facture["id"]}`,
      templateData: {
        prenom: facture["client_prenom"] ?? facture["client_nom"] ?? undefined,
        numero: facture["numero"] ?? undefined,
        montant: Number(facture["prix_ttc"] ?? 0).toFixed(2),
      },
    });
  } catch (e) {
    console.error("[facture-auto] email error", e);
  }
}

/** Marque une facture existante comme payée puis l'envoie au client. */
export async function markFacturePaidAndSend(
  factureId: string,
  options: EnsureFactureOptions & { provider?: string } = {},
): Promise<void> {
  const { data: facture } = await supabaseAdmin
    .from("factures")
    .select("*")
    .eq("id", factureId)
    .maybeSingle();
  if (!facture) return;

  const already = facture["paid_at"] || facture["statut"] === "payee";
  if (!already) {
    await supabaseAdmin
      .from("factures")
      .update({
        statut: "payee",
        mode_paiement: options.modePaiement ?? "carte",
        date_paiement: new Date().toISOString().slice(0, 10),
        paid_at: new Date().toISOString(),
        amount_paid_cents: options.amountCents ?? facture["amount_paid_cents"] ?? null,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", factureId);
  }

  await sendFactureDisponibleEmail({ ...facture, statut: "payee" });
}
