import { ReactNode } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Drawer latéral premium "bleu électrique" — modèle UX unique pour TOUT l'admin.
 * Utiliser à la place des modales / pages superposées / overlays /
 * navigations vers une page détail.
 */
export function AdminDetailDrawer({
  open,
  onClose,
  title,
  subtitle,
  badge,
  children,
  footer,
  width = "xl",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: "md" | "lg" | "xl" | "2xl";
}) {
  const widthClass = {
    md: "sm:max-w-md",
    lg: "sm:max-w-lg",
    xl: "sm:max-w-2xl",
    "2xl": "sm:max-w-3xl",
  }[width];

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className={cn(
          "w-full p-0 flex flex-col gap-0 border-l-0",
          widthClass,
          "bg-gradient-to-b from-[#0b1026] via-[#0d1430] to-[#0b1026] text-white",
        )}
      >
        {/* Header premium */}
        <div className="relative px-6 pt-6 pb-5 border-b border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.25),transparent_60%)]">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition flex items-center justify-center text-white/80 hover:text-white"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
          {badge ? <div className="mb-2">{badge}</div> : null}
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight pr-10">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-sm text-white/60">{subtitle}</p>
          ) : null}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 [scrollbar-color:rgba(255,255,255,0.2)_transparent]">
          {children}
        </div>

        {footer ? (
          <div className="px-6 py-4 border-t border-white/10 bg-white/[0.03]">
            {footer}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export function DrawerSection({
  title,
  icon,
  children,
  action,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-sm">
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-blue-300/90 font-medium">
          {icon}
          {title}
        </div>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function DrawerField({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 py-1.5">
      <span className="text-[10px] uppercase tracking-wider text-white/45">{label}</span>
      <span
        className={cn(
          "text-sm text-white/95 break-words",
          mono && "font-mono text-xs text-blue-200",
        )}
      >
        {value || <span className="text-white/30">—</span>}
      </span>
    </div>
  );
}

export function DrawerGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-5 gap-y-1">{children}</div>;
}

export function DrawerBadge({
  children,
  tone = "blue",
}: {
  children: ReactNode;
  tone?: "blue" | "green" | "amber" | "red" | "slate";
}) {
  const tones: Record<string, string> = {
    blue: "bg-blue-500/15 text-blue-200 border-blue-400/30",
    green: "bg-emerald-500/15 text-emerald-200 border-emerald-400/30",
    amber: "bg-amber-500/15 text-amber-200 border-amber-400/30",
    red: "bg-red-500/15 text-red-200 border-red-400/30",
    slate: "bg-white/10 text-white/70 border-white/20",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
