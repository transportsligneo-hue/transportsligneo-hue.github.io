import type { ReactNode } from "react";

export type FleetHeaderStat = {
  label: string;
  value: ReactNode;
  tone?: "default" | "accent" | "warn";
};

type Props = {
  breadcrumb: string;
  /** Racine du fil d'Ariane (par défaut « Espace Flotte ») */
  space?: string;
  eyebrow: string;
  title: ReactNode;
  /** Mot-clé souligné en bleu */
  highlight?: string;
  subtitle?: ReactNode;
  badge?: string | null;
  actions?: ReactNode;
  stats?: FleetHeaderStat[];
};

export default function FleetPageHeader({
  breadcrumb,
  space = "Espace Flotte",
  eyebrow,
  title,
  highlight,
  subtitle,
  badge,
  actions,
  stats,
}: Props) {

  return (
    <header className="fleet-header relative overflow-hidden rounded-[18px] border border-[#eaeaee] bg-white px-5 py-6 sm:px-[30px]">
      <span className="fleet-header-orb pointer-events-none absolute -right-10 -top-10 h-[140px] w-[140px] rounded-full" />

      <div className="mb-3.5 flex items-center gap-1.5 text-[12px] text-[#a3a4ac]">
        {space} <span className="opacity-50">/</span>
        <span className="font-semibold text-[#14161c]">{breadcrumb}</span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0">
          <div className="mb-2 inline-flex items-center gap-[7px] text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#2f5fff]">
            <span className="fleet-header-dot relative h-[5px] w-[5px] rounded-full bg-[#2f5fff]" />
            {eyebrow}
          </div>
          <h1 className="text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-[#14161c] sm:text-[26px]">
            {title}
            {highlight ? (
              <>
                {" "}
                <span className="fleet-header-hl relative z-0 text-[#2f5fff]">{highlight}</span>
              </>
            ) : null}
            {badge ? <span className="fleet-header-badge">{badge}</span> : null}
          </h1>
          {subtitle ? (
            <p className="mt-2 max-w-[520px] text-[13.5px] text-[#70727d]">{subtitle}</p>
          ) : null}
        </div>

        {actions ? <div className="flex flex-shrink-0 flex-wrap gap-2.5">{actions}</div> : null}
      </div>

      {stats && stats.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-x-7 gap-y-3 border-t border-[#eaeaee] pt-[18px]">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="mb-1 text-[10.5px] text-[#a3a4ac]">{s.label}</div>
              <div
                className="font-grotesk text-[17px] font-bold"
                style={{
                  color:
                    s.tone === "accent" ? "#2f5fff" : s.tone === "warn" ? "#d97706" : "#14161c",
                }}
              >
                {s.value}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </header>
  );
}

export function FleetHeaderButton({
  variant = "solid",
  accent = "violet",
  children,
  onClick,
  type = "button",
}: {
  variant?: "solid" | "ghost";
  accent?: "violet" | "blue";
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={
        variant === "solid"
          ? `flex items-center gap-1.5 rounded-[9px] ${accent === "blue" ? "client-btn-blue" : "fleet-btn-violet"} px-4 py-2.5 text-[12.5px] font-semibold transition-colors`
          : "flex items-center gap-1.5 rounded-[9px] border border-[#eaeaee] bg-white px-4 py-2.5 text-[12.5px] font-semibold text-[#70727d] transition-colors hover:border-[#dedee4] hover:text-[#14161c]"
      }
    >
      {children}
    </button>
  );
}
