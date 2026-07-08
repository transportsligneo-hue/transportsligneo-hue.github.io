import { getMissionStatus, TONE_CLASSES } from "@/lib/mission-status";

interface Props {
  status: string | null | undefined;
  size?: "sm" | "md";
  short?: boolean;
  className?: string;
}

export function MissionStatusBadge({ status, size = "sm", short = false, className = "" }: Props) {
  const meta = getMissionStatus(status);
  const tone = TONE_CLASSES[meta.tone];
  const pad = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
  return (
    <span
      title={meta.description || meta.label}
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${pad} ${tone} ${className}`}
    >
      {meta.pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full rounded-full opacity-70 animate-ping bg-current" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      <span className="truncate max-w-[220px]">{short ? meta.short : meta.label}</span>
    </span>
  );
}
