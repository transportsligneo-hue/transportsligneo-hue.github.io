import { RetourBlock } from "@/components/driver2/RetourBlock";
import "@/styles/driver-v2.css";

interface Props {
  /** Adresse de livraison de la mission : point de départ du retour. */
  livraison: string;
  electrique?: boolean;
  vehicule?: string | null;
}

/** « Préparer mon retour » : voir RetourBlock. */
export function ReturnTripHelper({ livraison, electrique, vehicule }: Props) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-[#08243f]">Préparer mon retour</h4>
      <RetourBlock livraison={livraison} electrique={electrique} vehicule={vehicule} />
    </div>
  );
}
