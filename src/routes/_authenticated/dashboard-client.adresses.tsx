import { createFileRoute } from "@tanstack/react-router";
import ClientPageHeader from "@/components/dashboard/ClientPageHeader";
import { useAuth } from "@/hooks/useAuth";
import { FavoriteAddressesManager } from "@/components/dashboard-pro/FavoriteAddressesManager";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard-client/adresses")({
  component: ClientAdressesPage,
});

function ClientAdressesPage() {
  const { user, isLoading } = useAuth();

  if (isLoading || !user) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ClientPageHeader
        breadcrumb="Mes adresses"
        eyebrow="Carnet d'adresses"
        title="Mes adresses"
        highlight="favorites"
        subtitle="Enregistrez vos adresses récurrentes pour les réutiliser en 1 clic dans le simulateur."
      />

      <FavoriteAddressesManager
        clientUserId={user.id}
        clientEmail={user.email ?? ""}
        variant="client"
      />
    </div>
  );
}
