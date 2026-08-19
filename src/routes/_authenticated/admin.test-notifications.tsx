import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/admin/AdminUI";
import { AdminSection } from "@/components/admin/ui";
import { PushTestPanel } from "@/components/admin/PushTestPanel";

export const Route = createFileRoute("/_authenticated/admin/test-notifications")({
  component: AdminTestNotificationsPage,
  head: () => ({
    meta: [
      { title: "Test notifications driver | Transports Ligneo" },
      { name: "description", content: "Envoyer des notifications de test aux convoyeurs sur l'app Ligneo Driver et le navigateur." },
      { property: "og:title", content: "Test notifications driver | Transports Ligneo" },
      { property: "og:description", content: "Outil admin de test des notifications push convoyeurs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function AdminTestNotificationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Espace administration"
        title="Test des notifications driver"
        subtitle="Envoyez une notification de test aux convoyeurs : app mobile Ligneo Driver (Capacitor) et navigateur."
      />
      <AdminSection
        title="Notification de test"
        description="Choisissez un modèle ou rédigez votre message, ciblez un ou plusieurs convoyeurs, puis envoyez."
      >
        <PushTestPanel />
      </AdminSection>
    </div>
  );
}
