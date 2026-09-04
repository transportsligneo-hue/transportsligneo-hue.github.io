import { createFileRoute } from "@tanstack/react-router";
import { AdminScanDocumentPanel } from "@/components/admin/AdminScanDocumentPanel";

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
      <header>
        <h1 className="text-xl sm:text-2xl font-bold">Scanner un document</h1>
        <p className="text-sm opacity-70">
          Photographiez ou importez un document (devis signé, PV, carte grise, facture…) et classez-le
          dans la mission du client. Rien n'est classé sans votre confirmation.
        </p>
      </header>
      <AdminScanDocumentPanel />
    </div>
  );
}
