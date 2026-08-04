import { useEffect, useState } from "react";
import { CheckSquare, Square } from "lucide-react";

export function ChecklistBlock({
  items,
  value,
  onChange,
}: {
  items: string[];
  value: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);

  const toggle = (i: number) => {
    const next = { ...local, [String(i)]: !local[String(i)] };
    setLocal(next);
    onChange(next);
  };

  const done = items.filter((_, i) => local[String(i)]).length;

  return (
    <section className="rounded-2xl border border-pro-border bg-white p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-pro-text">Checklist du module</h3>
        <span className="text-xs text-pro-muted">
          {done}/{items.length} — sauvegarde automatique
        </span>
      </div>
      <ul className="space-y-2">
        {items.map((it, i) => {
          const checked = !!local[String(i)];
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => toggle(i)}
                className={`w-full flex items-start gap-3 text-left rounded-xl border px-3 py-2.5 transition-all ${
                  checked ? "border-emerald-300 bg-emerald-50" : "border-pro-border hover:border-[#2F5FFF]/40"
                }`}
              >
                {checked ? (
                  <CheckSquare size={17} className="text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <Square size={17} className="text-pro-muted shrink-0 mt-0.5" />
                )}
                <span className={`text-sm ${checked ? "text-emerald-900 line-through/0" : "text-pro-text-soft"}`}>{it}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default ChecklistBlock;
