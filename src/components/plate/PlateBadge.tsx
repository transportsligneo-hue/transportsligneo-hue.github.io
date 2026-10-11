import { displayPlate } from "@/lib/plate-format";
import { PlateBand } from "@/components/plate/PlateInput";

const SIZES = { sm: { h: 28, band: 20, fs: 13, ls: 1.5 }, md: { h: 44, band: 30, fs: 20, ls: 2 }, lg: { h: 64, band: 44, fs: 30, ls: 3 } };

export function PlateBadge({ plate, size = "sm" }: { plate: string | null | undefined; size?: "sm" | "md" | "lg" }) {
  if (!plate) return null;
  const s = SIZES[size];
  return (
    <span className={`plate-badge plate-badge-${size}`} style={{ height: s.h }} aria-label={`Immatriculation ${displayPlate(plate)}`}>
      <PlateBand size={s.band} />
      <span style={{ fontSize: s.fs, letterSpacing: s.ls }}>{displayPlate(plate)}</span>
    </span>
  );
}
