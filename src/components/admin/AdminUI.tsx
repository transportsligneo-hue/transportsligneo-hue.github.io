import { type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type ButtonHTMLAttributes } from "react";
import { Search, X } from "lucide-react";

/* ============= PageHeader ============= */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-semibold text-pro-text">{title}</h1>
        {subtitle && <p className="text-pro-muted text-sm mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

/* ============= Card ============= */
export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={`bg-white border border-pro-border rounded-xl shadow-pro-card ${padded ? "p-5" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

/* ============= KPI ============= */
export function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  hint,
}: {
  label: string;
  value: string | number;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  tone?: "default" | "success" | "warning" | "danger" | "info";
  hint?: string;
}) {
  const toneClasses: Record<string, string> = {
    default: "bg-slate-100 text-slate-600",
    success: "bg-emerald-50 text-emerald-600",
    warning: "bg-amber-50 text-amber-600",
    danger: "bg-red-50 text-red-600",
    info: "bg-blue-50 text-blue-600",
  };
  return (
    <div className="bg-white border border-pro-border rounded-lg p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-pro-muted text-xs uppercase tracking-wider font-medium">{label}</p>
          <p className="text-2xl font-semibold text-pro-text mt-1">{value}</p>
          {hint && <p className="text-pro-muted text-xs mt-1">{hint}</p>}
        </div>
        {Icon && (
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${toneClasses[tone]}`}>
            <Icon size={18} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ============= Badge ============= */
type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "primary" | "purple";
export function Badge({
  children,
  tone = "neutral",
  icon,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  icon?: ReactNode;
}) {
  const styles: Record<BadgeTone, string> = {
    neutral: "bg-slate-100 text-slate-700 border-slate-200",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    danger: "bg-red-50 text-red-700 border-red-200",
    info: "bg-blue-50 text-blue-700 border-blue-200",
    primary: "bg-pro-accent/10 text-pro-accent border-pro-accent/20",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${styles[tone]}`}
    >
      {icon}
      {children}
    </span>
  );
}

/* Mappings métier réutilisables */
export const demandeStatutTone: Record<string, BadgeTone> = {
  nouvelle: "info",
  a_traiter: "warning",
  convertie: "success",
  attribuee: "purple",
  terminee: "success",
  annulee: "danger",
};
export const trajetStatutTone: Record<string, BadgeTone> = {
  en_attente: "warning",
  attribue: "info",
  accepte: "info",
  en_cours: "purple",
  termine: "success",
  annule: "danger",
};
export const convoyeurStatutTone: Record<string, BadgeTone> = {
  en_attente: "warning",
  valide: "success",
  refuse: "danger",
  suspendu: "neutral",
};
export const attributionStatutTone: Record<string, BadgeTone> = {
  propose: "warning",
  accepte: "success",
  refuse: "danger",
  en_cours: "purple",
  en_attente_validation: "warning",
  validee: "success",
  refusee: "danger",
  termine: "success",
  annule: "neutral",
};
export const devisStatutTone: Record<string, BadgeTone> = {
  envoye: "info",
  accepte: "success",
  refuse: "danger",
  convertit: "primary",
};

/* ============= Inputs ============= */
export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return (
    <input
      {...rest}
      className={`w-full px-3 py-2 bg-white border border-pro-border rounded-md text-sm text-pro-text placeholder:text-pro-muted focus:border-pro-accent focus:ring-2 focus:ring-pro-accent/20 focus:outline-none transition-colors ${className}`}
    />
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Rechercher...",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative w-full sm:w-72">
      <Search
        size={15}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-pro-muted pointer-events-none"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-3 py-2 bg-white border border-pro-border rounded-md text-sm text-pro-text placeholder:text-pro-muted focus:border-pro-accent focus:ring-2 focus:ring-pro-accent/20 focus:outline-none"
      />
    </div>
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", ...rest } = props;
  return (
    <select
      {...rest}
      className={`px-3 py-2 bg-white border border-pro-border rounded-md text-sm text-pro-text focus:border-pro-accent focus:ring-2 focus:ring-pro-accent/20 focus:outline-none ${className}`}
    />
  );
}

export function FormField({
  label,
  children,
  required,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-pro-text-soft mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

/* ============= Buttons ============= */
type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
type BtnSize = "sm" | "md";
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: BtnSize;
  icon?: ReactNode;
}
export function Button({
  variant = "primary",
  size = "md",
  icon,
  children,
  className = "",
  ...rest
}: BtnProps) {
  const variants: Record<BtnVariant, string> = {
    primary: "bg-pro-accent text-white hover:bg-pro-accent-hover",
    secondary: "bg-white text-pro-text border border-pro-border hover:bg-pro-bg-soft",
    ghost: "text-pro-text-soft hover:bg-pro-bg-soft hover:text-pro-text",
    danger: "bg-red-600 text-white hover:bg-red-700",
    success: "bg-emerald-600 text-white hover:bg-emerald-700",
  };
  const sizes: Record<BtnSize, string> = {
    sm: "px-2.5 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
  };
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}

export function IconButton({
  children,
  title,
  tone = "neutral",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "neutral" | "primary" | "success" | "danger" }) {
  const tones = {
    neutral: "text-pro-muted hover:text-pro-text hover:bg-pro-bg-soft",
    primary: "text-pro-muted hover:text-pro-accent hover:bg-pro-accent/10",
    success: "text-pro-muted hover:text-emerald-600 hover:bg-emerald-50",
    danger: "text-pro-muted hover:text-red-600 hover:bg-red-50",
  };
  return (
    <button
      {...rest}
      title={title}
      className={`w-8 h-8 inline-flex items-center justify-center rounded-md transition-colors ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

/* ============= Table ============= */
export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white border border-pro-border rounded-xl shadow-pro-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">{children}</table>
      </div>
    </div>
  );
}
export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-pro-bg-soft/60 border-b border-pro-border">
      <tr>{children}</tr>
    </thead>
  );
}
export function TH({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <th
      className={`text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-pro-text-soft ${className}`}
    >
      {children}
    </th>
  );
}
export function TR({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <tr
      onClick={onClick}
      className={`border-b border-pro-border last:border-0 hover:bg-pro-bg-soft/50 transition-colors ${
        onClick ? "cursor-pointer" : ""
      }`}
    >
      {children}
    </tr>
  );
}
export function TD({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`py-3 px-4 text-pro-text ${className}`}>{children}</td>;
}

/* ============= EmptyState ============= */
export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description?: string;
}) {
  return (
    <div className="bg-white border border-pro-border rounded-lg p-12 text-center">
      {Icon && (
        <div className="w-12 h-12 rounded-full bg-pro-bg-soft mx-auto mb-3 flex items-center justify-center text-pro-muted">
          <Icon size={22} />
        </div>
      )}
      <p className="text-pro-text font-medium">{title}</p>
      {description && <p className="text-pro-muted text-sm mt-1">{description}</p>}
    </div>
  );
}

/* ============= Modal ============= */
export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  if (!open) return null;
  const sizes = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-xl shadow-xl w-full ${sizes[size]} max-h-[90vh] overflow-hidden flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-pro-border flex items-center justify-between">
          <h3 className="text-pro-text font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md hover:bg-pro-bg-soft flex items-center justify-center text-pro-muted hover:text-pro-text"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="py-2 border-b border-pro-border last:border-0">
      <p className="text-[11px] uppercase tracking-wider text-pro-muted font-medium">{label}</p>
      <p className="text-sm text-pro-text mt-0.5">{value}</p>
    </div>
  );
}
