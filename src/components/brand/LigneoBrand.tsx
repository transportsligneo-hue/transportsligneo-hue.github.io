import logoLigneo from "@/assets/logo-transports-ligneo.jpg";

export type LigneoRole = "admin" | "driver" | "client" | "partner";

interface Props {
  role: LigneoRole;
  /** Compact = pour mobile header (sans wordmark sous le logo) */
  compact?: boolean;
  /** Variante claire (fond blanc/SaaS) ou sombre (fond navy) */
  variant?: "light" | "dark";
}

const roleConfig: Record<LigneoRole, { label: string; bg: string; ring: string; text: string }> = {
  admin: {
    label: "Admin",
    bg: "role-admin-bg",
    ring: "role-admin-border",
    text: "text-white",
  },
  driver: {
    label: "Driver",
    bg: "role-driver-bg",
    ring: "role-driver-border",
    text: "text-white",
  },
  client: {
    label: "Client",
    bg: "role-client-bg",
    ring: "role-client-border",
    text: "text-white",
  },
  partner: {
    label: "Partenaire",
    bg: "role-partner-bg",
    ring: "role-partner-border",
    text: "text-white",
  },
};

/**
 * Identité visuelle "Transports Ligneo" + badge rôle.
 * S'utilise dans les sidebars (desktop + mobile) de tous les espaces.
 */
export function LigneoBrand({ role, compact = false, variant = "light" }: Props) {
  const cfg = roleConfig[role];
  const wordmarkColor = variant === "dark" ? "text-cream" : "text-pro-text";
  const tagColor = variant === "dark" ? "text-cream/60" : "text-pro-muted";

  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="w-9 h-9 rounded-lg overflow-hidden ring-1 ring-black/5 shrink-0 bg-[#0b1026]">
        <img
          src={logoLigneo}
          alt="Transports Ligneo"
          className="w-full h-full object-cover"
        />
      </div>
      <div className="min-w-0 flex flex-col">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`font-heading text-[13px] tracking-[0.06em] truncate ${wordmarkColor}`}>
            Transports Ligneo
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span
            className={`inline-flex items-center px-1.5 py-[1px] rounded text-[10px] font-semibold uppercase tracking-wider ${cfg.bg} ${cfg.text}`}
          >
            {cfg.label}
          </span>
          {!compact && (
            <span className={`text-[10px] ${tagColor}`}>· Espace pro</span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Badge rôle seul (pour pages mission, listes, headers contextuels) */
export function RoleBadge({ role, className = "" }: { role: LigneoRole; className?: string }) {
  const cfg = roleConfig[role];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider ${cfg.bg} ${cfg.text} ${className}`}
    >
      {cfg.label}
    </span>
  );
}
