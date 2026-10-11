import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/admin/AdminUI";
import { AdminMissionInbox } from "@/components/chat/AdminInbox";

export const Route = createFileRoute("/_authenticated/admin/messagerie")({
  head: () => ({ meta: [{ title: "Chat des missions — Admin Ligneo" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <div className="space-y-4">
      <PageHeader title="Chat des missions" subtitle="Échanges client et convoyeur, mission par mission" />
      <AdminMissionInbox />
    </div>
  ),
});
