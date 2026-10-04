import { useEffect, useState } from "react";
import { Ribbon } from "lucide-react";

/**
 * Badge « Octobre rose » (ruban rose) affiché à côté du logo
 * pendant le mois d'octobre uniquement — il disparaît automatiquement
 * le 1er novembre, sans intervention.
 */
export default function OctobreRoseBadge({ compact = false }: { compact?: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(new Date().getMonth() === 9); // 9 = octobre
  }, []);

  if (!visible) return null;

  return (
    <span
      className={`or-ribbon${compact ? " or-ribbon--compact" : ""}`}
      title="Octobre rose · Ensemble contre le cancer du sein"
      role="img"
      aria-label="Octobre rose"
    >
      <Ribbon size={compact ? 13 : 14} strokeWidth={2.2} aria-hidden="true" />
      <span className="or-ribbon-label">Octobre rose</span>
    </span>
  );
}
