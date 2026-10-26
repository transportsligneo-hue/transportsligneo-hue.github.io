import { ElectricBadge } from "@/components/mission/ElectricBadge";
import { resolveMotorisation, vehicleTypeLabel, shortVin } from "@/lib/vehicle-meta";
import "@/styles-vehicle-meta.css";

interface Props {
  energie?: string | null;
  alt?: (string | null | undefined)[];
  marque?: string | null;
  modele?: string | null;
  type?: string | null;
  vin?: string | null;
  variant?: "light" | "dark";
  /** Affiche « Énergie ? » quand l'énergie est inconnue (admin) pour garder l'emplacement fixe. */
  showUnknown?: boolean;
  className?: string;
}

/**
 * Ligne véhicule UNIQUE (emplacements fixes, toujours dans cet ordre) :
 *   [ Énergie : électrique / hybride / thermique ]  [ Type : SUV, berline… ]  [ VIN ]
 * Utilisée dans toutes les listes de missions (admin, flotte, client, convoyeur).
 */
export function VehicleMetaRow({ energie, alt, marque, modele, type, vin, variant = "light", showUnknown = false, className = "" }: Props) {
  const info = resolveMotorisation([energie, ...(alt ?? [])], marque, modele);
  const typeLbl = vehicleTypeLabel(type);
  const vinShort = shortVin(vin);
  if (!info.kind && !typeLbl && !vinShort && !showUnknown) return null;
  return (
    <div className={`vmeta vmeta-${variant} ${className}`}>
      <span className="vmeta-slot vmeta-energy">
        {info.kind ? (
          <ElectricBadge energie={energie} alt={alt} marque={marque} modele={modele} variant={variant} compact />
        ) : showUnknown ? (
          <span className="vmeta-unknown" title="Énergie non renseignée">Énergie ?</span>
        ) : null}
      </span>
      {typeLbl && <span className="vmeta-slot vmeta-type" title="Type de véhicule">{typeLbl}</span>}
      {vinShort && <span className="vmeta-slot vmeta-vin" title={`VIN ${vin}`}>VIN {vinShort}</span>}
    </div>
  );
}

export default VehicleMetaRow;
