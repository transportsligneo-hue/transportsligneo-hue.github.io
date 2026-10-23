import { ShieldCheck } from "lucide-react";
import { TOTAL_TRIPS, tripsForRoute } from "@/lib/route-track-record";

/** Preuve sociale sous le prix : trajets réussis sur l'axe demandé, sinon total global. */
export default function TrackRecordLine({ fromCity, toCity }: { fromCity: string; toCity: string }) {
  const n = tripsForRoute(fromCity, toCity);
  return (
    <p className="mt-3 flex items-center gap-2 text-xs text-cream/80">
      <ShieldCheck size={14} className="text-emerald-400" />
      {n >= 10
        ? <span><b className="text-cream">{n} trajets réussis</b> sur cet axe · plus de {TOTAL_TRIPS} véhicules convoyés au total</span>
        : <span><b className="text-cream">Plus de {TOTAL_TRIPS} véhicules convoyés</b> · assurance incluse sur chaque trajet</span>}
    </p>
  );
}
