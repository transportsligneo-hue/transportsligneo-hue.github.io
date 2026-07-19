/**
 * Section admin · Régime de facturation + taux de TVA.
 *
 * Persiste dans la table `pricing_settings` (singleton) et `vat_rates`.
 * Le choix Micro / Société impacte tous les devis et factures FUTURS  · 
 * les documents existants gardent leur `regime_snapshot` figé (zéro régression).
 */
import { useEffect, useState } from "react";
import { Save, ShieldCheck, Building2, Wallet, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePricing, formatMoney, computePrice, type Regime } from "@/lib/pricing";

export function RegimeFacturationCard() {
  const { settings, vatRates, refresh, loading } = usePricing();
  const [regime, setRegime] = useState<Regime>(settings.regime);
  const [defaultRate, setDefaultRate] = useState<number>(settings.defaultVatRate);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setRegime(settings.regime);
    setDefaultRate(settings.defaultVatRate);
  }, [settings.regime, settings.defaultVatRate]);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const { error } = await supabase
        .from("pricing_settings")
        .update({ regime, default_vat_rate: defaultRate })
        .eq("id", true);
      if (error) throw error;
      await refresh();
      setMessage("Régime enregistré. Les nouveaux devis et factures utiliseront ce paramètre.");
    } catch (err) {
      console.error(err);
      setMessage("Erreur d'enregistrement. Vérifiez vos droits admin.");
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  // Aperçu : un devis à 180 € montre l'effet du régime en direct
  const sample = computePrice(180, { regime, vatRate: defaultRate });
  const activeRates = vatRates.filter((r) => r.isActive);

  return (
    <div className="rounded-xl border border-pro-border bg-white p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-pro-bg-soft flex items-center justify-center text-pro-accent">
          <ShieldCheck size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-pro-text">Régime de facturation</h2>
          <p className="text-xs text-pro-muted mt-0.5">
            Détermine le calcul de la TVA sur tous les nouveaux devis, factures et emails.
            Les documents existants ne sont pas modifiés.
          </p>
        </div>
      </div>

      {/* Sélecteur régime */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setRegime("micro")}
          className={`text-left rounded-xl border p-4 transition-all ${
            regime === "micro"
              ? "border-pro-accent bg-pro-bg-soft ring-1 ring-pro-accent/30"
              : "border-pro-border bg-white hover:border-pro-accent/50"
          }`}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Wallet size={16} className={regime === "micro" ? "text-pro-accent" : "text-pro-muted"} />
            <span className="font-medium text-pro-text">Micro-entreprise</span>
            {regime === "micro" && (
              <span className="ml-auto text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-pro-accent text-white">
                Actif
              </span>
            )}
          </div>
          <p className="text-xs text-pro-muted">
            Prix saisis = TTC, aucune TVA appliquée. Mention&nbsp;: « TVA non applicable, art.&nbsp;293&nbsp;B du CGI ».
          </p>
        </button>

        <button
          type="button"
          onClick={() => setRegime("societe")}
          className={`text-left rounded-xl border p-4 transition-all ${
            regime === "societe"
              ? "border-pro-accent bg-pro-bg-soft ring-1 ring-pro-accent/30"
              : "border-pro-border bg-white hover:border-pro-accent/50"
          }`}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Building2 size={16} className={regime === "societe" ? "text-pro-accent" : "text-pro-muted"} />
            <span className="font-medium text-pro-text">Société assujettie à la TVA</span>
            {regime === "societe" && (
              <span className="ml-auto text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-pro-accent text-white">
                Actif
              </span>
            )}
          </div>
          <p className="text-xs text-pro-muted">
            Prix saisis = HT, TVA calculée automatiquement selon le taux par ligne.
          </p>
        </button>
      </div>

      {/* Taux par défaut (visible en mode société) */}
      {regime === "societe" && (
        <div className="mt-4 rounded-lg bg-pro-bg-soft border border-pro-border p-3">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-pro-text-soft mb-2">
            Taux de TVA par défaut
          </label>
          <div className="flex flex-wrap gap-2">
            {activeRates.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setDefaultRate(r.rate)}
                className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                  Math.abs(defaultRate - r.rate) < 0.01
                    ? "border-pro-accent bg-white text-pro-accent font-medium shadow-sm"
                    : "border-pro-border bg-white text-pro-text hover:border-pro-accent/50"
                }`}
              >
                {r.rate.toString().replace(".", ",")}&nbsp;%
              </button>
            ))}
          </div>
          <p className="text-[11px] text-pro-muted mt-2 flex items-center gap-1">
            <Info size={11} /> Ce taux est appliqué par défaut ; il reste modifiable par ligne de devis.
          </p>
        </div>
      )}

      {/* Aperçu live */}
      <div className="mt-4 rounded-lg border border-dashed border-pro-border bg-white p-3">
        <p className="text-[11px] uppercase tracking-wider text-pro-text-soft mb-2">
          Aperçu · Devis 180 € (montant saisi)
        </p>
        <div className="flex items-center justify-between text-sm">
          <div className="text-pro-muted">
            {regime === "micro" ? (
              <>Total (TVA non applicable)</>
            ) : (
              <>Total TTC ({defaultRate.toString().replace(".", ",")}&nbsp;%)</>
            )}
          </div>
          <div className="text-right">
            {regime === "societe" && (
              <div className="text-[11px] text-pro-muted">
                HT {formatMoney(sample.totalHt)} · TVA {formatMoney(sample.totalTva)}
              </div>
            )}
            <div className="font-semibold text-pro-text">{formatMoney(sample.totalTtc)}</div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-pro-muted">
          {message ? (
            <span className={message.startsWith("Erreur") ? "text-red-600" : "text-emerald-600"}>{message}</span>
          ) : (
            <>Le changement affecte uniquement les prochains documents.</>
          )}
        </p>
        <button
          type="button"
          onClick={save}
          disabled={saving || loading || (regime === settings.regime && Math.abs(defaultRate - settings.defaultVatRate) < 0.01)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-pro-accent px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-pro-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Save size={14} /> {saving ? "Enregistrement…" : "Enregistrer le régime"}
        </button>
      </div>
    </div>
  );
}
