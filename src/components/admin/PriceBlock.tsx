import { Wallet, AlertCircle } from "lucide-react";
import { formatEUR, type UnifiedQuote } from "@/lib/pricing-engine";

interface PriceBlockProps {
  quote?: UnifiedQuote | null;
  /** Prix figé (override). Quand fourni, prime sur le calcul automatique. */
  priceTtc?: number | null;
  priceHt?: number | null;
  /** Compact = version réduite pour cartes/listes */
  variant?: "full" | "compact";
  title?: string;
  source?: string; // "Calculé automatiquement" / "Saisi manuellement"
}

export function PriceBlock({
  quote,
  priceTtc,
  priceHt,
  variant = "full",
  title = "Prix",
  source,
}: PriceBlockProps) {
  const hasManual = priceTtc != null;
  const ttc = hasManual ? (priceTtc as number) : quote?.priceTtc ?? 0;
  const ht = hasManual && priceHt != null ? priceHt : quote?.priceHt ?? null;
  const estimable = hasManual || (quote?.isEstimable ?? false);

  if (variant === "compact") {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-pro-gold-soft border border-pro-gold/20">
        <Wallet size={14} className="text-pro-gold" />
        <span className="text-sm font-semibold text-pro-text">
          {estimable ? formatEUR(ttc) : "Devis manuel"}
        </span>
        <span className="text-[11px] text-pro-muted">TTC</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-pro-gold/30 bg-gradient-to-br from-pro-gold-soft to-white p-5 shadow-pro-card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-pro-gold/15 flex items-center justify-center">
            <Wallet size={18} className="text-pro-gold" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-pro-muted font-semibold">
              {title}
            </p>
            <p className="text-xs text-pro-text-soft">
              {source ?? (hasManual ? "Saisi manuellement" : "Calculé automatiquement")}
            </p>
          </div>
        </div>
      </div>

      {!estimable ? (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
          <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            Distance non calculable automatiquement · devis manuel requis.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-3xl font-bold text-pro-text tracking-tight">
              {formatEUR(ttc)}
            </span>
            <span className="text-xs text-pro-muted font-medium">TTC</span>
            {ht != null && (
              <span className="text-xs text-pro-text-soft ml-auto">
                {formatEUR(ht)} HT
              </span>
            )}
          </div>

          {quote && quote.lines.length > 0 && (
            <div className="border-t border-pro-gold/20 pt-3 space-y-1.5">
              {quote.lines.map((l, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-pro-text-soft">{l.label}</span>
                  {l.amount != null && (
                    <span className="text-pro-text font-medium tabular-nums">
                      {formatEUR(l.amount)}
                    </span>
                  )}
                </div>
              ))}
              {quote.distanceKm != null && quote.distanceKm > 0 && (
                <div className="flex items-center justify-between text-[11px] text-pro-muted pt-1.5 border-t border-pro-gold/10">
                  <span>Distance</span>
                  <span className="tabular-nums">{quote.distanceKm} km</span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
