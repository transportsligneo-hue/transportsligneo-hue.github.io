import { useEffect, useId, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Button } from "@/components/ui/button";

let closeOpen: (() => void) | null = null;

export function HelpTip({ title, text, tone = "blue" }: { title: string; text: string; tone?: "violet" | "blue" }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    closeOpen?.();
    const close = () => setOpen(false);
    closeOpen = close;
    return () => { if (closeOpen === close) closeOpen = null; };
  }, [open]);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`helptip-btn helptip-${tone}`}
          aria-label={`Aide : ${title}`}
          aria-describedby={open ? id : undefined}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4.5" /><circle cx="12" cy="18" r=".6" fill="currentColor" />
          </svg>
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content id={id} role="tooltip" side="top" sideOffset={8} collisionPadding={12} className={`helptip-bubble helptip-${tone}`} onOpenAutoFocus={(e) => e.preventDefault()}>
          <strong>{title}</strong>
          <p>{text}</p>
          <Popover.Arrow className="helptip-arrow" width={14} height={7} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
