import { Link } from "@tanstack/react-router";
import { ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/* ============== Breadcrumb ============== */
export interface BreadcrumbItem {
  label: string;
  to?: string;
}
export function AdminBreadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Fil d'Ariane" className="admin-breadcrumb flex items-center gap-1 text-xs">
      {items.map((it, i) => {
        const last = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1">
            {it.to && !last ? (
              <Link to={it.to as never}>{it.label}</Link>
            ) : (
              <span aria-current={last ? "page" : undefined}>{it.label}</span>
            )}
            {!last && <ChevronRight size={12} className="text-slate-400" />}
          </span>
        );
      })}
    </nav>
  );
}

/* ============== Page Header ============== */
interface PageHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  breadcrumb?: BreadcrumbItem[];
  actions?: ReactNode;
  status?: ReactNode;
  /** Logo / avatar affiché à gauche du titre (client, organisation, convoyeur…). */
  logo?: ReactNode;
}
export function AdminPageHeader({ eyebrow, title, subtitle, breadcrumb, actions, status, logo }: PageHeaderProps) {
  return (
    <header className="mb-6 space-y-3">
      {breadcrumb && breadcrumb.length > 0 && <AdminBreadcrumb items={breadcrumb} />}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4 min-w-0">
          {logo && <div className="shrink-0 pt-0.5">{logo}</div>}
          <div className="space-y-1.5 min-w-0">
            {eyebrow && <p className="admin-eyebrow">{eyebrow}</p>}
            <h1 className="admin-h1 truncate">{title}</h1>
            {subtitle && <p className="text-sm text-[color:var(--admin-muted)]">{subtitle}</p>}
            {status && <div className="pt-1">{status}</div>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </header>
  );
}

/* ============== Stat Card ============== */
interface StatProps {
  label: string;
  value: ReactNode;
  delta?: { value: string; direction: "up" | "down" };
  icon?: LucideIcon;
  hint?: ReactNode;
  accent?: "default" | "success" | "warning" | "danger" | "info";
}
export function AdminStatCard({ label, value, delta, icon: Icon, hint, accent = "default" }: StatProps) {
  const accentBg: Record<string, string> = {
    default: "bg-[color:var(--admin-accent-soft)] text-[color:var(--admin-accent-strong)]",
    success: "bg-[color:var(--admin-success-soft)] text-emerald-700",
    warning: "bg-[color:var(--admin-warning-soft)] text-amber-700",
    danger: "bg-[color:var(--admin-danger-soft)] text-red-700",
    info: "bg-[color:var(--admin-info-soft)] text-sky-700",
  };
  return (
    <div className="admin-stat flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="admin-stat__label">{label}</p>
        <p className="admin-stat__value mt-1">{value}</p>
        {delta && (
          <p className={delta.direction === "up" ? "admin-stat__delta-up mt-1" : "admin-stat__delta-down mt-1"}>
            {delta.direction === "up" ? "▲" : "▼"} {delta.value}
          </p>
        )}
        {hint && <p className="text-[11px] text-[color:var(--admin-muted)] mt-1">{hint}</p>}
      </div>
      {Icon && (
        <span className={`shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-xl ${accentBg[accent]}`}>
          <Icon size={18} />
        </span>
      )}
    </div>
  );
}

/* ============== Status Badge ============== */
type StatusTone = "success" | "warning" | "danger" | "info" | "accent" | "violet" | "gold" | "neutral";
const TONE_BY_KEYWORD: Record<string, StatusTone> = {
  termine: "success", terminée: "success", terminee: "success", validee: "success", validée: "success", valide: "success", paye: "success", paid: "success", actif: "success", active: "success", confirme: "success",
  attente: "warning", à_traiter: "warning", a_traiter: "warning", "à traiter": "warning", brouillon: "warning", pending: "warning", en_cours: "info", "en cours": "info", encours: "info",
  refuse: "danger", refusée: "danger", annule: "danger", annulée: "danger", annulee: "danger", echec: "danger", failed: "danger", incident: "danger", suspendu: "danger",
  nouveau: "accent", nouvelle: "accent", new: "accent", devis: "accent",
  convertie: "violet", converti: "violet", convertit: "violet",
  attribuee: "gold", attribuée: "gold", attribue: "gold", attribué: "gold",
};

export function AdminBadge({ label, tone }: { label: string; tone?: StatusTone }) {
  const key = label.toLowerCase().replace(/\s+/g, "_");
  const t: StatusTone = tone ?? TONE_BY_KEYWORD[key] ?? TONE_BY_KEYWORD[key.replace(/_/g, " ")] ?? "neutral";
  return <span className={`admin-badge admin-badge--${t}`}>{label}</span>;
}

/* ============== Section ============== */
export function AdminSection({
  title,
  description,
  actions,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="admin-card p-5 sm:p-6">
      {(title || actions) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="admin-h2">{title}</h2>}
            {description && <p className="text-sm text-[color:var(--admin-muted)] mt-0.5">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/* ============== Definition list ============== */
export function AdminField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="admin-label">{label}</p>
      <div className="admin-value">{children ?? <span className="text-slate-400">—</span>}</div>
    </div>
  );
}

/* ============== Empty state ============== */
export function AdminEmpty({ icon: Icon, title, description }: { icon?: LucideIcon; title: string; description?: string }) {
  return (
    <div className="text-center py-10 px-4">
      {Icon && (
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--admin-bg-soft)] text-[color:var(--admin-muted)] mb-3">
          <Icon size={20} />
        </span>
      )}
      <p className="admin-h2">{title}</p>
      {description && <p className="text-sm text-[color:var(--admin-muted)] mt-1">{description}</p>}
    </div>
  );
}
