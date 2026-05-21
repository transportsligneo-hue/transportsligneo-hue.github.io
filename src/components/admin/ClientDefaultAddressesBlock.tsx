import { AdminSection } from "@/components/admin/ui";
import { FavoriteAddressesManager } from "@/components/dashboard-pro/FavoriteAddressesManager";

interface Props {
  clientUserId: string;
  clientEmail: string;
}

export function ClientDefaultAddressesBlock({ clientUserId, clientEmail }: Props) {
  return (
    <AdminSection
      title="Adresses favorites"
      description="Sites départ/arrivée récurrents proposés au client dans son formulaire « Nouvelle mission » avec préremplissage automatique."
    >
      <FavoriteAddressesManager clientUserId={clientUserId} clientEmail={clientEmail} variant="admin" />
    </AdminSection>
  );
}
