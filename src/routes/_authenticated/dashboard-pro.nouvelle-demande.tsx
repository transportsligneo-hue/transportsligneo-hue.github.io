import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import QuickMissionForm from "@/components/dashboard-pro/QuickMissionForm";
import FleetPageHeader from "@/components/flotte/FleetPageHeader";

export const Route = createFileRoute("/_authenticated/dashboard-pro/nouvelle-demande")({
  head: () => ({
    meta: [
      { title: "Mission simple | Transports Ligneo" },
      { name: "description", content: "Créer une mission simple de convoyage dans votre espace Transports Ligneo." },
      { property: "og:title", content: "Mission simple | Transports Ligneo" },
      { property: "og:description", content: "Créer une mission simple de convoyage dans votre espace Transports Ligneo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProNouvelleDemande,
});

function ProNouvelleDemande() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link
          to="/dashboard-pro/nouvelle-mission"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-[#2f5fff]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Retour au choix
        </Link>
        <FleetPageHeader breadcrumb="Mission simple" eyebrow="Nouvelle demande" title="Mission simple" />
      </div>
      <QuickMissionForm successRedirect="/dashboard-pro/missions" />
    </div>
  );
}
