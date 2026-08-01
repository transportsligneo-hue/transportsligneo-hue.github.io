import { Radar } from "lucide-react";

/**
 * État vide "aucun trajet actif" avec effet radar animé.
 */
export function RadarEmptyV6({ title = "Aucun trajet actif", subtitle = "Les missions en cours s'afficheront ici en temps réel." }: { title?: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10">
      <div className="a6-radar mb-4">
        <span className="a6-radar-ring" />
        <span className="a6-radar-ring" />
        <span className="a6-radar-ring" />
        <span className="a6-radar-ic">
          <Radar size={24} />
        </span>
      </div>
      <p className="text-[13.5px] font-bold text-[var(--a6-text)]">{title}</p>
      <p className="text-[11.5px] text-[var(--a6-dim)] mt-1 max-w-[280px]">{subtitle}</p>
    </div>
  );
}
