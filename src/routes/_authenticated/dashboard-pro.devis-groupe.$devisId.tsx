import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { GroupedDevisLots } from "@/components/devis-lots/GroupedDevisLots";

export const Route = createFileRoute("/_authenticated/dashboard-pro/devis-groupe/$devisId")({
  head: () => ({
    meta: [
      { title: "Devis groupé : validation par lots | Transports Ligneo" },
      { name: "description", content: "Mélangez les types de missions et validez votre devis groupé par lots successifs." },
      { property: "og:title", content: "Devis groupé : validation par lots | Transports Ligneo" },
      { property: "og:description", content: "Validez votre devis groupé par sélections successives." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { devisId } = Route.useParams();
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 pb-40">
      <Link to="/dashboard-pro/documents" className="mb-4 inline-flex items-center gap-2 text-sm text-pro-muted hover:text-pro-text">
        <ArrowLeft size={16} /> Factures et devis
      </Link>
      <GroupedDevisLots devisId={devisId} />
    </div>
  );
}
