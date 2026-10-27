const logo = "/icons/logo-driver-app.png";

/** Écran de chargement de l'appli convoyeur : logo Ligneo qui respire, halo vert, barre de progression douce. */
export function DriverLoader({ label = "Chargement…", full = false }: { label?: string; full?: boolean }) {
  // Plein écran : EXACTEMENT le même écran que le démarrage (app-start, lg-boot, MobileAppGate, login) :
  // même logo, mêmes tailles, même position, aucun saut entre deux écrans de chargement.
  if (full) {
    return (
      <div aria-hidden className="lb-screen" role="status">
        <div className="lb-mark"><i className="lb-halo" /><img src={logo} alt="" /></div>
        <strong className="lb-brand">TRANSPORTS LIGNEO<em>DRIVER</em></strong>
        <span className="lb-bar"><b /></span>
      </div>
    );
  }
  return (
    <div className="drv2">
      <div className="dl" role="status" aria-live="polite">
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
