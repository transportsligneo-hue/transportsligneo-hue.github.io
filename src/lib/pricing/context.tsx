/**
 * Contexte React pour exposer le régime de facturation courant à toute
 * l'application. Un seul fetch au montage, mise à jour temps réel via
 * Supabase Realtime (optionnel).
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_SETTINGS, DEFAULT_VAT_RATES, type PricingSettings, type VatRate } from "./types";

type PricingContextValue = {
  settings: PricingSettings;
  vatRates: VatRate[];
  loading: boolean;
  refresh: () => Promise<void>;
};

const PricingContext = createContext<PricingContextValue>({
  settings: DEFAULT_SETTINGS,
  vatRates: DEFAULT_VAT_RATES,
  loading: false,
  refresh: async () => {},
});

export function PricingProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PricingSettings>(DEFAULT_SETTINGS);
  const [vatRates, setVatRates] = useState<VatRate[]>(DEFAULT_VAT_RATES);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const [settingsRes, ratesRes] = await Promise.all([
        supabase.from("pricing_settings").select("regime, default_vat_rate, currency").maybeSingle(),
        supabase.from("vat_rates").select("*").order("sort_order", { ascending: true }),
      ]);
      if (settingsRes.data) {
        setSettings({
          regime: (settingsRes.data.regime === "societe" ? "societe" : "micro"),
          defaultVatRate: Number(settingsRes.data.default_vat_rate ?? 20),
          currency: settingsRes.data.currency ?? "EUR",
        });
      }
      if (ratesRes.data) {
        setVatRates(ratesRes.data.map((r) => ({
          id: r.id,
          rate: Number(r.rate),
          label: r.label,
          isDefault: !!r.is_default,
          isActive: !!r.is_active,
          sortOrder: r.sort_order ?? 0,
        })));
      }
    } catch (err) {
      console.warn("[pricing] load failed, keeping defaults", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const value = useMemo(() => ({ settings, vatRates, loading, refresh }), [settings, vatRates, loading]);
  return <PricingContext.Provider value={value}>{children}</PricingContext.Provider>;
}

export function usePricing() {
  return useContext(PricingContext);
}

export function usePricingRegime() {
  return useContext(PricingContext).settings.regime;
}
