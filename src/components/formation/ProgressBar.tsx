export function ProgressBar({ percent, label }: { percent: number; label?: string }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div>
      {label && (
        <div className="flex items-center justify-between text-xs text-pro-muted mb-2">
          <span>{label}</span>
          <span>{clamped}%</span>
        </div>
      )}
      <div className="h-2.5 rounded-full bg-pro-bg-soft overflow-hidden">
        <div
          className="h-full bg-pro-gold-gradient transition-all duration-700 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
