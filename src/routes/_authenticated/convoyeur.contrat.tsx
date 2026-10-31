import { createFileRoute } from "@tanstack/react-router";
import MonContratCard from "@/components/convoyeur/MonContratCard";
import { ParcoursActivation, useAccesMissions } from "@/components/convoyeur/ParcoursActivation";
import { PageSkeleton } from "@/components/driver2/PageSkeleton";

export const Route = createFileRoute("/_authenticated/convoyeur/contrat")({
  head: () => ({ meta: [{ title: "Mon contrat — Ligneo Driver" }] }),
  component: ContratPage,
});

function ContratPage() {
  const { acces } = useAccesMissions();
  if (!acces) return <PageSkeleton />;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-[#0a1638]">Mon contrat</h1>
        <p className="mt-0.5 text-sm text-[#5a6788]">Votre contrat de partenariat avec Transports Ligneo : consultez-le, signez-le et téléchargez-le à tout moment.</p>
      </div>
      <ParcoursActivation acces={acces} />
      <MonContratCard showEmpty />
    </div>
  );
}
