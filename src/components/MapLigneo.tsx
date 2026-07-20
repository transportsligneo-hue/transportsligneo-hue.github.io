import mapSvgRaw from "@/assets/ligneo-map.svg?raw";

interface Props {
  size?: "big" | "small";
  className?: string;
}

/**
 * Carte France + Europe · reproduction fidèle de carte-finale.html
 * Toutes les classes SVG (.eu-country, .fr-country, .line-fr, .dot-fr, .hub-ring, .car, etc.)
 * sont scopées sous .ligneo-map dans src/styles.css. Ne pas modifier le SVG.
 */
export default function MapLigneo({ size = "big", className = "" }: Props) {
  return (
    <div className={`ligneo-map ligneo-map-${size} ${className}`}>
      <div className="ligneo-map-card">
        <div
          className="ligneo-map-inner"
          dangerouslySetInnerHTML={{ __html: mapSvgRaw }}
        />
        <div className="ligneo-map-legend">
          <div className="ligneo-map-legend-item">
            <span className="ligneo-map-legend-dot" />
            Tours · Notre base
          </div>
        </div>
      </div>
    </div>
  );
}
