/**
 * Socle partagé de l'espace financier convoyeurs.
 *
 * Règle d'or : un montant dû à un convoyeur est TOUJOURS décomposable
 * (base + kilométrage + primes + ajustements). Les libellés de statut sont
 * centralisés ici pour être strictement identiques côté admin et côté app
 * convoyeur.
 */

export type RemuStatut = "en_attente" | "a_valider" | "valide" | "paye" | "litige" | "annule";
export type PaiementStatut = "prepare" | "envoye" | "confirme" | "echoue" | "annule";
export type AjustementCategorie = "bonus" | "penalite" | "ajout_libre" | "deduction_libre" | "frais";
export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "primary" | "purple";

export const REMU_STATUT_LABEL: Record<RemuStatut, string> = {
  en_attente: "En attente",
  a_valider: "À valider",
  valide: "Validé",
  paye: "Payé",
  litige: "En litige",
  annule: "Annulé",
};

export const REMU_STATUT_TONE: Record<RemuStatut, BadgeTone> = {
  en_attente: "warning",
  a_valider: "purple",
  valide: "info",
  paye: "success",
  litige: "danger",
  annule: "neutral",
};

export const PAIEMENT_STATUT_LABEL: Record<PaiementStatut, string> = {
  prepare: "Préparé",
  envoye: "Envoyé",
  confirme: "Confirmé",
  echoue: "Échoué",
  annule: "Annulé",
};

export const PAIEMENT_STATUT_TONE: Record<PaiementStatut, BadgeTone> = {
  prepare: "warning",
  envoye: "info",
  confirme: "success",
  echoue: "danger",
  annule: "neutral",
};

export const AJUSTEMENT_LABEL: Record<AjustementCategorie, string> = {
  bonus: "Bonus",
  penalite: "Pénalité",
  ajout_libre: "Ajout libre",
  deduction_libre: "Déduction libre",
  frais: "Frais annexes",
};

export const SOURCE_CALCUL_LABEL: Record<string, string> = {
  regle: "Règle de rémunération",
  prix_negocie: "Prix convoyeur négocié",
  manuel: "Saisie manuelle validée",
  aucune_regle: "Aucune règle applicable",
};

export interface CatalogPenalite {
  id: string;
  code: string | null;
  libelle: string;
  description: string | null;
  type_montant: "forfait" | "pourcentage";
  valeur: number;
  article_reference: string | null;
  actif: boolean;
}

export interface RegleRemuneration {
  id: string;
  libelle: string;
  type_regle: "km" | "forfait" | "forfait_km";
  montant_forfait: number;
  taux_km: number;
  seuil_km: number;
  montant_min: number | null;
  cond_vehicule_type: string | null;
  cond_type_mission: string | null;
  cond_zone: string | null;
  cond_distance_min: number | null;
  cond_distance_max: number | null;
  priorite: number;
  actif: boolean;
  date_debut: string;
  date_fin: string | null;
  notes: string | null;
}

export interface Ajustement {
  id: string;
  remuneration_id: string;
  categorie: AjustementCategorie;
  penalite_id: string | null;
  libelle: string;
  motif: string;
  article_reference: string | null;
  incident_id: string | null;
  justificatif_url: string | null;
  montant: number;
  annule: boolean;
  annulation_motif: string | null;
  annule_at: string | null;
  created_at: string;
}

export interface Remuneration {
  id: string;
  trajet_id: string;
  attribution_id: string | null;
  convoyeur_id: string | null;
  numero_mission: string | null;
  date_mission: string | null;
  regle_id: string | null;
  source_calcul: string;
  distance_km: number | null;
  base_forfait: number;
  base_km_montant: number;
  primes: number;
  frais_annexes: number;
  total_ajustements: number;
  montant_base: number;
  montant_total: number;
  statut: RemuStatut;
  calcul_detail: Record<string, unknown> | null;
  paiement_id: string | null;
  calcule_at: string;
  notes: string | null;
  created_at: string;
}

export interface PaiementConvoyeur {
  id: string;
  numero: string | null;
  convoyeur_id: string;
  montant_total: number;
  nb_missions: number;
  methode: string;
  statut: PaiementStatut;
  periode_debut: string | null;
  periode_fin: string | null;
  date_execution: string | null;
  reference_bancaire: string | null;
  facture_numero: string | null;
  facture_url: string | null;
  notes: string | null;
  created_at: string;
}

export const eur = (n: number | null | undefined) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(n ?? 0));

export const dateFr = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("fr-FR") : "—";

/** Décomposition lisible d'une rémunération (identique admin / convoyeur). */
export function decomposer(remu: Remuneration, ajustements: Ajustement[]) {
  const lignes: { label: string; detail?: string; montant: number }[] = [];
  if (remu.base_forfait) {
    lignes.push({
      label: remu.source_calcul === "prix_negocie" ? "Prix convoyeur négocié" : "Forfait de base",
      montant: Number(remu.base_forfait),
    });
  }
  if (remu.base_km_montant) {
    lignes.push({
      label: "Kilométrage",
      detail: remu.distance_km ? `${remu.distance_km} km` : undefined,
      montant: Number(remu.base_km_montant),
    });
  }
  if (remu.primes) lignes.push({ label: "Primes", montant: Number(remu.primes) });
  if (remu.frais_annexes) lignes.push({ label: "Frais annexes", montant: Number(remu.frais_annexes) });
  for (const a of ajustements.filter((x) => !x.annule)) {
    lignes.push({
      label: `${AJUSTEMENT_LABEL[a.categorie]} — ${a.libelle}`,
      detail: [a.motif, a.article_reference].filter(Boolean).join(" · "),
      montant: Number(a.montant),
    });
  }
  return lignes;
}

/* ============ Exports comptables ============ */

function csvEscape(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Record<string, unknown>[], headers: string[]): string {
  const head = headers.join(";");
  const body = rows.map((r) => headers.map((h) => csvEscape(r[h])).join(";")).join("\n");
  return `\uFEFF${head}\n${body}`;
}

export function downloadFile(content: string, filename: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export interface SepaLine {
  nom: string;
  iban: string;
  bic?: string | null;
  montant: number;
  libelle: string;
}

/** Virement SEPA groupé (pain.001.001.03) — importable dans la plupart des banques. */
export function buildSepaXml(opts: {
  debiteurNom: string;
  debiteurIban: string;
  debiteurBic?: string;
  executionDate: string; // YYYY-MM-DD
  lignes: SepaLine[];
}): string {
  const id = `LIGNEO-${Date.now()}`;
  const total = opts.lignes.reduce((s, l) => s + l.montant, 0);
  const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));
  const tx = opts.lignes
    .map(
      (l, i) => `      <CdtTrfTxInf>
        <PmtId><EndToEndId>${esc(id)}-${i + 1}</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="EUR">${l.montant.toFixed(2)}</InstdAmt></Amt>
        ${l.bic ? `<CdtrAgt><FinInstnId><BIC>${esc(l.bic)}</BIC></FinInstnId></CdtrAgt>` : ""}
        <Cdtr><Nm>${esc(l.nom)}</Nm></Cdtr>
        <CdtrAcct><Id><IBAN>${esc(l.iban.replace(/\s+/g, ""))}</IBAN></Id></CdtrAcct>
        <RmtInf><Ustrd>${esc(l.libelle).slice(0, 140)}</Ustrd></RmtInf>
      </CdtTrfTxInf>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${id}</MsgId>
      <CreDtTm>${new Date().toISOString().slice(0, 19)}</CreDtTm>
      <NbOfTxs>${opts.lignes.length}</NbOfTxs>
      <CtrlSum>${total.toFixed(2)}</CtrlSum>
      <InitgPty><Nm>${esc(opts.debiteurNom)}</Nm></InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${id}-PMT</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <NbOfTxs>${opts.lignes.length}</NbOfTxs>
      <CtrlSum>${total.toFixed(2)}</CtrlSum>
      <ReqdExctnDt>${opts.executionDate}</ReqdExctnDt>
      <Dbtr><Nm>${esc(opts.debiteurNom)}</Nm></Dbtr>
      <DbtrAcct><Id><IBAN>${esc(opts.debiteurIban.replace(/\s+/g, ""))}</IBAN></Id></DbtrAcct>
      ${opts.debiteurBic ? `<DbtrAgt><FinInstnId><BIC>${esc(opts.debiteurBic)}</BIC></FinInstnId></DbtrAgt>` : "<DbtrAgt><FinInstnId/></DbtrAgt>"}
      <ChrgBr>SLEV</ChrgBr>
${tx}
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;
}
