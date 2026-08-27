/**
 * Import automatique des bons de commande (PO) CAT / K2 depuis Gmail.
 * Serveur uniquement : jetons OAuth gérés par le connecteur Lovable (jamais côté client).
 */
import { extractPoNumber, parsePoDocument, type ParsedPo } from "@/lib/po/parse-po";
import { normalizeVin, vinLooseMatch } from "@/lib/vin";

const GATEWAY = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";
export const PO_LABEL_NAME = "Devis CAT FRANCE et PO K2";

/** Statuts de devis considérés « en attente de réponse » pour le rapprochement. */
const PENDING_DEVIS_STATUTS = ["envoye", "genere", "brouillon", "en_attente"];

type GmailPart = {
  filename?: string;
  mimeType?: string;
  partId?: string;
  body?: { attachmentId?: string; size?: number; data?: string };
  parts?: GmailPart[];
  headers?: { name: string; value: string }[];
};

type GmailMessage = {
  id: string;
  internalDate?: string;
  payload?: GmailPart & { headers?: { name: string; value: string }[] };
};

function gmailHeaders() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connKey = process.env["GOOGLE_MAIL_API_KEY"];
  if (!lovableKey || !connKey) {
    throw new Error("Connexion Gmail non configurée (LOVABLE_API_KEY / GOOGLE_MAIL_API_KEY manquants)");
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connKey,
  };
}

async function gmailGet<T>(path: string): Promise<T> {
  const res = await fetch(`${GATEWAY}${path}`, { headers: gmailHeaders() });
  if (!res.ok) {
    const body = await res.text();
    console.error(`[PO] Gmail request failed [${res.status}] ${path}: ${body.slice(0, 500)}`);
    throw new Error(`Gmail: ${res.status} ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

async function resolveLabelId(): Promise<string | null> {
  const data = await gmailGet<{ labels?: { id: string; name: string }[] }>("/users/me/labels");
  const label = data.labels?.find((l) => l.name.trim().toLowerCase() === PO_LABEL_NAME.toLowerCase());
  return label?.id ?? null;
}

function headerValue(msg: GmailMessage, name: string): string | null {
  const h = msg.payload?.headers?.find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h?.value ?? null;
}

function flattenParts(part: GmailPart | undefined, out: GmailPart[] = []): GmailPart[] {
  if (!part) return out;
  out.push(part);
  for (const p of part.parts ?? []) flattenParts(p, out);
  return out;
}

function base64UrlToBytes(data: string): Uint8Array {
  const b64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function pdfToText(bytes: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const doc = await getDocumentProxy(bytes);
  const { text } = await extractText(doc, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}

export type SyncResult = {
  scanned: number;
  imported: number;
  rapproches: number;
  ambigus: number;
  erreurs: number;
  skipped: number;
  messages: string[];
};

/**
 * Parcourt les emails du label CAT, extrait chaque PO et tente le rapprochement.
 * Idempotent : un email déjà importé (email_source_id) ou un PO déjà en base est ignoré.
 */
export async function syncPoFromGmail(maxMessages = 25): Promise<SyncResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const result: SyncResult = {
    scanned: 0, imported: 0, rapproches: 0, ambigus: 0, erreurs: 0, skipped: 0, messages: [],
  };

  const labelId = await resolveLabelId();
  if (!labelId) {
    result.messages.push(`Libellé Gmail « ${PO_LABEL_NAME} » introuvable.`);
    return result;
  }

  const list = await gmailGet<{ messages?: { id: string }[] }>(
    `/users/me/messages?labelIds=${encodeURIComponent(labelId)}&maxResults=${Math.min(maxMessages, 100)}`,
  );
  const ids = (list.messages ?? []).map((m) => m.id);
  if (!ids.length) return result;

  const { data: known } = await supabaseAdmin
    .from("bons_commande")
    .select("email_source_id")
    .in("email_source_id", ids);
  const alreadyImported = new Set((known ?? []).map((r) => r.email_source_id as string));

  const { data: loggedRows } = await supabaseAdmin
    .from("po_import_logs")
    .select("email_id, resultat")
    .in("email_id", ids);
  const permanentlySkipped = new Set(
    (loggedRows ?? [])
      .filter((r) => r.resultat === "ignore" || r.resultat === "erreur_extraction")
      .map((r) => r.email_id as string),
  );

  for (const id of ids) {
    result.scanned++;
    if (alreadyImported.has(id) || permanentlySkipped.has(id)) {
      result.skipped++;
      continue;
    }
    try {
      await processMessage(id, supabaseAdmin, result);
    } catch (err) {
      result.erreurs++;
      const message = err instanceof Error ? err.message : String(err);
      console.error("[PO] traitement email échoué", id, message);
      await supabaseAdmin.from("po_import_logs").insert({
        email_id: id, resultat: "erreur", details: { message },
      } as never);
    }
  }

  return result;
}

type AdminClient = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function processMessage(id: string, supabaseAdmin: AdminClient, result: SyncResult) {
  const msg = await gmailGet<GmailMessage>(`/users/me/messages/${id}?format=full`);
  const subject = headerValue(msg, "Subject");
  const receivedAt = msg.internalDate ? new Date(Number(msg.internalDate)).toISOString() : null;

  const parts = flattenParts(msg.payload);
  const pdfPart = parts.find(
    (p) => (p.filename ?? "").toLowerCase().endsWith(".pdf") && p.body?.attachmentId,
  );

  if (!pdfPart) {
    result.skipped++;
    await supabaseAdmin.from("po_import_logs").insert({
      email_id: id, email_subject: subject, resultat: "ignore",
      details: { raison: "aucune pièce jointe PDF" },
    } as never);
    return;
  }

  const att = await gmailGet<{ data?: string }>(
    `/users/me/messages/${id}/attachments/${pdfPart.body!.attachmentId}`,
  );
  if (!att.data) throw new Error("pièce jointe vide");
  const bytes = base64UrlToBytes(att.data);

  let parsed: ParsedPo;
  let rawText = "";
  try {
    rawText = await pdfToText(bytes);
    parsed = parsePoDocument(rawText, subject, pdfPart.filename);
  } catch (err) {
    console.error("[PO] extraction PDF échouée", id, err);
    parsed = {
      numero_po: extractPoNumber(subject, pdfPart.filename),
      vin: null, montant_ht: null, date_commande: null,
      date_livraison: null, destinataire: null, emetteur: null,
    };
  }

  const numero = parsed.numero_po;
  const vin = parsed.vin ? normalizeVin(parsed.vin) : null;

  // Champs obligatoires manquants → on classe en erreur d'extraction sans deviner.
  const extractionOk = !!numero && !!vin && vin.length >= 14;
  const statutInitial = extractionOk ? "non_rapproche" : "erreur_extraction";

  if (!numero) {
    result.erreurs++;
    await supabaseAdmin.from("po_import_logs").insert({
      email_id: id, email_subject: subject, resultat: "erreur_extraction",
      details: { raison: "numéro de commande introuvable", filename: pdfPart.filename },
    } as never);
    return;
  }

  // PO déjà connu (renvoi du même email) → on ne duplique pas.
  const { data: existing } = await supabaseAdmin
    .from("bons_commande").select("id").eq("numero_po", numero).maybeSingle();
  if (existing) {
    result.skipped++;
    await supabaseAdmin.from("po_import_logs").insert({
      email_id: id, email_subject: subject, numero_po: numero, resultat: "doublon",
    } as never);
    return;
  }

  // Stockage du PDF (bucket privé)
  const path = `${new Date().getUTCFullYear()}/${numero}.pdf`;
  const upload = await supabaseAdmin.storage
    .from("bons-commande")
    .upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (upload.error) console.error("[PO] upload PDF échoué", numero, upload.error.message);

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("bons_commande")
    .insert({
      numero_po: numero,
      vin,
      montant_ht: parsed.montant_ht,
      date_commande: parsed.date_commande,
      date_livraison: parsed.date_livraison,
      destinataire: parsed.destinataire,
      adresse_livraison: parsed.adresse_livraison ?? null,
      contact_livraison: parsed.contact_livraison ?? null,
      designation: parsed.designation ?? null,
      email_source_id: id,
      email_subject: subject,
      email_received_at: receivedAt,
      pdf_path: upload.error ? null : path,
      statut: statutInitial,
      extraction_error: extractionOk ? null : "VIN introuvable dans le PDF",
      raw_text: rawText.slice(0, 20000) || null,
    } as never)
    .select("id")
    .single();

  if (insertError || !inserted) throw new Error(insertError?.message ?? "insertion impossible");
  result.imported++;

  if (!extractionOk) {
    result.erreurs++;
    await supabaseAdmin.from("po_import_logs").insert({
      email_id: id, email_subject: subject, numero_po: numero, resultat: "erreur_extraction",
      details: { raison: "VIN introuvable" },
    } as never);
    return;
  }

  const outcome = await matchPoToDevis(supabaseAdmin, (inserted as { id: string }).id, numero, vin!);
  if (outcome === "rapproche") result.rapproches++;
  if (outcome === "ambigu") result.ambigus++;

  await supabaseAdmin.from("po_import_logs").insert({
    email_id: id, email_subject: subject, numero_po: numero, vin,
    resultat: outcome,
    details: { montant_ht: parsed.montant_ht, date_livraison: parsed.date_livraison },
  } as never);
}

export type MatchOutcome = "rapproche" | "non_rapproche" | "ambigu";

/**
 * Rapprochement strict : jamais de choix automatique en cas d'ambiguïté.
 * 1 devis 'envoyé' avec le même VIN → rapproché (devis passé en 'accepte')
 * 0 devis                          → non rapproché
 * N devis                          → ambigu (validation manuelle)
 */
export async function matchPoToDevis(
  supabaseAdmin: AdminClient,
  poId: string,
  numeroPo: string,
  vin: string,
): Promise<MatchOutcome> {
  const selectCols =
    "id, numero, created_at, prix_estime, nom, prenom, email, arrivee, statut, mission_id, vin, vin_retour";

  const { data: devisRows } = await supabaseAdmin
    .from("devis")
    .select(selectCols)
    .in("statut", PENDING_DEVIS_STATUTS)
    .order("created_at", { ascending: false });

  const byVin = (rows: typeof devisRows) =>
    (rows ?? []).filter(
      (d) => vinLooseMatch(d.vin as string | null, vin) || vinLooseMatch(d.vin_retour as string | null, vin),
    );

  let candidates = byVin(devisRows);
  let alreadyAccepted = false;

  // Le PO arrive parfois après la conversion du devis en mission : on rattache
  // quand même le bon de commande, sans toucher au statut du devis.
  if (candidates.length === 0) {
    const { data: allRows } = await supabaseAdmin
      .from("devis")
      .select(selectCols)
      .order("created_at", { ascending: false })
      .limit(1000);
    candidates = byVin(allRows);
    alreadyAccepted = candidates.length > 0;
  }

  if (candidates.length === 1) {
    const devis = candidates[0]!;
    await supabaseAdmin
      .from("bons_commande")
      .update({
        devis_id: devis.id,
        mission_id: (devis.mission_id as string | null) ?? null,
        statut: "rapproche",
        candidats: [],
      } as never)
      .eq("id", poId);
    if (!alreadyAccepted) {
      await supabaseAdmin
        .from("devis")
        .update({ statut: "accepte", accepted_at: new Date().toISOString() } as never)
        .eq("id", devis.id);
    }
    await applyPoToOperations(supabaseAdmin, numeroPo, devis.id as string, vin);
    console.log(`[PO] ${numeroPo} rapproché au devis ${devis.numero}`);
    return "rapproche";
  }



  if (candidates.length > 1) {
    await supabaseAdmin
      .from("bons_commande")
      .update({
        statut: "ambigu",
        candidats: candidates.map((d) => ({
          id: d.id, numero: d.numero, created_at: d.created_at,
          prix_estime: d.prix_estime, client: `${d.prenom ?? ""} ${d.nom ?? ""}`.trim(),
          arrivee: d.arrivee,
        })),
      } as never)
      .eq("id", poId);
    return "ambigu";
  }

  await supabaseAdmin
    .from("bons_commande")
    .update({ statut: "non_rapproche", candidats: [] } as never)
    .eq("id", poId);
  return "non_rapproche";
}
