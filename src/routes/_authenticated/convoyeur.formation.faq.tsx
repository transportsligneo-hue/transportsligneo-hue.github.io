import { createFileRoute } from "@tanstack/react-router";
import { HelpCircle, ChevronDown } from "lucide-react";
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
    q: "Combien de temps faut-il prévoir pour la formation ?",
    a: "Elle compte 8 modules, à suivre à votre rythme. Vous pouvez la faire en plusieurs fois : votre progression est enregistrée automatiquement.",
  },
  {
    q: "Que se passe-t-il si j'échoue à un quiz ?",
    a: "Rien de grave : les tentatives sont illimitées. Relisez le module puis relancez le quiz. Le score minimum est de 100%.",
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
    <div className="fm-card">
      <div className="fm-card-h">
        <h1 className="fm-card-t"><span className="fm-ic"><HelpCircle size={16} /></span> Questions fréquentes</h1>
      </div>
      <div className="fm-faq">
        {FAQ.map((f, i) => (
          <div key={i} className={`fm-fq${open === i ? " open" : ""}`}>
            <button type="button" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
              <span>{f.q}</span>
              <ChevronDown size={17} />
            </button>
            {open === i && <p>{f.a}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
