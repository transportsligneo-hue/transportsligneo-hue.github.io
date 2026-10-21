import type { CSSProperties } from "react";
import { D2_ICON_PATHS } from "@/components/driver2/icon-paths";
import { displayPlate } from "@/lib/plate-format";

/** Icône de l'appli Driver. Mêmes tracés que la maquette. */
export function Ic({ n, s = 18, sw = 2, style }: { n: string; s?: number; sw?: number; style?: CSSProperties }) {
  if (n === "plateW") return <WPlate h={s} />;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: D2_ICON_PATHS[n] ?? "" }}
    />
  );
}

/** Mini plaque W Garage (WW) — remplace l'icône générique. */
export function WPlate({ h }: { h: number }) {
  const H = Math.round(h * (h < 16 ? 1.45 : 1.05));
  return (
    <span className="wpl" style={{ height: H, width: Math.round(H * 1.9), fontSize: Math.round(H * 0.6) }}>
      <i />
      <b>WW</b>
    </span>
  );
}

const STARS = Array.from({ length: 12 }).map((_, i) => {
  const a = (i / 12) * Math.PI * 2;
  return { cx: +(12 + Math.cos(a) * 8).toFixed(2), cy: +(12 + Math.sin(a) * 8).toFixed(2) };
});

/** Plaque d'immatriculation (même rendu que la maquette). */
export function Plate({ p, lg = false }: { p: string | null | undefined; lg?: boolean }) {
  if (!p) return null;
  return (
    <span className={`pb ${lg ? "pb-md" : "pb-sm"}`}>
      <span className="pb-band">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          {STARS.map((c, i) => (
            <circle key={i} cx={c.cx} cy={c.cy} r="1.25" fill="#fff" />
          ))}
        </svg>
        <b>F</b>
      </span>
      <span className="pb-t">{displayPlate(p)}</span>
    </span>
  );
}
