import logo from "@/assets/driver-v2/logo.png";

/** Écran de chargement de l'appli convoyeur : logo Ligneo qui respire, halo vert, barre de progression douce. */
export function DriverLoader({ label = "Chargement…", full = false }: { label?: string; full?: boolean }) {
  return (
    <div className="drv2">
      <div className={`dl${full ? " dl-full" : ""}`} role="status" aria-live="polite">
        <div className="dl-wrap">
          <span className="dl-halo" />
          <span className="dl-ring" />
          <img src={logo} alt="" />
        </div>
        <strong className="dl-brand">TRANSPORTS LIGNEO <em>DRIVER</em></strong>
        <span className="dl-bar"><i /></span>
        <p>{label}</p>
      </div>
    </div>
  );
}
