import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Calculator, BookOpen, Printer } from "lucide-react";
import { PageHeader } from "@/components/admin/AdminUI";
import grilleHtml from "@/lib/admin-grille-html";
import ficheHtml from "@/lib/admin-fiche-html";

export const Route = createFileRoute("/_authenticated/admin/grille-tarifaire")({
  component: AdminGrilleTarifaire,
});

type Tab = "grille" | "fiche";

function AdminGrilleTarifaire() {
  const [tab, setTab] = useState<Tab>("grille");

  const print = () => {
    const frame = document.getElementById("grille-frame") as HTMLIFrameElement | null;
    frame?.contentWindow?.focus();
    frame?.contentWindow?.print();
  };

  const tabBtn = (id: Tab, label: string, Icon: typeof Calculator) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={
        "inline-flex items-center gap-2 h-10 px-4 rounded-xl text-[13px] font-bold border transition " +
        (tab === id
          ? "text-white border-transparent bg-gradient-to-br from-[#2f5fff] to-[#1c3fc4] shadow-[0_8px_20px_rgba(47,95,255,.28)]"
          : "text-[#70727d] bg-white border-[#eaeaee] hover:bg-[#eaf0ff] hover:text-[#2f5fff]")
      }
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Grille tarifaire et fiche équipe"
        subtitle="Calculateur de prix et marge, et guide pour les nouvelles personnes de l'équipe."
        actions={
          <button
            type="button"
            onClick={print}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-[13px] font-bold text-[#2f5fff] bg-white border border-[#dce6fd] hover:bg-[#eaf0ff] transition"
          >
            <Printer className="w-4 h-4" />
            Imprimer / PDF
          </button>
        }
      />
      <div className="flex flex-wrap gap-2">
        {tabBtn("grille", "Grille tarifaire", Calculator)}
        {tabBtn("fiche", "Fiche technique équipe", BookOpen)}
      </div>
      <iframe
        id="grille-frame"
        key={tab}
        title={tab === "grille" ? "Grille tarifaire Ligneo" : "Fiche technique équipe Ligneo"}
        srcDoc={tab === "grille" ? grilleHtml : ficheHtml}
        className="w-full rounded-2xl border border-[#eaeaee] bg-white"
        style={{ height: "calc(100vh - 230px)", minHeight: 640 }}
      />
    </div>
  );
}
