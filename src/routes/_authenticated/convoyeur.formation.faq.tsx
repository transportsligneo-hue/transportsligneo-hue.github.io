import { createFileRoute } from "@tanstack/react-router";
import { HelpCircle } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/convoyeur/formation/faq")({
  head: () => ({
    meta: [
      { title: "FAQ formation convoyeur — Transports Ligneo" },
      { name: "description", content: "Questions fréquentes des convoyeurs sur la formation interne Ligneo." },
    ],
  }),
  component: FaqPage,
});

const FAQ = [
  {
    q: "Combien de temps dure la formation complète ?",
    a: "Environ 2 heures au total, réparties sur 8 modules. Vous pouvez la suivre en plusieurs fois : votre progression est enregistrée automatiquement.",
  },
  {
    q: "Que se passe-t-il si j'échoue à un quiz ?",
    a: "Rien de grave : les tentatives sont illimitées. Relisez le module puis relancez le quiz. Le score minimum est de 80%.",
  },
  {
    q: "Dois-je terminer la formation pour accepter des missions ?",
    a: "Oui. La validation complète du parcours fait partie des prérequis pour être activé comme convoyeur Ligneo.",
  },
  {
    q: "Comment obtenir mon attestation ?",
    a: "Dès les 8 modules validés, le bouton de téléchargement de l'attestation interne apparaît sur la page d'accueil de la formation.",
  },
  {
    q: "Puis-je revenir sur un module déjà terminé ?",
    a: "Oui, tous les modules restent accessibles à tout moment, notamment pour réviser avant une mission sensible.",
  },
  {
    q: "Qui contacter en cas de doute sur le terrain ?",
    a: "L'exploitation Ligneo au 07 82 45 61 81, ou via le bouton d'assistance présent dans votre espace convoyeur.",
  },
];

function FaqPage() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="rounded-2xl border border-pro-border bg-white p-5">
      <h1 className="text-lg font-semibold text-pro-text flex items-center gap-2">
        <HelpCircle size={18} className="text-[#2F5FFF]" /> Questions fréquentes
      </h1>
      <div className="mt-4 divide-y divide-pro-border">
        {FAQ.map((f, i) => (
          <div key={i} className="py-3">
            <button
              type="button"
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full text-left text-sm font-medium text-pro-text"
            >
              {f.q}
            </button>
            {open === i && <p className="mt-2 text-sm text-pro-text-soft leading-relaxed">{f.a}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
