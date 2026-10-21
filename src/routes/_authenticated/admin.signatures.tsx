import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/admin/AdminUI";
import EsignPanel from "@/components/admin/EsignPanel";

export const Route = createFileRoute("/_authenticated/admin/signatures")({
  component: AdminSignaturesPage,
});

function AdminSignaturesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Signatures électroniques" subtitle="Devis, contrats convoyeurs, contrats clients pro / flotte et autres documents." />
      <EsignPanel />
    </div>
  );
}
