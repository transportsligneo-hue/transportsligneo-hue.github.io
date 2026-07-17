/**
 * AiSettingsProvider — expose les paramètres IA (feature flags globaux) à
 * toute l'application. Un fetch au montage via RPC, propagation instantanée
 * par Realtime, fallback silencieux sur les valeurs par défaut.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_AI_SETTINGS, type AiCapability, type AiSettings } from "./types";

type Ctx = {
  settings: AiSettings;
  loading: boolean;
  refresh: () => Promise<void>;
};

const AiSettingsContext = createContext<Ctx>({
  settings: DEFAULT_AI_SETTINGS,
  loading: false,
  refresh: async () => {},
});

function normalize(row: Record<string, unknown> | null | undefined): AiSettings {
  if (!row) return DEFAULT_AI_SETTINGS;
  const out: AiSettings = { ...DEFAULT_AI_SETTINGS };
  for (const k of Object.keys(DEFAULT_AI_SETTINGS) as (keyof AiSettings)[]) {
    const v = row[k as string];
    if (typeof v === "boolean") (out as Record<string, unknown>)[k as string] = v;
    else if (k === "assistance_level" && typeof v === "string") (out as Record<string, unknown>)[k as string] = v;
    else if (k === "model_overrides" && v && typeof v === "object") (out as Record<string, unknown>)[k as string] = v;
  }
  return out;
}

export function AiSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AiSettings>(DEFAULT_AI_SETTINGS);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.rpc as any)("get_ai_settings");
      const row = Array.isArray(data) ? data[0] : data;
      setSettings(normalize(row as Record<string, unknown> | null));
    } catch (err) {
      console.warn("[ai-settings] fetch failed, using defaults", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // Realtime pour propagation instantanée
    const ch = supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .channel("ai_settings_changes")
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "ai_settings" },
        () => { void refresh(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const value = useMemo(() => ({ settings, loading, refresh }), [settings, loading]);
  return <AiSettingsContext.Provider value={value}>{children}</AiSettingsContext.Provider>;
}

export function useAiSettings() {
  return useContext(AiSettingsContext);
}

/** True uniquement si l'IA globale est active ET la capacité demandée est active. */
export function useAiCapability(cap: AiCapability): boolean {
  const { settings } = useContext(AiSettingsContext);
  if (!settings.ai_enabled) return false;
  return Boolean(settings[cap]);
}
