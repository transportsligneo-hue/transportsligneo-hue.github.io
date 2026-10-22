import { useEffect, useState } from "react";
import { Check, ListChecks } from "lucide-react";

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
    <section className="fm-card">
      <div className="fm-card-h">
        <h3 className="fm-card-t"><span className="fm-ic"><ListChecks size={16} /></span> À vérifier avant la mission</h3>
        <span className="fm-sub">{done}/{items.length}</span>
      </div>
      <ul className="fm-chk">
        {items.map((it, i) => {
          const checked = !!local[String(i)];
          return (
            <li key={i}>
              <button type="button" onClick={() => toggle(i)} className={`fm-ck${checked ? " on" : ""}`} aria-pressed={checked}>
                <span className="fm-cb"><Check size={14} strokeWidth={3.2} /></span>
                <span>{it}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default ChecklistBlock;
