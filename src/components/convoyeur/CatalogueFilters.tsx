import { Search, Navigation, Loader2, X } from "lucide-react";

export type LegFilter = "all" | "simple" | "ar";
export type SortKey = "date" | "prix" | "distance" | "proximite";

export interface CatalogueFilterState {
  search: string;
  maxKm: string;
  minPrix: string;
  date: string;
  leg: LegFilter;
  urgent: boolean;
  electric: boolean;
  radiusKm: number | null; // null = France entière
  sort: SortKey;
}

interface Props {
  value: CatalogueFilterState;
  onChange: (next: CatalogueFilterState) => void;
  geoActive: boolean;
  geoLoading: boolean;
  onRequestGeo: () => void;
  onClearGeo: () => void;
}

const RADII: { label: string; value: number | null }[] = [
  { label: "10 km", value: 10 },
  { label: "25 km", value: 25 },
  { label: "50 km", value: 50 },
  { label: "100 km", value: 100 },
  { label: "150 km", value: 150 },
  { label: "200 km", value: 200 },
  { label: "500 km", value: 500 },
  { label: "France entière", value: null },
];

export function CatalogueFilters({
  value,
  onChange,
  geoActive,
  geoLoading,
  onRequestGeo,
  onClearGeo,
}: Props) {
  const set = <K extends keyof CatalogueFilterState>(
    k: K,
    v: CatalogueFilterState[K],
  ) => onChange({ ...value, [k]: v });

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-xl">
      {/* Recherche + géoloc */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50"
          />
          <input
            value={value.search}
            onChange={(e) => set("search", e.target.value)}
            placeholder="Ville, département, région, marque…"
            className="w-full rounded-lg border border-white/15 bg-white/5 py-2 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-amber-300/50"
          />
        </div>
        {geoActive ? (
          <button
            onClick={onClearGeo}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/50 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/25"
          >
            <Navigation size={14} /> Autour de moi
            <X size={12} className="opacity-70" />
          </button>
        ) : (
          <button
            onClick={onRequestGeo}
            disabled={geoLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-60"
          >
            {geoLoading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Navigation size={14} />
            )}
            Autour de moi
          </button>
        )}
      </div>

      {/* Rayon */}
      {geoActive && (
        <div className="flex flex-wrap gap-1.5">
          {RADII.map((r) => {
            const active = value.radiusKm === r.value;
            return (
              <button
                key={r.label}
                onClick={() => set("radiusKm", r.value)}
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
                  active
                    ? "border-amber-300/70 bg-amber-300/20 text-amber-100"
                    : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Filtres numériques + tri */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <input
          type="number"
          value={value.maxKm}
          onChange={(e) => set("maxKm", e.target.value)}
          placeholder="Distance max (km)"
          className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40"
        />
        <input
          type="number"
          value={value.minPrix}
          onChange={(e) => set("minPrix", e.target.value)}
          placeholder="Prix min (€)"
          className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40"
        />
        <input
          type="date"
          value={value.date}
          onChange={(e) => set("date", e.target.value)}
          className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40 [color-scheme:dark]"
        />
        <select
          value={value.sort}
          onChange={(e) => set("sort", e.target.value as SortKey)}
          className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none [color-scheme:dark]"
        >
          {geoActive && <option value="proximite">Tri : Proximité</option>}
          <option value="date">Tri : Plus récentes</option>
          <option value="prix">Tri : Rémunération</option>
          <option value="distance">Tri : Distance</option>
        </select>
      </div>

      {/* Toggles */}
      <div className="flex flex-wrap gap-1.5">
        {[
          { key: "all" as const, label: "Toutes" },
          { key: "simple" as const, label: "Livraison simple" },
          { key: "ar" as const, label: "Livraison + Restitution" },
        ].map((o) => {
          const active = value.leg === o.key;
          return (
            <button
              key={o.key}
              onClick={() => set("leg", o.key)}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
                active
                  ? "border-indigo-400/60 bg-indigo-500/20 text-indigo-100"
                  : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
              }`}
            >
              {o.label}
            </button>
          );
        })}
        <button
          onClick={() => set("urgent", !value.urgent)}
          className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
            value.urgent
              ? "border-red-400/60 bg-red-500/20 text-red-100"
              : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
          }`}
        >
          ⚡ Urgentes
        </button>
        <button
          onClick={() => set("electric", !value.electric)}
          className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
            value.electric
              ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-100"
              : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
          }`}
        >
          🔌 Électrique
        </button>
      </div>
    </div>
  );
}
