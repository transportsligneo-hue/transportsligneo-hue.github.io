/** Catégories de permis à cocher. Stockées comme avant dans un texte « B, C, CE » (aucun changement en base). */
export const PERMIS_CATEGORIES: Array<{ k: string; label: string }> = [
  { k: "AM", label: "AM" }, { k: "A1", label: "A1" }, { k: "A2", label: "A2" }, { k: "A", label: "A" },
  { k: "B", label: "B" }, { k: "BE", label: "BE" },
  { k: "C1", label: "C1" }, { k: "C1E", label: "C1E" }, { k: "C", label: "C" }, { k: "CE", label: "CE" },
  { k: "D1", label: "D1" }, { k: "D1E", label: "D1E" }, { k: "D", label: "D" }, { k: "DE", label: "DE" },
];

const ALIAS: Record<string, string> = { EB: "BE", EC: "CE", EC1: "C1E", ED: "DE", ED1: "D1E" };
const ORDER = PERMIS_CATEGORIES.map((c) => c.k);

export function parsePermis(value: string | null | undefined): string[] {
  const out = new Set<string>();
  for (const raw of String(value ?? "").toUpperCase().split(/[^A-Z0-9]+/)) {
    if (!raw) continue;
    out.add(ALIAS[raw] ?? raw);
  }
  return [...out];
}

export function formatPermis(keys: string[]): string {
  const known = ORDER.filter((k) => keys.includes(k));
  const extra = keys.filter((k) => !ORDER.includes(k));
  return [...known, ...extra].join(", ");
}

export function PermisCategories({ value, onChange, dark = false }: { value: string; onChange: (v: string) => void; dark?: boolean }) {
  const sel = parsePermis(value);
  const toggle = (k: string) => onChange(formatPermis(sel.includes(k) ? sel.filter((x) => x !== k) : [...sel, k]));
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Catégories de permis">
      {PERMIS_CATEGORIES.map(({ k, label }) => {
        const on = sel.includes(k);
        const cls = on
          ? "border-transparent text-white shadow-[0_8px_18px_-10px_rgba(47,95,255,.9)]"
          : dark
            ? "border-white/20 bg-white/5 text-white/80 hover:border-white/50"
            : "border-[#d9e2f5] bg-white text-[#44516f] hover:border-[#2F5FFF]";
        return (
          <button
            key={k}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(k)}
            className={`min-h-[40px] min-w-[52px] rounded-xl border px-3.5 text-sm font-bold transition active:scale-[.96] ${cls}`}
            style={on ? { background: "linear-gradient(135deg,#2F5FFF,#5de0ff)" } : undefined}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
