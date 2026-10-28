import { useEffect, useState } from "react";
import { Car, Map, Route as RouteIcon, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Row = { service: string; mois: number; aujourdhui: number; quota_restant: number | null; quota_total: number | null };

/**
 * Estimation du coût Google (tarifs publics, USD → EUR approximatif). Les 10 000 premiers appels
 * de chaque service sont gratuits chaque mois ; la facture exacte est dans Google Cloud Console.
 */
const GOOGLE = {
  places_session: { label: "Google Places (saisie d'adresse)", unit: "recherches", gratuit: 10_000, eurPar1000: 15.6, icon: Map },
  distance_matrix: { label: "Google Distance (kilomètres)", unit: "calculs", gratuit: 10_000, eurPar1000: 4.6, icon: RouteIcon },
} as const;

const fmt = (n: number) => n.toLocaleString("fr-FR");

export function ApiUsageCards() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    setBusy(true);
    const { data } = await (supabase as any).rpc("api_usage_summary");
    setRows((data ?? []) as Row[]);
    setBusy(false);
  };
  useEffect(() => { void load(); }, []);
  const get = (s: string) => rows?.find((r) => r.service === s);
  const box = "inline-flex items-center gap-3 rounded-xl border border-pro-border bg-white px-4 py-2.5 shadow-sm";
  const ico = "h-9 w-9 rounded-lg bg-[#eaf0ff] text-[#2f5fff] grid place-items-center";

  const plaque = get("plaque_siv");
  const ocr = get("plaque_ocr");
  const rest = plaque?.quota_restant;
  const tone = rest == null ? "text-pro-text" : rest < 50 ? "text-red-600" : rest < 200 ? "text-amber-600" : "text-emerald-600";

  return (
    <div className="flex flex-wrap items-stretch gap-3">
      <div className={box}>
        <div className={ico}><Car size={18} /></div>
        <div className="leading-tight">
          <div className="text-[11px] uppercase tracking-wider text-pro-text-soft">Recherches de plaques</div>
          <div className={"text-xl font-semibold " + tone}>
            {rows ? (rest != null ? `${fmt(rest)} restantes` : `${fmt(plaque?.mois ?? 0)} ce mois`) : "…"}
          </div>
          <div className="text-[11px] text-pro-text-soft">
            {rows && `${fmt(plaque?.mois ?? 0)} ce mois · ${fmt(plaque?.aujourdhui ?? 0)} aujourd'hui${plaque?.quota_total ? ` · forfait ${fmt(plaque.quota_total)}` : ""}`}
            {rows && (ocr?.mois ?? 0) > 0 ? ` · photos lues : ${fmt(ocr!.mois)}` : ""}
          </div>
        </div>
      </div>

      {(Object.keys(GOOGLE) as (keyof typeof GOOGLE)[]).map((k) => {
        const g = GOOGLE[k]; const r = get(k); const n = r?.mois ?? 0; const Icon = g.icon;
        const payant = Math.max(0, n - g.gratuit);
        const cout = (payant / 1000) * g.eurPar1000;
        return (
          <div key={k} className={box}>
            <div className={ico}><Icon size={18} /></div>
            <div className="leading-tight">
              <div className="text-[11px] uppercase tracking-wider text-pro-text-soft">{g.label}</div>
              <div className="text-xl font-semibold text-pro-text">{rows ? `${fmt(n)} ${g.unit}` : "…"}</div>
              <div className="text-[11px] text-pro-text-soft">
                {rows && `ce mois · ${fmt(r?.aujourdhui ?? 0)} aujourd'hui · ≈ ${cout.toFixed(2).replace(".", ",")} € (${fmt(Math.max(0, g.gratuit - n))} gratuits restants)`}
              </div>
            </div>
          </div>
        );
      })}
      <button onClick={() => void load()} disabled={busy} title="Actualiser" className="self-center p-1.5 rounded-lg text-pro-text-soft hover:bg-pro-bg-soft"><RefreshCw size={14} className={busy ? "animate-spin" : ""} /></button>
    </div>
  );
}
