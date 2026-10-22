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

/** Petite carte de France avec une épingle sur Tours. */
export function FranceTours({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path
        d="M50.3 9.2 47.3 10.0 46.0 16.0 43.2 18.4 37.8 21.6 30.7 20.0 28.5 20.4 29.1 28.8 26.4 28.4 19.8 26.8 12.7 28.0 11.6 30.8 13.8 34.4 18.7 35.6 25.3 39.6 30.7 48.4 31.3 52.8 30.7 60.8 28.8 69.6 33.4 75.2 41.1 75.2 54.1 78.0 53.9 75.2 54.1 72.4 57.4 70.4 62.3 70.4 66.7 71.6 70.0 72.8 73.2 72.0 76.8 68.0 78.1 67.4 74.9 63.2 75.9 56.8 74.3 50.4 70.5 48.0 70.5 45.6 75.4 37.6 78.7 36.8 78.4 29.6 81.9 25.6 72.1 21.6 68.9 21.2 63.7 16.8 60.1 15.2 54.7 11.6Z"
        fill="rgba(47,95,255,.16)"
        stroke="#5b8fff"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <g transform="translate(0 0)">
        <circle cx="41" cy="38.5" r="9" fill="rgba(46,230,113,.25)">
          <animate attributeName="r" values="5;12;5" dur="2s" repeatCount="indefinite" />
        </circle>
        <path d="M41 47.5c-5-6-8-9-8-13a8 8 0 0 1 16 0c0 4-3 7-8 13Z" fill="#ff4d5e" />
        <circle cx="41" cy="34.5" r="3" fill="#fff" />
      </g>
    </svg>
  );
}
