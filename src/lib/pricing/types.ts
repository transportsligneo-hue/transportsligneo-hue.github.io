/**
 * Module unique de tarification pour toute la plateforme.
 *
 * Source unique de vérité : la table `pricing_settings` détermine si l'on est
 * en régime **micro-entreprise** (prix saisis = TTC, aucune TVA calculée) ou
 * en régime **société assujettie à la TVA** (prix HT + TVA multi-taux).
 *
 * Les devis et factures figent leur régime dans `regime_snapshot`. Un ancien
 * document sans snapshot est interprété en `micro` (montant existant = TTC),
 * ce qui garantit zéro régression sur l'historique.
 */

export type Regime = "micro" | "societe";

export type VatRate = {
  id: string;
  rate: number;         // 20, 10, 5.5, 0
  label: string;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
};

export type PricingSettings = {
  regime: Regime;
  defaultVatRate: number;
  currency: string;
};

export type VatBreakdownLine = {
  rate: number;
  base: number;   // HT
  amount: number; // TVA
};

export type PriceComputation = {
  regime: Regime;
  totalHt: number;
  totalTva: number;
  totalTtc: number;
  vatBreakdown: VatBreakdownLine[];
};

export const DEFAULT_SETTINGS: PricingSettings = {
  regime: "micro",
  defaultVatRate: 20,
  currency: "EUR",
};

export const DEFAULT_VAT_RATES: VatRate[] = [
  { id: "default-20", rate: 20, label: "Taux normal (20 %)", isDefault: true,  isActive: true, sortOrder: 1 },
  { id: "default-10", rate: 10, label: "Taux intermédiaire (10 %)", isDefault: false, isActive: true, sortOrder: 2 },
  { id: "default-5",  rate: 5.5, label: "Taux réduit (5,5 %)", isDefault: false, isActive: true, sortOrder: 3 },
  { id: "default-0",  rate: 0,  label: "Exonéré (0 %)", isDefault: false, isActive: true, sortOrder: 4 },
];
