/**
 * Fonctions pures de calcul et de formatage.
 * Aucune dépendance React → utilisable côté server (PDF, emails).
 */
import type {
  PriceComputation,
  Regime,
  VatBreakdownLine,
  VatRate,
} from "./types";

/** Arrondi centimes. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Calcule HT / TVA / TTC à partir d'un montant saisi.
 *
 * - `micro` : le montant saisi EST le TTC, aucune TVA. HT = TTC, TVA = 0.
 * - `societe` : le montant saisi est le HT. TVA = HT × rate. TTC = HT + TVA.
 *
 * Rétrocompatibilité : un `regimeSnapshot` null → traité comme `micro`.
 */
export function computePrice(
  amount: number,
  opts: { regime?: Regime | null; vatRate?: number } = {},
): PriceComputation {
  const regime: Regime = opts.regime ?? "micro";
  const rate = opts.vatRate ?? 0;

  if (regime === "micro") {
    return {
      regime: "micro",
      totalHt: round2(amount),
      totalTva: 0,
      totalTtc: round2(amount),
      vatBreakdown: [],
    };
  }

  const ht = round2(amount);
  const tva = round2(ht * (rate / 100));
  const ttc = round2(ht + tva);
  const breakdown: VatBreakdownLine[] = rate > 0
    ? [{ rate, base: ht, amount: tva }]
    : [];

  return { regime: "societe", totalHt: ht, totalTva: tva, totalTtc: ttc, vatBreakdown: breakdown };
}

/**
 * Formate un montant pour affichage.
 * Par défaut affiche le TTC (ce que le client paye).
 */
export type FormatMoneyOptions = {
  currency?: string;
  locale?: string;
  /** Force l'affichage HT au lieu du TTC. */
  showHt?: boolean;
  /** Cache le symbole monétaire. */
  hideCurrency?: boolean;
  /** Nombre de décimales (défaut 2). */
  decimals?: number;
};

export function formatMoney(
  amount: number | null | undefined,
  opts: FormatMoneyOptions = {},
): string {
  const { currency = "EUR", locale = "fr-FR", hideCurrency = false, decimals = 2 } = opts;
  const value = Number.isFinite(amount as number) ? (amount as number) : 0;
  if (hideCurrency) {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  }
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Formate le total à afficher pour un devis/facture existant, en respectant
 * son snapshot. Fallback : ancien montant = TTC micro.
 */
export function formatDocumentTotal(
  doc: {
    total_ttc?: number | null;
    total_ht?: number | null;
    montant?: number | null;
    regime_snapshot?: string | null;
  },
  opts: FormatMoneyOptions = {},
): string {
  const showHt = opts.showHt ?? false;
  const raw = showHt
    ? (doc.total_ht ?? doc.total_ttc ?? doc.montant ?? 0)
    : (doc.total_ttc ?? doc.montant ?? 0);
  return formatMoney(raw, opts);
}

/** Récupère le taux marqué par défaut, avec fallback 20 %. */
export function pickDefaultVatRate(rates: VatRate[] | undefined | null): number {
  const active = (rates ?? []).filter((r) => r.isActive);
  const def = active.find((r) => r.isDefault);
  return def?.rate ?? 20;
}
