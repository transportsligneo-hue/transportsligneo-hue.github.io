import TunnelReservation from "@/components/TunnelReservation";
import MobileFooter from "@/components/mobile/MobileFooter";
import { PageHero } from "@/components/mobile/MobilePageBits";

/** Réserver mobile · le vrai tunnel de réservation dans un cadre navy. */
export default function MobileReserverScreen() {
  return (
    <div className="mh2-root md:hidden">
      <PageHero
        kicker="Réservation"
        title={<>Votre <em>convoyage</em></>}
        text="Cinq étapes simples. Tarif transparent, péages et carburant inclus."
      />
      <div className="mp-tunnel">
        <TunnelReservation />
      </div>
      <MobileFooter withStores={false} />
    </div>
  );
}
