import "@/styles/driver-v2.css";

/** Squelette de page (remplace les ronds de chargement) : cartes qui se remplissent, sans rien qui tourne. */
export function PageSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="drv2">
      <div className="dsk" aria-busy="true" aria-label="Chargement">
        <div className="dsk-row">
          <span className="dsk-col"><i style={{ width: "46%", height: 22 }} /><i style={{ width: "30%" }} /></span>
        </div>
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="dsk-card" style={{ height: i === 0 ? 130 : 96 }} />
        ))}
      </div>
    </div>
  );
}
