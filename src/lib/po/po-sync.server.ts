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
  if (subject && /avis de paiement\s+groupe\s+cat/i.test(subject)) {
    result.skipped++;
    await supabaseAdmin.from("po_import_logs").insert({
      email_id: id, email_subject: subject, resultat: "ignore",
      details: { raison: "avis de paiement (traité séparément)" },
    } as never);
    return;
  }

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

  // 0) Le n° de PO est peut-être déjà saisi à la main sur une mission / attribution :
  //    dans ce cas le bon de commande est considéré comme rapproché sans ambiguïté.
  const existing = await findOperationsByPoNumber(supabaseAdmin, numeroPo);
  if (existing.trajetIds.length) {
    await supabaseAdmin
      .from("bons_commande")
      .update({
        statut: "rapproche",
        candidats: [],
        ...(existing.devisId ? { devis_id: existing.devisId } : {}),
        ...(existing.missionId ? { mission_id: existing.missionId } : {}),
      } as never)
      .eq("id", poId);
    await applyPoToOperations(supabaseAdmin, numeroPo, existing.devisId, vin);
    console.log(`[PO] ${numeroPo} déjà présent sur ${existing.trajetIds.length} mission(s) → rapproché`);
    return "rapproche";
  }


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
    const applied = await applyPoToOperations(supabaseAdmin, numeroPo, devis.id as string, vin);
    if (applied.missionId) {
      await supabaseAdmin
        .from("bons_commande")
        .update({ mission_id: applied.missionId } as never)
        .eq("id", poId);
    }
    console.log(`[PO] ${numeroPo} rapproché au devis ${devis.numero} (${applied.trajets} mission(s))`);
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

  // Aucun devis : la mission existe parfois sans devis (créée à la main).
  // On tente le rattachement direct par VIN sur les missions.
  const applied = await applyPoToOperations(supabaseAdmin, numeroPo, null, vin);
  if (applied.missionId) {
    await supabaseAdmin
      .from("bons_commande")
      .update({ statut: "rapproche", mission_id: applied.missionId, candidats: [] } as never)
      .eq("id", poId);
    return "rapproche";
  }

  await supabaseAdmin
    .from("bons_commande")
    .update({ statut: "non_rapproche", candidats: [] } as never)
    .eq("id", poId);
  return "non_rapproche";
}

/**
 * Écrit le n° de PO là où l'exploitation en a besoin :
 *  - `trajets.commande_ref` (toutes les étapes du même groupe aller/retour)
 *  - références des factures non payées liées à ces missions
 * Recherche par devis rattaché, puis par VIN (loose match).
 */
export async function applyPoToOperations(
  supabaseAdmin: AdminClient,
  numeroPo: string,
  devisId: string | null,
  vin: string | null,
): Promise<{ trajets: number; missionId: string | null }> {
  const cols = "id, mission_group_id, vin, vehicule_vin, mission_id, devis_id, commande_ref";
  const found = new Map<string, Record<string, unknown>>();

  const vins = new Set<string>();
  if (vin) vins.add(vin);

  if (devisId) {
    const { data } = await supabaseAdmin.from("trajets").select(cols).eq("devis_id", devisId);
    for (const t of data ?? []) found.set(t.id as string, t);
    // Le VIN du devis peut différer légèrement de celui du PO : on l'ajoute au filet.
    const { data: dev } = await supabaseAdmin
      .from("devis").select("vin, vin_retour").eq("id", devisId).maybeSingle();
    for (const v of [dev?.vin, dev?.vin_retour]) if (v) vins.add(v as string);
  }

  if (vins.size) {
    const { data } = await supabaseAdmin
      .from("trajets")
      .select(cols)
      .order("created_at", { ascending: false })
      .limit(1500);
    for (const t of data ?? []) {
      for (const v of vins) {
        if (
          vinLooseMatch(t.vin as string | null, v) ||
          vinLooseMatch(t.vehicule_vin as string | null, v)
        ) {
          found.set(t.id as string, t);
          break;
        }
      }
    }
  }
  if (!found.size) return { trajets: 0, missionId: null };

  const rows = [...found.values()];
  const groupIds = [...new Set(rows.map((r) => r["mission_group_id"] as string | null).filter(Boolean))] as string[];
  const trajetIds = [...found.keys()];

  await supabaseAdmin.from("trajets").update({ commande_ref: numeroPo } as never).in("id", trajetIds);
  if (groupIds.length) {
    await supabaseAdmin
      .from("trajets")
      .update({ commande_ref: numeroPo } as never)
      .in("mission_group_id", groupIds);
  }

  // Références des factures liées (via les attributions de ces missions)
  const { data: attrs } = await supabaseAdmin
    .from("attributions")
    .select("id")
    .in("trajet_id", trajetIds);
  const attrIds = (attrs ?? []).map((a) => a.id as string);
  if (attrIds.length) {
    await supabaseAdmin
      .from("factures")
      .update({ reference_client: numeroPo, reference_label: "N° de PO" } as never)
      .in("attribution_id", attrIds)
      .not("statut", "in", "(payee,annulee)");
  }

  const missionIds = [...new Set(rows.map((r) => r["mission_id"] as string | null).filter(Boolean))] as string[];
  console.log(`[PO] ${numeroPo} appliqué à ${trajetIds.length} mission(s)`);
  return { trajets: trajetIds.length, missionId: missionIds.length === 1 ? missionIds[0]! : null };
}

/** Cherche les missions/trajets qui portent déjà ce n° de PO (saisi à la main). */
export async function findOperationsByPoNumber(
  supabaseAdmin: AdminClient,
  numeroPo: string,
): Promise<{ trajetIds: string[]; devisId: string | null; missionId: string | null }> {
  const ref = numeroPo.trim();
  if (!ref) return { trajetIds: [], devisId: null, missionId: null };

  const { data: trajets } = await supabaseAdmin
    .from("trajets")
    .select("id, devis_id, mission_id")
    .eq("commande_ref", ref);

  let rows = trajets ?? [];

  if (!rows.length) {
    // Le PO peut n'exister que sur la facture / l'attribution
    const { data: factures } = await supabaseAdmin
      .from("factures")
      .select("attribution_id")
      .eq("reference_client", ref)
      .not("attribution_id", "is", null);
    const attrIds = [...new Set((factures ?? []).map((f) => f.attribution_id as string))];
    if (attrIds.length) {
      const { data: attrs } = await supabaseAdmin
        .from("attributions").select("trajet_id").in("id", attrIds);
      const trajetIds = [...new Set((attrs ?? []).map((a) => a.trajet_id as string).filter(Boolean))];
      if (trajetIds.length) {
        const { data: t2 } = await supabaseAdmin
          .from("trajets").select("id, devis_id, mission_id").in("id", trajetIds);
        rows = t2 ?? [];
      }
    }
  }

  if (!rows.length) return { trajetIds: [], devisId: null, missionId: null };
  const devisIds = [...new Set(rows.map((r) => r.devis_id as string | null).filter(Boolean))] as string[];
  const missionIds = [...new Set(rows.map((r) => r.mission_id as string | null).filter(Boolean))] as string[];
  return {
    trajetIds: rows.map((r) => r.id as string),
    devisId: devisIds.length === 1 ? devisIds[0]! : null,
    missionId: missionIds.length === 1 ? missionIds[0]! : null,
  };
}

/**
 * Passe de fiabilisation : rejoue le rapprochement des PO en attente et
 * réécrit le n° de PO sur les missions créées après coup (devis converti
 * en mission une fois le bon de commande importé).
 */
export async function reconcileAllPo(): Promise<{ rapproches: number; reappliques: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const out = { rapproches: 0, reappliques: 0 };

  const { data: rows } = await supabaseAdmin
    .from("bons_commande")
    .select("id, numero_po, vin, statut, devis_id, mission_id")
    .in("statut", ["non_rapproche", "rapproche"])
    .order("created_at", { ascending: false })
    .limit(120);

  for (const po of rows ?? []) {
    const numero = po.numero_po as string;
    const vin = (po.vin as string | null) ?? null;
    try {
      if (po.statut === "non_rapproche") {
        if (!vin) continue;
        const outcome = await matchPoToDevis(supabaseAdmin, po.id as string, numero, vin);
        if (outcome === "rapproche") out.rapproches++;
        continue;
      }
      // Déjà rapproché : s'assurer que le n° est bien écrit côté exploitation.
      const already = await findOperationsByPoNumber(supabaseAdmin, numero);
      if (already.trajetIds.length) {
        if (!po.mission_id && already.missionId) {
          await supabaseAdmin
            .from("bons_commande")
            .update({ mission_id: already.missionId } as never)
            .eq("id", po.id as string);
        }
        continue;
      }
      const applied = await applyPoToOperations(
        supabaseAdmin, numero, (po.devis_id as string | null) ?? null, vin,
      );
      if (applied.trajets) {
        out.reappliques++;
        if (applied.missionId && !po.mission_id) {
          await supabaseAdmin
            .from("bons_commande")
            .update({ mission_id: applied.missionId } as never)
            .eq("id", po.id as string);
        }
      }
    } catch (err) {
      console.error("[PO] reconcile échoué", numero, err);
    }
  }

  return out;
}



// ─────────────────────────────────────────────────────────────────────────────
// Avis de paiement GROUPE CAT (même libellé Gmail) → factures marquées payées
// ─────────────────────────────────────────────────────────────────────────────

const AVIS_SUBJECT_RE = /avis de paiement\s+groupe\s+cat\s+du\s+(\d{2})\.(\d{2})\.(\d{4})/i;

export type AvisSyncResult = {
  avis_traites: number;
  factures_payees: number;
  deja_payees: number;
  a_verifier: number;
  messages: string[];
};

/** Extrait les numéros de facture (colonne « Vos Réf. ») — ignore « Total Virement ». */
export function extractFactureNumbers(text: string): { numero: string; key: string }[] {
  const out = new Map<string, { numero: string; key: string }>();
  for (const line of text.split(/\r?\n/)) {
    if (/total\s+virement/i.test(line) && !/TLG-\d{4}/i.test(line)) continue;
    const re = /\b([A-Z]{1,4})\s*-\s*TLG\s*-\s*(\d{4})\s*-\s*#?\s*(\d{1,6})\b/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      const key = `TLG-${m[2]}-#${Number(m[3])}`;
      if (!out.has(key)) out.set(key, { numero: `${m[1].toUpperCase()}-${key}`, key });
    }
  }
  return [...out.values()];
}

async function findFacture(supabaseAdmin: AdminClient, key: string) {
  // Le PDF (et les lignes déjà enregistrées) peuvent indiquer #84 alors que la facture est #084.
  // Chercher les deux formes ensemble pour ne jamais payer une facture en cas d'ambiguïté.
  const match = /^TLG-(\d{4})-#(\d{1,6})$/.exec(key);
  const paddedKey = match ? `TLG-${match[1]}-#${match[2].padStart(3, "0")}` : key;
  const candidates = [...new Set([key, paddedKey])];
  const { data } = await supabaseAdmin
    .from("factures")
    .select("id, numero, statut")
    .or(candidates.map((candidate) => `numero.ilike.%${candidate}`).join(","))
    .limit(2);
  return data && data.length === 1 ? data[0] : null;
}

async function markPaid(supabaseAdmin: AdminClient, factureId: string, dateAvis: string | null) {
  await supabaseAdmin
    .from("factures")
    .update({
      statut: "payee",
      date_paiement: dateAvis ?? new Date().toISOString().slice(0, 10),
      paid_at: new Date().toISOString(),
      mode_paiement: "virement",
    } as never)
    .eq("id", factureId)
    .neq("statut", "payee");
}

export async function syncAvisPaiementFromGmail(maxMessages = 30): Promise<AvisSyncResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const result: AvisSyncResult = { avis_traites: 0, factures_payees: 0, deja_payees: 0, a_verifier: 0, messages: [] };

  // 1) Relance la file « à vérifier » : une facture créée depuis peut maintenant correspondre.
  const { data: pending } = await supabaseAdmin
    .from("avis_paiement_lignes")
    .select("id, numero_facture, date_avis")
    .eq("resultat", "a_verifier");
  for (const p of pending ?? []) {
    const key = p.numero_facture.replace(/^[A-Z]{1,4}-/i, "");
    const f = await findFacture(supabaseAdmin, key);
    if (!f) continue;
    if (f.statut !== "payee") { await markPaid(supabaseAdmin, f.id, p.date_avis); result.factures_payees++; }
    await supabaseAdmin.from("avis_paiement_lignes").update({ resultat: "resolu", facture_id: f.id } as never).eq("id", p.id);
  }

  const labelId = await resolveLabelId();
  if (!labelId) return result;
  const q = encodeURIComponent('subject:"Avis de paiement GROUPE CAT"');
  const list = await gmailGet<{ messages?: { id: string }[] }>(
    `/users/me/messages?labelIds=${encodeURIComponent(labelId)}&q=${q}&maxResults=${Math.min(maxMessages, 100)}`,
  );
  const ids = (list.messages ?? []).map((m) => m.id);
  if (!ids.length) return result;

  const { data: done } = await supabaseAdmin.from("avis_paiement_emails").select("email_id").in("email_id", ids);
  const doneSet = new Set((done ?? []).map((r) => r.email_id));

  for (const id of ids) {
    if (doneSet.has(id)) continue;
    let subject: string | null = null;
    try {
      const msg = await gmailGet<GmailMessage>(`/users/me/messages/${id}?format=full`);
      subject = headerValue(msg, "Subject");
      const sm = subject ? AVIS_SUBJECT_RE.exec(subject) : null;
      if (!sm) continue; // pas un avis de paiement : laissé au flux PO
      const dateAvis = `${sm[3]}-${sm[2]}-${sm[1]}`;

      const pdfPart = flattenParts(msg.payload).find(
        (p) => /\.pdf$/i.test(p.filename ?? "") && p.body?.attachmentId &&
          /avis\s*de\s*paiement/i.test(p.filename ?? ""),
      ) ?? flattenParts(msg.payload).find((p) => /\.pdf$/i.test(p.filename ?? "") && p.body?.attachmentId);
      if (!pdfPart) throw new Error("pièce jointe « Avis de paiement » introuvable");

      const att = await gmailGet<{ data?: string }>(`/users/me/messages/${id}/attachments/${pdfPart.body!.attachmentId}`);
      if (!att.data) throw new Error("pièce jointe vide");
      const text = await pdfToText(base64UrlToBytes(att.data));
      const numbers = extractFactureNumbers(text);

      for (const n of numbers) {
        const f = await findFacture(supabaseAdmin, n.key);
        let resultat: "payee" | "deja_payee" | "a_verifier";
        if (!f) { resultat = "a_verifier"; result.a_verifier++; }
        else if (f.statut === "payee") { resultat = "deja_payee"; result.deja_payees++; }
        else { await markPaid(supabaseAdmin, f.id, dateAvis); resultat = "payee"; result.factures_payees++; }
        await supabaseAdmin.from("avis_paiement_lignes").upsert({
          email_id: id, email_subject: subject, date_avis: dateAvis,
          numero_facture: n.numero, facture_id: f?.id ?? null, resultat,
        } as never, { onConflict: "email_id,numero_facture", ignoreDuplicates: true });
      }
      await supabaseAdmin.from("avis_paiement_emails").insert({
        email_id: id, email_subject: subject, nb_lignes: numbers.length,
        erreur: numbers.length ? null : "aucun numéro de facture trouvé",
      } as never);
      result.avis_traites++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[AVIS] traitement échoué", id, message);
      result.messages.push(`Avis ${subject ?? id} : ${message}`);
    }
  }
  if (result.avis_traites) {
    result.messages.push(
      `${result.avis_traites} avis de paiement · ${result.factures_payees} facture(s) payée(s) · ${result.a_verifier} à vérifier`,
    );
  }
  return result;
}
