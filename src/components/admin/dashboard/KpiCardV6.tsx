import type { LucideIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

export type KpiTone = "blue" | "ok" | "violet" | "gold" | "warn";

interface Props {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone: KpiTone;
  sub?: string;
  trend?: { label: string; positive?: boolean };
  /** Série pour la mini-courbe. Si absente/plate → ligne plate. */
  series?: number[];
  /** Destination : rend la carte cliquable. */
  to?: string;
}

const STROKE: Record<KpiTone, string> = {
  blue: "#2f5fff",
  ok: "#189a72",
  violet: "#7c5cff",
  gold: "#b8862a",
  warn: "#c07d1f",
};

function Sparkline({ series, tone }: { series: number[]; tone: KpiTone }) {
  const w = 120;
  const h = 28;
  const pts = series.length >= 2 ? series : [0, 0];
  const max = Math.max(...pts);
  const min = Math.min(...pts);
  const span = max - min || 1;
  const step = w / (pts.length - 1);
  const coords = pts.map((v, i) => {
    const x = i * step;
    const y = max === min ? h / 2 : h - 3 - ((v - min) / span) * (h - 6);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const d = `M ${coords.join(" L ")}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-7 mt-3 relative z-[1]" preserveAspectRatio="none" aria-hidden="true">
      <path d={d} fill="none" stroke={STROKE[tone]} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} className="a6-area-path" />
    </svg>
  );
}

export function KpiCardV6({ label, value, icon: Icon, tone, sub, trend, series, to }: Props) {
  const cardTone = tone === "blue" ? "c-blue" : tone === "ok" ? "c-ok" : tone === "violet" ? "c-violet" : tone === "gold" ? "c-gold" : "c-warn";
  const inner = (
    <>
      <div className="flex items-center justify-between mb-3 relative z-[1]">
        <span className={`a6-kpi-ic ${tone}`}>
          <Icon size={18} />
        </span>
        {trend && (
          <span className={`a6-kpi-trend ${trend.positive ? "up" : "flat"}`}>{trend.label}</span>
        )}
      </div>
      <p className="a6-kpi-k mb-1.5">{label}</p>
      <p className="a6-kpi-v">{value}</p>
      {sub && <p className="a6-kpi-sub mt-1">{sub}</p>}
      <Sparkline series={series && series.length >= 2 ? series : [0, 0, 0, 0, 0, 0, 0]} tone={tone} />
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className={`a6-kpi ${cardTone} group block text-left transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--a6-blue,#2F5FFF)]`}
      >
        <span className="absolute top-3 right-3 z-[2] opacity-0 group-hover:opacity-100 transition-opacity text-[var(--a6-dim)]">
          <ArrowUpRight size={14} />
        </span>
        {inner}
      </Link>
    );
  }

  return <div className={`a6-kpi ${cardTone}`}>{inner}</div>;
}
