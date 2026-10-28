import { createFileRoute } from "@tanstack/react-router";
import { AdminScanDocumentPanel } from "@/components/admin/AdminScanDocumentPanel";
import AdminSectionHeader from "@/components/admin/AdminSectionHeader";

export const Route = createFileRoute("/_authenticated/admin/scan-document")({
  head: () => ({
    meta: [
      { title: "Scanner un document — Administration Ligneo" },
      { name: "description", content: "Scanner ou importer un document terrain et le classer dans la bonne mission client." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ScanDocumentPage,
});

function ScanDocumentPage() {
  return (
    <div className="p-4 sm:p-6 space-y-4">
      <AdminSectionHeader breadcrumb="Scanner un document" eyebrow="Documents" title="Scanner un document" />
      <AdminScanDocumentPanel />
    </div>
  );
}
