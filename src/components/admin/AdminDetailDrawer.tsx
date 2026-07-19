import { ReactNode } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * Drawer latéral premium "bleu électrique" · modèle UX unique pour TOUT l'admin.
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
          "bg-[color:var(--admin-drawer-bg)] text-[color:var(--admin-drawer-text)] shadow-[0_24px_64px_-24px_rgba(15,23,42,0.35)]",
        )}
      >
        {/* Header premium · la croix de fermeture est fournie par SheetContent (shadcn) pour éviter tout doublon */}
        <div className="relative px-6 pt-6 pb-5 border-b border-[color:var(--admin-drawer-border)] bg-[linear-gradient(180deg,#ffffff,#f8fafc)]">
          {badge ? <div className="mb-3 flex flex-wrap gap-2">{badge}</div> : null}
          <h2 className="text-2xl sm:text-[26px] font-semibold tracking-tight pr-10 text-slate-900 leading-tight">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1.5 text-sm text-slate-500 font-medium">{subtitle}</p>
          ) : null}
        </div>


        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] [scrollbar-color:rgba(148,163,184,0.6)_transparent]">
          {children}
        </div>

        {footer ? (
          <div className="px-6 py-4 border-t border-[color:var(--admin-drawer-border)] bg-white/90 backdrop-blur">
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
    <section className="rounded-xl border border-[color:var(--admin-drawer-border)] bg-white shadow-sm">
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-[color:var(--admin-drawer-border)] bg-slate-50/80">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-500 font-medium">
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
      <span className="text-[10px] uppercase tracking-wider text-slate-400">{label}</span>
      <span
        className={cn(
          "text-sm text-slate-900 break-words",
          mono && "font-mono text-xs text-slate-600",
        )}
      >
        {value || <span className="text-slate-300"> · </span>}
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
  tone?: "blue" | "green" | "amber" | "red" | "slate" | "purple";
}) {
  // Badges à contraste renforcé · lecture nette sur fond blanc, aspect professionnel.
  const tones: Record<string, string> = {
    blue:   "bg-blue-600 text-white border-blue-700 shadow-sm",
    green:  "bg-emerald-600 text-white border-emerald-700 shadow-sm",
    amber:  "bg-amber-500 text-white border-amber-600 shadow-sm",
    red:    "bg-red-600 text-white border-red-700 shadow-sm",
    slate:  "bg-slate-800 text-white border-slate-900 shadow-sm",
    purple: "bg-violet-600 text-white border-violet-700 shadow-sm",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

