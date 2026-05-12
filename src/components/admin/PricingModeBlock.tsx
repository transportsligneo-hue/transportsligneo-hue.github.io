/**
 * PricingModeBlock — éditeur premium de la tarification d'un trajet (B1).
 *
 * Modes :
 *  - "fixe"    : l'admin impose un prix net convoyeur. Le driver l'accepte ou le refuse.
 *  - "enchere" : l'admin définit (ou pas) une fourchette min/max. Le driver propose
 *                son prix dans cet intervalle (ou librement si min/max non défini).
 *
 * Marge :
 *  - 30–40% est une INDICATION uniquement (jamais imposée).
 *  - L'UI calcule la marge réelle (prix client - prix convoyeur) / prix client
 *    et la colore : vert dans la fourchette cible, orange en dehors.
 *  - L'admin peut sauvegarder n'importe quelle combinaison.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Banknote, Gavel, Save, Info, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button, FormField, TextInput, Select, Card, Badge } from "./AdminUI";

export interface PricingModeBlockProps {
  trajetId: string;
  initial: {
    pricing_mode?: "fixe" | "enchere" | null;
    prix_client_ttc?: number | null;
    prix_convoyeur_fixe?: number | null;
    prix_convoyeur_min?: number | null;
    prix_convoyeur_max?: number | null;
    marge_indicative_pct?: number | null;
  };
  /** Si fourni (ex. devis accepté), le prix client TTC est verrouillé sur cette valeur. */
  lockedClientPrice?: number | null;
  /** Numéro du devis source pour affichage explicatif. */
  lockedSourceLabel?: string | null;
  onSaved?: (next: PricingModeBlockProps["initial"]) => void;
}

/** Bornes recommandées par défaut pour la rémunération convoyeur (en % du prix client TTC). */
const RECO_MIN_PCT = 55;
const RECO_MAX_PCT = 65;

export function PricingModeBlock({ trajetId, initial, lockedClientPrice, lockedSourceLabel, onSaved }: PricingModeBlockProps) {
  const effectiveClient = lockedClientPrice ?? initial.prix_client_ttc ?? null;
  const [mode, setMode] = useState<"fixe" | "enchere">(initial.pricing_mode ?? "fixe");
  const [prixClient, setPrixClient] = useState<string>(effectiveClient?.toString() ?? "");
  const [prixFixe, setPrixFixe] = useState<string>(initial.prix_convoyeur_fixe?.toString() ?? "");
  const [prixMin, setPrixMin] = useState<string>(initial.prix_convoyeur_min?.toString() ?? "");
  const [prixMax, setPrixMax] = useState<string>(initial.prix_convoyeur_max?.toString() ?? "");
  const [margeCible, setMargeCible] = useState<string>(initial.marge_indicative_pct?.toString() ?? "35");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    setMode(initial.pricing_mode ?? "fixe");
    const next = lockedClientPrice ?? initial.prix_client_ttc ?? null;
    setPrixClient(next?.toString() ?? "");
    setPrixFixe(initial.prix_convoyeur_fixe?.toString() ?? "");
    setPrixMin(initial.prix_convoyeur_min?.toString() ?? "");
    setPrixMax(initial.prix_convoyeur_max?.toString() ?? "");
    setMargeCible(initial.marge_indicative_pct?.toString() ?? "35");
  }, [trajetId, lockedClientPrice, initial.pricing_mode, initial.prix_client_ttc, initial.prix_convoyeur_fixe,
      initial.prix_convoyeur_min, initial.prix_convoyeur_max, initial.marge_indicative_pct]);


  const num = (s: string) => (s.trim() === "" ? null : parseFloat(s));

  /** Marge réelle calculée (indicative). Renvoie null si non calculable. */
  const computeMarge = (): { pct: number; eur: number } | null => {
    const c = num(prixClient);
    const v = mode === "fixe" ? num(prixFixe) : (num(prixMin) ?? num(prixMax));
    if (c == null || v == null || c <= 0) return null;
    const eur = c - v;
    return { eur, pct: (eur / c) * 100 };
  };

  const marge = computeMarge();
  const cible = parseFloat(margeCible || "0");
  const margeOk = marge ? Math.abs(marge.pct - cible) <= 10 : false; // ±10% autour de la cible
  const margeTone = !marge ? "neutral" : margeOk ? "success" : "warning";

  const handleSave = async () => {
    setSaving(true);
    const trajetUpdates = {
      pricing_mode: mode,
      prix_convoyeur_fixe: mode === "fixe" ? num(prixFixe) : null,
      prix_convoyeur_min: mode === "enchere" ? num(prixMin) : null,
      prix_convoyeur_max: mode === "enchere" ? num(prixMax) : null,
    };
    const adminUpdates = {
      trajet_id: trajetId,
      prix_client_ttc: num(prixClient),
      marge_indicative_pct: num(margeCible),
    };
    const { error } = await supabase
      .from("trajets")
      .update(trajetUpdates as never)
      .eq("id", trajetId);
    const { error: adminError } = await supabase
      .from("trajets_admin_data" as never)
      .upsert(adminUpdates as never, { onConflict: "trajet_id" } as never);
    setSaving(false);
    if (!error && !adminError) {
      setSavedAt(Date.now());
      onSaved?.({ ...trajetUpdates, prix_client_ttc: adminUpdates.prix_client_ttc, marge_indicative_pct: adminUpdates.marge_indicative_pct } as PricingModeBlockProps["initial"]);
      setTimeout(() => setSavedAt(null), 2500);
    } else {
      alert("Erreur de sauvegarde");
    }
  };

  return (
    <Card padded={false} className="mb-3">
      <div className="p-3 sm:p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-pro-text flex items-center gap-2">
            <Banknote size={15} className="text-pro-accent" />
            Tarification de la mission
          </h4>
          {savedAt && (
            <span className="text-[11px] text-emerald-700 flex items-center gap-1">
              <CheckCircle2 size={11} /> Enregistré
            </span>
          )}
        </div>

        {/* === Mode toggle === */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode("fixe")}
            className={`p-3 rounded-lg border text-left transition-all ${
              mode === "fixe"
                ? "border-pro-accent bg-pro-accent/5 ring-2 ring-pro-accent/20"
                : "border-pro-border bg-white hover:border-pro-accent/40"
            }`}
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-pro-text">
              <Banknote size={14} /> Prix fixe
            </div>
            <p className="text-[11px] text-pro-muted mt-1 leading-tight">
              Prix imposé. Le driver accepte ou refuse.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setMode("enchere")}
            className={`p-3 rounded-lg border text-left transition-all ${
              mode === "enchere"
                ? "border-pro-accent bg-pro-accent/5 ring-2 ring-pro-accent/20"
                : "border-pro-border bg-white hover:border-pro-accent/40"
            }`}
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-pro-text">
              <Gavel size={14} /> Enchère convoyeur
            </div>
            <p className="text-[11px] text-pro-muted mt-1 leading-tight">
              Le driver propose son prix (fourchette optionnelle).
            </p>
          </button>
        </div>

        {/* === Inputs prix === */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <FormField label="Prix client TTC (€)">
            <TextInput
              type="number"
              step="0.01"
              value={prixClient}
              onChange={(e) => setPrixClient(e.target.value)}
              placeholder="ex: 380"
            />
          </FormField>

        {/* === Inputs prix === */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <FormField label={lockedClientPrice != null ? "Prix client TTC (verrouillé devis)" : "Prix client TTC (€)"}>
            <TextInput
              type="number"
              step="0.01"
              value={prixClient}
              onChange={(e) => setPrixClient(e.target.value)}
              placeholder="ex: 380"
              disabled={lockedClientPrice != null}
            />
            {lockedSourceLabel && (
              <p className="mt-1 text-[10px] text-pro-muted">Auto depuis {lockedSourceLabel}</p>
            )}
          </FormField>

          {mode === "fixe" ? (
            <FormField label="Prix convoyeur net (€)">
              <TextInput
                type="number"
                step="0.01"
                value={prixFixe}
                onChange={(e) => setPrixFixe(e.target.value)}
                placeholder={effectiveClient ? `ex: ${Math.round(effectiveClient * (RECO_MIN_PCT + RECO_MAX_PCT) / 200)}` : "ex: 250"}
              />
            </FormField>

          ) : (
            <FormField label="Marge cible indicative (%)">
              <Select value={margeCible} onChange={(e) => setMargeCible(e.target.value)}>
                <option value="30">30 %</option>
                <option value="35">35 %</option>
                <option value="40">40 %</option>
                <option value="0">Pas d'objectif</option>
              </Select>
            </FormField>
          )}
        </div>

        {mode === "enchere" && (
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Min convoyeur (€) — optionnel">
              <TextInput
                type="number"
                step="0.01"
                value={prixMin}
                onChange={(e) => setPrixMin(e.target.value)}
                placeholder="vide = libre"
              />
            </FormField>
            <FormField label="Max convoyeur (€) — optionnel">
              <TextInput
                type="number"
                step="0.01"
                value={prixMax}
                onChange={(e) => setPrixMax(e.target.value)}
                placeholder="vide = libre"
              />
            </FormField>
          </div>
        )}

        {mode === "fixe" && (
          <FormField label="Marge cible indicative (%)">
            <Select value={margeCible} onChange={(e) => setMargeCible(e.target.value)}>
              <option value="30">30 %</option>
              <option value="35">35 %</option>
              <option value="40">40 %</option>
              <option value="0">Pas d'objectif</option>
            </Select>
          </FormField>
        )}

        {/* === Indicateur de marge (informatif) === */}
        <div className={`flex items-start gap-2 p-2.5 rounded-lg border text-[12px] ${
          margeTone === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : margeTone === "warning"
            ? "border-amber-200 bg-amber-50 text-amber-800"
            : "border-pro-border bg-slate-50 text-pro-text-soft"
        }`}>
          {margeTone === "success" ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
            : margeTone === "warning" ? <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            : <Info size={14} className="mt-0.5 shrink-0" />}
          <div className="leading-tight">
            {marge ? (
              <>
                <span className="font-semibold">Marge réelle : {marge.pct.toFixed(1)} % ({marge.eur.toFixed(0)} €)</span>
                {cible > 0 && (
                  <span className="opacity-80"> · cible {cible}% ±10</span>
                )}
                <p className="text-[11px] mt-0.5 opacity-80">
                  Indication uniquement — vous pouvez sauvegarder n'importe quel prix.
                </p>
              </>
            ) : (
              <span>Saisissez prix client + prix convoyeur pour voir la marge calculée.</span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <Badge tone={mode === "fixe" ? "info" : "warning"}>
            {mode === "fixe" ? "Mode : Prix fixe" : "Mode : Enchère"}
          </Badge>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={saving}
            icon={<Save size={14} />}
          >
            {saving ? "Sauvegarde…" : "Enregistrer la tarification"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
