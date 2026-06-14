import { createFileRoute } from "@tanstack/react-router";
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
      <div>
        <h1 className="font-heading text-2xl text-primary tracking-[0.1em] uppercase">
          Mes adresses favorites
        </h1>
        <p className="text-cream/60 text-sm mt-1">
          Enregistrez vos adresses récurrentes pour les réutiliser en 1&nbsp;clic dans le simulateur.
        </p>
      </div>

      <FavoriteAddressesManager
        clientUserId={user.id}
        clientEmail={user.email ?? ""}
        variant="client"
      />
    </div>
  );
}
