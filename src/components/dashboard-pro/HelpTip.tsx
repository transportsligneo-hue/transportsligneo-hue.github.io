import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const KEY = "ligneo-help-seen:";
/** Événement déclenché par la touche « Revoir les conseils » : rouvre les bulles de la page. */
export const REPLAY_HELP_EVENT = "ligneo:replay-help";
const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return String(h); };

/**
 * Bulle d'aide « ? ». S'ouvre automatiquement la première fois qu'elle est
 * affichée dans ce navigateur (tous comptes, anciens compris), puis au clic.
 * L'événement REPLAY_HELP_EVENT les rouvre toutes à la demande.
 */
export function HelpTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const k = KEY + hash(text);

  useEffect(() => {
    try {
      if (!localStorage.getItem(k)) {
        const t = setTimeout(() => setOpen(true), 600);
        return () => clearTimeout(t);
      }
    } catch { /* stockage indisponible */ }
  }, [k]);

  useEffect(() => {
    const replay = () => {
      try { localStorage.removeItem(k); } catch { /* ignore */ }
      setOpen(true);
    };
    window.addEventListener(REPLAY_HELP_EVENT, replay);
    return () => window.removeEventListener(REPLAY_HELP_EVENT, replay);
  }, [k]);

  const change = (v: boolean) => {
    setOpen(v);
    if (!v) try { localStorage.setItem(k, "1"); } catch { /* ignore */ }
  };

  return (
    <Popover open={open} onOpenChange={change}>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Aide" className="pp-help">?</button>
      </PopoverTrigger>
      <PopoverContent side="bottom" className="w-[260px] p-3 text-xs leading-snug">
        <p>{text}</p>
        <button type="button" onClick={() => change(false)} className="mt-2 text-[11px] font-semibold text-pro-accent">
          Compris
        </button>
      </PopoverContent>
    </Popover>
  );
}
