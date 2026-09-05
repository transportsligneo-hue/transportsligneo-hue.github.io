import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, ArrowLeft, ShieldCheck } from "lucide-react";
import { MissionDocsOfficielsPanel } from "@/components/mission/MissionDocsOfficielsPanel";
import { REGLES_SECURITE_CONVOYEUR } from "@/lib/mission-securite";

export const Route = createFileRoute(
  "/_authenticated/convoyeur/documents-mission/$attributionId",
)({
  component: DocumentsMission,
  head: () => ({
    meta: [
      { title: "Documents de mission à imprimer | Ligneo Convoyeur" },
      {
        name: "description",
        content:
          "Téléchargez les documents papier de votre mission Ligneo : état des lieux, PV et mandat de récupération, prêts à imprimer.",
      },
      { property: "og:title", content: "Documents de mission à imprimer" },
      {
        property: "og:description",
        content: "État des lieux papier, PV et mandat de récupération de votre mission Ligneo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Info = {
  numero: string | null;
  depart: string;
  arrivee: string;
  date: string | null;
  heure: string | null;
  vehicule: string;
  nonRoulant: boolean;
};

function DocumentsMission() {
  const { attributionId } = Route.useParams();
  const { user } = useAuth();
  const [info, setInfo] = useState<Info | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("attributions")
        .select(
          "id, numero_mission, trajet:trajets(numero_mission, depart, arrivee, date_trajet, heure_trajet, marque, modele, immatriculation, non_roulant)",
        )
        .eq("id", attributionId)
        .maybeSingle();
      if (cancelled) return;
      const t = (data as any)?.trajet;
      setInfo(
        t
          ? {
              numero: (data as any)?.numero_mission ?? t.numero_mission ?? null,
              depart: t.depart ?? "",
              arrivee: t.arrivee ?? "",
              date: t.date_trajet ?? null,
              heure: t.heure_trajet ? String(t.heure_trajet).slice(0, 5) : null,
              vehicule: [t.marque, t.modele, t.immatriculation].filter(Boolean).join(" · "),
              nonRoulant: Boolean(t.non_roulant),
            }
          : null,
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [attributionId]);

  return (
    <div className="min-h-screen bg-[#F5F7FC] px-4 py-6 md:px-8">
      <div className="mx-auto max-w-3xl space-y-5">
        <Link
          to="/convoyeur/missions"
          className="inline-flex items-center gap-2 text-sm font-medium text-[#2F5FFF]"
        >
          <ArrowLeft size={16} /> Mes missions
        </Link>

        <header className="rounded-2xl bg-[#061238] p-5 text-white">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#d4a853]">
            Documents à imprimer
          </p>
          <h1 className="mt-1 text-xl font-semibold">
            {loading ? "Chargement…" : `Mission ${info?.numero ?? ""}`}
          </h1>
          {info ? (
            <p className="mt-2 text-sm text-white/80">
              {info.vehicule}
              {info.nonRoulant ? " — véhicule non roulant (plateau)" : ""}
              <br />
              {info.depart} → {info.arrivee}
              {info.date ? ` · ${new Date(`${info.date}T12:00:00Z`).toLocaleDateString("fr-FR")}` : ""}
              {info.heure ? ` à ${info.heure}` : ""}
            </p>
          ) : null}
        </header>

        <section className="rounded-2xl border border-[#e4e9f2] bg-white p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <ShieldCheck size={18} className="text-[#2F5FFF]" /> Règles de sécurité obligatoires
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {REGLES_SECURITE_CONVOYEUR.map((r) => (
              <li key={r} className="flex gap-2">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#B8862A]" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-[#e4e9f2] bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900">Documents de la mission</h2>
          <p className="mt-1 text-sm text-slate-600">
            Téléchargez et imprimez la version papier : elle sert de secours si l’application n’est
            pas utilisable sur place (réseau, batterie, bug).
          </p>
          <div className="mt-4">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 size={16} className="animate-spin" /> Chargement des documents…
              </div>
            ) : (
              <MissionDocsOfficielsPanel
                attributionId={attributionId}
                userId={user?.id ?? null}
                variant="light"
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
