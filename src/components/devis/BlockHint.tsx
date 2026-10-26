import { useEffect, useRef, useState } from "react";

/** Petit « ? » discret : explique pourquoi « Continuer » est grisé. N'occupe aucune place dans la mise en page. */
export function BlockHint({ text, className = "" }: { text: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  useEffect(() => { setOpen(false); }, [text]);
  if (!text) return null;
  return (
    <div ref={ref} className={`zx-q-wrap ${className}`}>
      <button type="button" className="zx-q" aria-label="Pourquoi je ne peux pas continuer ?" aria-expanded={open} onClick={() => setOpen((v) => !v)}>?</button>
      {open && <div role="status" className="zx-qpop">{text}</div>}
    </div>
  );
}
