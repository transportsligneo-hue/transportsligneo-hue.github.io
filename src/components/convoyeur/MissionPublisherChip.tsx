import { BadgeCheck } from "lucide-react";

interface Props {
  nom?: string | null;
  logoUrl?: string | null;
  verifie?: boolean | null;
  /** Version compacte pour les cartes du catalogue. */
  compact?: boolean;
}

function initials(name: string) {
  return name
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/**
 * Bandeau "Mission publiée par [logo] [client]" avec badge Vérifié.
 * Fallback initiales quand aucun logo n'est renseigné sur le profil client.
 */
export function MissionPublisherChip({ nom, logoUrl, verifie, compact }: Props) {
  const label = (nom ?? "").trim();
  if (!label) return null;

  const logo = (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden bg-white font-extrabold text-[#0c1c4d]"
      style={{
        width: compact ? 22 : 34,
        height: compact ? 22 : 34,
        borderRadius: compact ? 7 : 9,
        fontSize: compact ? 8.5 : 12,
        boxShadow: "0 0 0 1px rgba(255,255,255,0.08)",
      }}
    >
      {logoUrl ? (
        <img src={logoUrl} alt={`Logo ${label}`} loading="lazy" className="h-full w-full object-contain" />
      ) : (
        initials(label)
      )}
    </span>
  );

  if (compact) {
    return (
      <div
        className="mt-2.5 flex items-center gap-2 rounded-full px-2.5 py-1.5"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(140,170,255,0.16)",
        }}
      >
        {logo}
        <span className="min-w-0 truncate text-[11.5px] font-bold text-[#e6ecff]">{label}</span>
        {verifie && (
          <span className="ml-auto flex shrink-0 items-center gap-1 text-[9.5px] font-extrabold text-[#5b83ff]">
            <BadgeCheck size={12} /> Vérifié
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className="mb-4 flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5"
      style={{
        background: "linear-gradient(120deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015))",
        border: "1px solid rgba(140,170,255,0.16)",
      }}
    >
      {logo}
      <div className="min-w-0">
        <div className="text-[9.6px] font-extrabold uppercase tracking-[0.06em] text-[#6577ad]">
          Mission publiée par
        </div>
        <div className="truncate text-[13.2px] font-bold text-[#f2f5ff]">{label}</div>
      </div>
      {verifie && (
        <span className="ml-auto flex shrink-0 items-center gap-1 text-[9.8px] font-extrabold text-[#5b83ff]">
          <BadgeCheck size={13} /> Vérifié
        </span>
      )}
    </div>
  );
}
