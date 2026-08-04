import { createFileRoute } from "@tanstack/react-router";
import { MessageSquareQuote } from "lucide-react";

export const Route = createFileRoute("/_authenticated/convoyeur/formation/temoignages")({
  head: () => ({
    meta: [
      { title: "Témoignages convoyeurs — Transports Ligneo" },
      { name: "description", content: "Retours d'expérience de convoyeurs sur la formation interne Ligneo." },
    ],
  }),
  component: TemoignagesPage,
});

const ITEMS = [
  {
    name: "Karim, convoyeur depuis 2 ans",
    text: "Le module états des lieux m'a évité un litige dès ma 3e mission. Photographier les jantes et le pare-brise avant départ, c'est devenu automatique.",
  },
  {
    name: "Sandrine, convoyeuse Grand Ouest",
    text: "Ce que j'ai retenu : on ne part jamais sans avoir vérifié les documents du véhicule. Deux minutes de contrôle, des heures de problèmes en moins.",
  },
  {
    name: "Mehdi, convoyeur longue distance",
    text: "La partie incidents est très concrète. J'ai su exactement quoi faire lors d'une crevaison sur autoroute : sécuriser, prévenir l'exploitation, documenter.",
  },
  {
    name: "Julien, convoyeur flotte entreprise",
    text: "Les clients pro remarquent la différence : tenue, ponctualité, remise du véhicule propre. La formation cadre bien tout ça.",
  },
];

function TemoignagesPage() {
  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold text-pro-text flex items-center gap-2">
        <MessageSquareQuote size={18} className="text-[#B8862A]" /> Ils en parlent
      </h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {ITEMS.map((t) => (
          <blockquote key={t.name} className="rounded-2xl border border-pro-border bg-white p-5">
            <p className="text-sm text-pro-text-soft leading-relaxed italic">« {t.text} »</p>
            <footer className="mt-3 text-xs font-semibold text-[#0B1338]">{t.name}</footer>
          </blockquote>
        ))}
      </div>
    </div>
  );
}
