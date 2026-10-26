import { useEffect } from "react";
import logo from "@/assets/driver-v2/logo.png";

// Premier chargement de l'appli (après l'écran de démarrage) : on reste en plein écran, identique
// à l'écran de démarrage, pour qu'on ne voie qu'UN seul écran de chargement. Ensuite, en naviguant
// dans l'appli, le chargement s'affiche dans la page (l'en-tête et la barre du bas restent visibles).
let bootDone = false;

/** Écran de chargement de l'appli convoyeur : logo Ligneo qui respire, halo vert, barre verte qui se remplit. */
export function DriverLoader({ label = "Chargement…", full = false }: { label?: string; full?: boolean }) {
  const boot = full && !bootDone;
  useEffect(() => () => { if (boot) bootDone = true; }, [boot]);
  return (
    <div className="drv2">
      <div className={`dl${full ? " dl-full" : ""}${boot ? " dl-boot" : ""}`} role="status" aria-live="polite" aria-label="Chargement">
        <div className="dl-wrap">
          <span className="dl-halo" />
          <img src={logo} alt="" />
        </div>
        <strong className="dl-brand">TRANSPORTS LIGNEO <em>DRIVER</em></strong>
        <span className="dl-prog"><i /></span>
        {label ? <p>{label}</p> : null}
      </div>
    </div>
  );
}
