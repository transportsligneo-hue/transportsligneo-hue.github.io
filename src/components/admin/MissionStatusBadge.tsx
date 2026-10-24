import { getMissionStatus } from "@/lib/mission-status";
import { LgBadge } from "@/components/ui/LgBadge";

interface Props {
  status: string | null | undefined;
  size?: "sm" | "md";
  short?: boolean;
  className?: string;
}

export function MissionStatusBadge({ status, size = "sm", short = false, className = "" }: Props) {
  const meta = getMissionStatus(status);
  return (
    <LgBadge
      color={meta.color ?? "#64748B"}
      size={size}
      title={meta.description || meta.label}
      className={className}
    >
      {short ? meta.short : meta.label}
    </LgBadge>
  );
}
