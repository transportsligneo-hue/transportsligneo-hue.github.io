import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/entreprise/factures")({
  component: EntrepriseFactures,
});

function EntrepriseFactures() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-pro-text">Factures</h1>
        <p className="text-sm text-pro-muted mt-1">Historique de facturation de votre entreprise.</p>
      </div>
      <Card>
        <CardContent className="py-16 text-center text-pro-muted">
          <FileText size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">La facturation centralisée arrive très bientôt.</p>
        </CardContent>
      </Card>
    </div>
  );
}
