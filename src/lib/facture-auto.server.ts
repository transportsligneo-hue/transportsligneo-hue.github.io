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
  attributionId?: string | null;
  sessionId?: string | null;
  paymentIntentId?: string | null;
  modePaiement?: string;
  paidAt?: string | null;
}

function normalizePaidAt(value?: string | null): string {
  if (!value) return new Date().toISOString();
  const numeric = /^\d{10,13}$/.test(value) ? Number(value) : null;
  const date = numeric === null
    ? new Date(value)
    : new Date(value.length === 10 ? numeric * 1000 : numeric);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function factureDesignationFromDevis(devis: FactureRow): string {
  const vehiculeLabel = [devis["marque"], devis["modele"]].filter(Boolean).join(" ");
  const message = String(devis["message"] ?? "");
  const plateau = /^Transport sur plateau\s*:\s*oui/im.test(message);
  const prestationLabel = message.match(/^Libell[ée] prestation\s*:\s*(.+)$/im)?.[1]?.trim();
  const prestation = plateau
    ? prestationLabel || "Transport sur plateau porte-voiture"
    : "Convoyage automobile par conducteur professionnel";
  return [
    prestation,
    vehiculeLabel || null,
    (() => {
      const opt = String(devis["option_trajet"] ?? "").toLowerCase();
      if (/recharge/.test(opt)) return "Recharge uniquement";
      return /aller[-_ ]?retour|restitution/.test(opt) ? "restitution et livraison" : "Livraison simple";
    })(),
  ]
    .filter(Boolean)
    .join(" — ");
}

/**
 * `payment_links.mission_id` (et d'autres écrans) référencent parfois une
 * attribution plutôt qu'une ligne `missions`. On distingue les deux avant
 * d'écrire les clés étrangères de la facture.
 */
export async function resolveFactureLinks(id: string | null | undefined): Promise<{
  missionId: string | null;
  attributionId: string | null;
}> {
  if (!id) return { missionId: null, attributionId: null };
  const { data: mission } = await supabaseAdmin
    .from("missions")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (mission) return { missionId: id, attributionId: null };
  const { data: attr } = await supabaseAdmin
    .from("attributions")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (attr) return { missionId: null, attributionId: id };
  return { missionId: null, attributionId: null };
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

  const links = await resolveFactureLinks(options.missionId ?? null);
  const attributionId = options.attributionId ?? links.attributionId;

  const existing = await findFactureForDevis(devis, options.sessionId ?? null);
  if (existing) {
    // Une facture déjà créée reste synchronisée avec la dernière version du devis.
    const paidAt = normalizePaidAt(options.paidAt ?? existing["paid_at"] ?? null);
    const patch: Record<string, unknown> = {
      designation: factureDesignationFromDevis(devis),
      depart: devis["depart"] ?? existing["depart"] ?? null,
      arrivee: devis["arrivee"] ?? existing["arrivee"] ?? null,
      mode_paiement: options.modePaiement ?? existing["mode_paiement"] ?? "Carte bancaire",
      date_paiement: paidAt.slice(0, 10),
      paid_at: paidAt,
      statut: "payee",
      pdf_url: null,
      updated_at: new Date().toISOString(),
    };
    if (links.missionId && !existing["mission_id"]) patch["mission_id"] = links.missionId;
    if (attributionId && !existing["attribution_id"]) patch["attribution_id"] = attributionId;
    const { data: refreshed } = await supabaseAdmin
      .from("factures")
      .update(patch as never)
      .eq("id", existing["id"])
      .select("*")
      .maybeSingle();
    return (refreshed ?? { ...existing, ...patch }) as FactureRow;
  }


  const amountCents = Number(options.amountCents ?? 0);
  const prixTtc = Number(devis["prix_estime"] ?? (amountCents ? amountCents / 100 : 0));
  const prixHt = Math.round((prixTtc / 1.2) * 100) / 100;
  const prixTva = Math.round((prixTtc - prixHt) * 100) / 100;
  const factureNumero = /^DEV-TLG-\d{4}-#?\d{3}$/.test(devis["numero"] ?? "")
    ? String(devis["numero"]).replace("DEV-TLG", "FAC-TLG")
    : undefined;
  const designation = factureDesignationFromDevis(devis);
  const paidAt = normalizePaidAt(options.paidAt);

  const { data: inserted, error } = await supabaseAdmin
    .from("factures")
    .insert({
      ...(factureNumero && { numero: factureNumero }),
      mission_id: links.missionId ?? devis["mission_id"] ?? null,
      attribution_id: attributionId,

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
      mode_paiement: options.modePaiement ?? "Carte bancaire",
      date_paiement: paidAt.slice(0, 10),
      paid_at: paidAt,
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

  const paidAt = normalizePaidAt(options.paidAt ?? facture["paid_at"] ?? null);
  const patch = {
    statut: "payee",
    mode_paiement: options.modePaiement ?? facture["mode_paiement"] ?? "Carte bancaire",
    date_paiement: paidAt.slice(0, 10),
    paid_at: paidAt,
    amount_paid_cents: options.amountCents ?? facture["amount_paid_cents"] ?? null,
    pdf_url: null,
    updated_at: new Date().toISOString(),
  };
  await supabaseAdmin.from("factures").update(patch as never).eq("id", factureId);

  await sendFactureDisponibleEmail({ ...facture, ...patch });
}

/**
 * Crée (ou retrouve) la facture payée d'une mission (attribution), même sans
 * devis rattaché : les informations sont reprises sur le trajet.
 */
export async function ensureFactureForMission(
  missionId: string,
  options: EnsureFactureOptions = {},
): Promise<FactureRow | null> {
  if (!missionId) return null;

  const links = await resolveFactureLinks(missionId);

  const { data: existing } = await supabaseAdmin
    .from("factures")
    .select("*")
    .or(`mission_id.eq.${missionId},attribution_id.eq.${missionId}`)
    .limit(1)
    .maybeSingle();
  if (existing) return existing as FactureRow;

  const { data: attr } = await supabaseAdmin
    .from("attributions")
    .select("id, numero_mission, trajet_id, trajets(*)")
    .eq("id", missionId)
    .maybeSingle();
  const trajet = (attr as any)?.trajets as Record<string, any> | null;
  if (!trajet) return null;


  if (trajet["devis_id"]) {
    const { data: devis } = await supabaseAdmin
      .from("devis")
      .select("*")
      .eq("id", trajet["devis_id"])
      .maybeSingle();
    if (devis) {
      return ensureFactureForDevis(devis as FactureRow, {
        ...options,
        missionId: links.missionId,
        attributionId: links.attributionId,
      });
    }
  }

  const amountCents = Number(options.amountCents ?? 0);
  const prixTtc = Number(
    trajet["prix_client"] ?? trajet["prix"] ?? (amountCents ? amountCents / 100 : 0),
  );
  const prixHt = Math.round((prixTtc / 1.2) * 100) / 100;
  const prixTva = Math.round((prixTtc - prixHt) * 100) / 100;
  const vehiculeLabel = [trajet["marque"], trajet["modele"]].filter(Boolean).join(" ");
  const prestation = trajet["non_roulant"]
    ? "Transport sur plateau porte-voiture"
    : "Convoyage automobile par conducteur professionnel";
  const numeroMission =
    (attr as any)?.numero_mission ?? trajet["numero_mission"] ?? null;
  const paidAt = normalizePaidAt(options.paidAt);

  const { data: inserted, error } = await supabaseAdmin
    .from("factures")
    .insert({
      mission_id: links.missionId,
      attribution_id: links.attributionId,
      client_email: trajet["client_email"] ?? "",
      client_nom: trajet["client_nom"] ?? "Client",

      type_facture: "particulier",
      date_mission: trajet["date_trajet"] ?? null,
      depart: trajet["depart"] ?? null,
      arrivee: trajet["arrivee"] ?? null,
      designation: [prestation, vehiculeLabel || null]
        .filter(Boolean)
        .join(" — "),
      reference_label: numeroMission ? "Mission" : trajet["commande_ref"] ? "N° de PO" : null,
      reference_client: numeroMission ?? trajet["commande_ref"] ?? null,
      prix_ht: prixHt,
      tva_taux: 20,
      prix_tva: prixTva,
      prix_ttc: prixTtc,
      statut: "payee",
      mode_paiement: options.modePaiement ?? "Carte bancaire",
      date_paiement: paidAt.slice(0, 10),
      paid_at: paidAt,
      amount_paid_cents: amountCents || Math.round(prixTtc * 100),
    } as never)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("[facture-auto] insert mission error", error.message);
    return null;
  }
  return (inserted ?? null) as FactureRow | null;
}
