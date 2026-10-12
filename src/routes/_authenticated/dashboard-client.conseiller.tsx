import { createFileRoute } from "@tanstack/react-router";
import ClientPageHeader from "@/components/dashboard/ClientPageHeader";
import { ConseillerChat } from "@/components/chat/ConseillerChat";

export const Route = createFileRoute("/_authenticated/dashboard-client/conseiller")({
  head: () => ({ meta: [{ title: "Parler à un conseiller — Transports Ligneo" }] }),
  component: ConseillerPage,
});

function ConseillerPage() {
  return (
    <div className="space-y-6">
      <ClientPageHeader
        breadcrumb="Conseiller"
        eyebrow="Messagerie"
        title="Parler à"
        highlight="un conseiller"
        subtitle="Écrivez directement à l'équipe Transports Ligneo. Vous recevez un email dès qu'un conseiller vous répond."
      />
      <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl" style={{ background: "#061238" }}>
        <ConseillerChat mode="client" />
      </div>
    </div>
  );
}
