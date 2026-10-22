import type { SVGProps } from "react";

/** Icônes sur mesure de l'accueil mobile (mêmes tracés que la maquette). */
const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  width: "1em",
  height: "1em",
};

/** Itinéraire du point A au point B : deux épingles reliées par un trait pointillé. */
export function RouteAB(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props} aria-hidden="true">
      <path d="M6 22c-2.2-2.4-3.5-4.2-3.5-6a3.5 3.5 0 0 1 7 0c0 1.8-1.3 3.6-3.5 6z" />
      <circle cx="6" cy="16" r="1.2" />
      <path d="M18 10.5c-2.2-2.4-3.5-4.2-3.5-6a3.5 3.5 0 0 1 7 0c0 1.8-1.3 3.6-3.5 6z" />
      <circle cx="18" cy="4.5" r="1.2" />
      <path d="M10.5 19h3.5a3.5 3.5 0 0 0 0-7h-.5" strokeDasharray="2 2.5" />
    </svg>
  );
}

/** Volant : le convoyeur. */
export function SteeringWheel(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M2.5 10.2c3 .3 5.4.9 7 1.2M21.5 10.2c-3 .3-5.4.9-7 1.2M12 14.5V22" />
    </svg>
  );
}

/** Logo Google (multicolore). */
export function GoogleG({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
