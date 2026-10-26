/** Petits graphiques SVG des pages Statistiques (une seule couleur, bleu électrique, info-bulle au doigt). */
import { useRef, useState, type PointerEvent, type ReactNode } from "react";

export const fr = (n: number, d = 0) => n.toLocaleString("fr-FR", { maximumFractionDigits: d, minimumFractionDigits: d });

export function Kpi({ label, value, sub, live }: { label: string; value: string; sub?: ReactNode; live?: boolean }) {
  return (
    <div className="ast-kpi">
      <small>{live && <i className="ast-live" />}{label}</small>
      <b>{value}</b>
      {sub && <em>{sub}</em>}
    </div>
  );
}

export function Trend({ now, before, suffix = "vs période d'avant" }: { now: number; before: number; suffix?: string }) {
  if (!before) return <>{suffix === "" ? null : "Première période mesurée"}</>;
  const pct = Math.round(((now - before) / before) * 100);
  return <><span className={pct >= 0 ? "ast-up" : "ast-down"}>{pct >= 0 ? "+" : ""}{pct} %</span> {suffix}</>;
}

export function AreaChart({ data, label }: { data: { day: string; value: number }[]; label: string }) {
  const W = 720, H = 230, pl = 36, pr = 10, pt = 10, pb = 26;
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  if (!data.length) return <p className="ast-empty">Pas encore de données.</p>;
  const maxRaw = Math.max(1, ...data.map((d) => d.value));
  const stepTick = maxRaw <= 10 ? 2 : maxRaw <= 50 ? 10 : maxRaw <= 200 ? 50 : maxRaw <= 1000 ? 250 : 1000;
  const max = Math.ceil(maxRaw / stepTick) * stepTick;
  const n = data.length;
  const x = (i: number) => pl + (W - pl - pr) * (n === 1 ? 0.5 : i / (n - 1));
  const y = (v: number) => pt + (H - pt - pb) * (1 - v / max);
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join("");
  const area = `${line}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z`;
  const ticks: number[] = []; for (let t = 0; t <= max; t += stepTick) ticks.push(t);
  const every = Math.max(1, Math.ceil(n / 6));
  const fmt = (s: string) => { const d = new Date(`${s}T12:00:00`); return `${d.getDate()}/${d.getMonth() + 1}`; };
  const onMove = (e: PointerEvent) => {
    const r = ref.current?.getBoundingClientRect(); if (!r) return;
    const px = ((e.clientX - r.left) * W) / r.width;
    setHover(Math.max(0, Math.min(n - 1, Math.round(((px - pl) / (W - pl - pr)) * (n - 1)))));
  };
  const h = hover != null ? data[hover] : null;
  return (
    <div className="ast-chart">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        <defs><linearGradient id="ast-ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2f5fff" stopOpacity=".22" /><stop offset="1" stopColor="#2f5fff" stopOpacity="0" /></linearGradient></defs>
        {ticks.map((t) => (<g key={t}><line x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} className="ast-grid" /><text x={pl - 8} y={y(t) + 4} textAnchor="end">{t}</text></g>))}
        {data.map((d, i) => (i % every === 0 ? <text key={d.day} x={x(i)} y={H - 6} textAnchor="middle">{fmt(d.day)}</text> : null))}
        <path d={area} fill="url(#ast-ga)" />
        <path d={line} fill="none" stroke="#2f5fff" strokeWidth={2} strokeLinejoin="round" />
        <circle cx={x(n - 1)} cy={y(data[n - 1].value)} r={4.5} fill="#2f5fff" stroke="#fff" strokeWidth={2} />
        {h && hover != null && (<g><line x1={x(hover)} x2={x(hover)} y1={pt} y2={H - pb} className="ast-cross" /><circle cx={x(hover)} cy={y(h.value)} r={5} fill="#2f5fff" stroke="#fff" strokeWidth={2} /></g>)}
        <rect x={pl} y={0} width={W - pl - pr} height={H} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} />
      </svg>
      {h && hover != null && (
        <div className="ast-tip" style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(h.value) / H) * 100}%` }}>
          {fr(h.value)} visiteur{h.value > 1 ? "s" : ""}
          <span>{new Date(`${h.day}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</span>
        </div>
      )}
    </div>
  );
}

export function HBars({ rows, unit = "" }: { rows: { label: string; n: number }[]; unit?: string }) {
  if (!rows.length) return <p className="ast-empty">Pas encore de données.</p>;
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="ast-hbars">
      {rows.map((r) => (
        <div key={r.label} className="ast-hb">
          <span className="l">{r.label}</span>
          <span className="v">{fr(r.n)}{unit}</span>
          <span className="t"><i style={{ width: `${(r.n / max) * 100}%` }} /></span>
        </div>
      ))}
    </div>
  );
}

export function Funnel({ steps }: { steps: { label: string; n: number }[] }) {
  const top = Math.max(1, steps[0]?.n ?? 1);
  return (
    <div className="ast-funnel">
      {steps.map((s, i) => (
        <div key={s.label} className="ast-fs">
          <span className="l">{s.label}</span>
          <span className="v">{fr(s.n)}{i > 0 && steps[i - 1].n > 0 && <small>{Math.round((s.n / steps[i - 1].n) * 100)} %</small>}</span>
          <span className="t"><i style={{ width: `${Math.max(2, (s.n / top) * 100)}%` }} /></span>
        </div>
      ))}
    </div>
  );
}

export function Columns({ rows, label }: { rows: { label: string; value: number; dim?: boolean; title: string }[]; label: string }) {
  const W = 420, H = 220, pl = 34, pb = 26, pt = 16;
  const maxRaw = Math.max(5, ...rows.map((r) => r.value));
  const max = Math.ceil(maxRaw / 5) * 5;
  const bw = (W - pl - 10) / Math.max(1, rows.length);
  const ticks: number[] = []; for (let t = 0; t <= max; t += max / 5) ticks.push(t);
  return (
    <div className="ast-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {ticks.map((t) => { const yy = pt + (H - pt - pb) * (1 - t / max); return (<g key={t}><line x1={pl} x2={W - 6} y1={yy} y2={yy} className="ast-grid" /><text x={pl - 6} y={yy + 4} textAnchor="end">{Math.round(t)}%</text></g>); })}
        {rows.map((r, i) => {
          const h = ((H - pt - pb) * r.value) / max, x0 = pl + i * bw + bw * 0.18, w = bw * 0.64, y0 = H - pb - h;
          const rad = Math.min(4, h / 2);
          return (
            <g key={r.label}>
              <path d={`M${x0},${H - pb}V${y0 + rad}a${rad},${rad} 0 0 1 ${rad},-${rad}h${w - 2 * rad}a${rad},${rad} 0 0 1 ${rad},${rad}V${H - pb}Z`} fill={r.dim ? "#9db6ff" : "#2f5fff"}><title>{r.title}</title></path>
              <text x={x0 + w / 2} y={y0 - 6} textAnchor="middle" className="ast-val">{r.value}%</text>
              <text x={x0 + w / 2} y={H - 8} textAnchor="middle">{r.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
