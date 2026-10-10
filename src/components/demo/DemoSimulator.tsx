import { useState } from "react";
import { Calculator, Zap } from "lucide-react";
import { euro } from "@/hooks/useProMissions";

/** Trajets d'exemple depuis Tours (distances routières approximatives). */
const ROUTES = [
  { label: "Tours → Tours (37)", km: 15, local: true },
  { label: "Tours → Le Mans", km: 100 },
  { label: "Tours → Orléans", km: 120 },
  { label: "Tours → Nantes", km: 215 },
  { label: "Tours → Paris", km: 240 },
  { label: "Tours → Bordeaux", km: 345 },
  { label: "Tours → Lyon", km: 440 },
];

/** Estimation indicative de démonstration : 0,85 €/km au-delà de 200 km, forfaits 79 € / 129 € dans le 37. */
export function estimateDemo(km: number, local: boolean, retour: boolean, recharge: boolean) {
  let base: number;
  if (local) base = retour ? 129 : 79;
  else {
    const one = km > 200 ? km * 0.85 : Math.max(79, km * 1.1);
    base = retour ? one * 2 : one;
  }
  return Math.round(base + (recharge ? 25 : 0));
}

export function DemoSimulator() {
  const [i, setI] = useState(4);
  const [retour, setRetour] = useState(false);
  const [elec, setElec] = useState(false);
  const r = ROUTES[i];
  const prix = estimateDemo(r.km, !!r.local, retour, elec);
  return (
    <div className="dpm-card">
      <h3><Calculator size={15} /> Simulateur de prix</h3>
      <div className="demo-sim">
        <label>Trajet
          <select value={i} onChange={(e) => setI(Number(e.target.value))}>
            {ROUTES.map((x, k) => <option key={x.label} value={k}>{x.label}</option>)}
          </select>
        </label>
        <label className="demo-sim-check"><input type="checkbox" checked={retour} onChange={(e) => setRetour(e.target.checked)} /> Livraison + restitution</label>
        <label className="demo-sim-check"><input type="checkbox" checked={elec} onChange={(e) => setElec(e.target.checked)} /> <Zap size={13} /> Recharge électrique à la livraison</label>
      </div>
      <ul className="dpm-facts">
        <li><span>Distance</span><strong>{r.km * (retour ? 2 : 1)} km</strong></li>
        <li><span>Péages et carburant</span><strong>Inclus</strong></li>
        <li><span>Estimation TTC</span><strong className="demo-sim-price">{euro(prix)}</strong></li>
      </ul>
      <p className="dpm-note">Estimation indicative en démonstration. Votre tarif réel est calculé à la commande.</p>
    </div>
  );
}
