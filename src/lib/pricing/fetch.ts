/**
 * Lecture du régime de facturation actif (source unique : `pricing_settings`).
 * Lecture réservée aux admins par RLS → fallback silencieux sur "micro"
 * (franchise en base de TVA), qui est le régime par défaut du projet.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Regime } from "./types";

export type ActiveRegime = {
  regime: Regime;
  vatRate: number;
  /** Mention légale à imprimer quand aucune TVA n'est appliquée. */
  exemptionNote: string;
};

export const TVA_FRANCHISE_NOTE = "TVA non applicable, article 293 B du CGI.";

export async function fetchActiveRegime(): Promise<ActiveRegime> {
  const fallback: ActiveRegime = { regime: "micro", vatRate: 0, exemptionNote: TVA_FRANCHISE_NOTE };
  try {
    const { data } = await supabase
      .from("pricing_settings")
      .select("regime, default_vat_rate")
      .maybeSingle();
    if (!data) return fallback;
    const regime = (data as { regime?: string }).regime === "societe" ? "societe" : "micro";
    const vatRate = Number((data as { default_vat_rate?: number }).default_vat_rate ?? 20);
    return {
      regime,
      vatRate: regime === "societe" ? vatRate : 0,
      exemptionNote: TVA_FRANCHISE_NOTE,
    };
  } catch {
    return fallback;
  }
}
