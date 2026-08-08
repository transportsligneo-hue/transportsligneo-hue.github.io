/**
 * Légende des suffixes de numéro de mission (missions livraison + restitution).
 * L = Livraison, R = Restitution — évite toute confusion avec un simple "Aller / Retour".
 */
export function LegSuffixLegend({ className }: { className?: string }) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-pro-border bg-white px-3.5 py-2.5 text-[12px] text-pro-text-soft ${className ?? ""}`}
    >
      <b className="text-pro-text">Légende suffixes :</b>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
        <b className="text-pro-text">L</b> = Livraison
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
        <b className="text-pro-text">R</b> = Restitution
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-pro-accent" />
        <b className="text-pro-text">Mission groupée</b> = L et R liées (même numéro racine)
      </span>
    </div>
  );
}
