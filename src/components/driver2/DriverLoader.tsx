import logo from "@/assets/driver-v2/logo.png";

/** Écran de chargement de l'appli convoyeur : logo + anneau vert animé, sur fond clair. */
export function DriverLoader({ label = "Chargement…", full = false }: { label?: string; full?: boolean }) {
  return (
    <div className="drv2">
      <div className={`dl${full ? " dl-full" : ""}`} role="status" aria-live="polite">
        <div className="dl-wrap">
          <span className="dl-ring" />
          <img src={logo} alt="" />
        </div>
        <p>{label}</p>
      </div>
    </div>
  );
}
