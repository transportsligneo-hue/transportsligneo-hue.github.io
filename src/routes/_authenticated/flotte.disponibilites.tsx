import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "lucide-react";

export const Route = createFileRoute("/_authenticated/flotte/disponibilites")({
  component: FlotteDispos,
});

function FlotteDispos() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-pro-text">Disponibilités</h1>
        <p className="text-sm text-pro-muted mt-1">Planning consolidé de votre flotte.</p>
      </div>
      <Card>
        <CardContent className="py-16 text-center text-pro-muted">
          <Calendar size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Vue planning consolidée bientôt disponible.</p>
        </CardContent>
      </Card>
    </div>
  );
}
