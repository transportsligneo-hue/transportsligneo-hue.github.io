import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/documents")({
  component: () => (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl text-primary tracking-[0.1em] uppercase">Documents</h1>
      <p className="text-cream/50 text-sm">Gestion des documents convoyeurs — disponible en Phase 2.</p>
    </div>
  ),
});
