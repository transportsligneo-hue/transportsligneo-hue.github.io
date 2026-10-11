import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/admin/AdminUI";
import { AdminConseillerInbox } from "@/components/chat/AdminInbox";

export const Route = createFileRoute("/_authenticated/admin/messagerie-conseiller")({
  head: () => ({ meta: [{ title: "Chat conseiller — Admin Ligneo" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <div className="space-y-4">
      <PageHeader title="Chat conseiller" subtitle="Visiteurs, clients et relais depuis Vroomy" />
      <AdminConseillerInbox />
    </div>
  ),
});
