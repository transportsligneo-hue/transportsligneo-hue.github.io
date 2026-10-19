import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useState, useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Search, MapPin, Clock, PackageCheck, Loader2, ShieldCheck, CarFront, User } from "lucide-react";
import Navbar from "@/components/Navbar";
import { PlateBadge } from "@/components/plate/PlateBadge";
import Footer from "@/components/Footer";
import { trackMissionPublic, type PublicTracking } from "@/lib/public-content.functions";

const LiveMissionMap = lazy(() =>
  import("@/components/map/LiveMissionMap").then((m) => ({ default: m.LiveMissionMap })),
);

export const Route = createFileRoute("/suivi")({
  component: SuiviPage,
  head: () => ({
    meta: [
      { title: "Suivre ma mission · Transports Ligneo" },
      {
        name: "description",
        content:
           "Suivez votre convoyage automobile en direct : carte GPS, véhicule et prise en charge, avec votre numéro de mission et votre code confidentiel.",
      },
      { property: "og:title", content: "Suivre ma mission · Transports Ligneo" },
      {
        property: "og:description",
        content: "Statut en temps réel de votre convoyage, sans connexion, avec votre numéro de mission.",
      },
      { property: "og:url", content: "https://transportsligneo.fr/suivi" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://transportsligneo.fr/suivi" }],
  }),
});

// Statuts publics : bleu en attente, violet en route, vert livré, rouge annulé.
const STATUT_LABEL: Record<string, { label: string; color: string }> = {
  en_attente: { label: "En attente de prise en charge", color: "#4f8cff" },
  en_cours: { label: "En cours de convoyage", color: "#7c5cff" },
  livree: { label: "Véhicule livré", color: "#22c55e" },
  annulee: { label: "Mission annulée", color: "#ef4444" },
};
const STATUT_FALLBACK = { label: "Mission suivie", color: "#4f8cff" };

function SuiviPage() {
  const [plaque, setPlaque] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PublicTracking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const track = useServerFn(trackMissionPublic);
  const [access, setAccess] = useState<{ plaque: string; code: string } | null>(null);
  const requestVersion = useRef(0);

  useEffect(() => {
    if (!access || !result?.found || result.statut === "livree" || result.statut === "annulee") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      if (document.visibilityState !== "hidden") {
        try {
          const next = await track({ data: access });
          if (cancelled) return;
          if (!next.found) {
            setAccess(null);
            setResult(null);
            setError("Accès au suivi indisponible. Vérifiez votre plaque et votre code.");
            return;
          }
          setResult(next);
          if (next.statut === "livree" || next.statut === "annulee") return;
        } catch {
          // Conserver la dernière vraie position ; la carte indique l'âge du signal.
        }
      }
      if (!cancelled) timer = setTimeout(refresh, 4000);
    };
    timer = setTimeout(refresh, 4000);
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [access, result?.found, result?.statut, track]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const plaqueValue = plaque.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    const codeValue = code.trim();
    if (plaqueValue.length < 4 || codeValue.length < 4) {
      setError("Plaque ou code incorrect.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setAccess(null);
    const version = ++requestVersion.current;
    try {
      const res = await track({ data: { plaque: plaqueValue, code: codeValue } });
      if (version !== requestVersion.current) return;
      setResult(res);
      if (res.found) setAccess({ plaque: plaqueValue, code: codeValue });
      // On efface les champs après la recherche.
      setPlaque("");
      setCode("");
      if (!res.found) {
        setError(
          res.blocked
            ? "Trop de tentatives. Réessayez dans une dizaine de minutes."
            : "Plaque ou code incorrect.",
        );
      }
    } catch {
      setError("Le suivi est momentanément indisponible. Réessayez dans quelques instants.");
    } finally {
      setLoading(false);
    }
  };

  const statut = result?.statut ? (STATUT_LABEL[result.statut] ?? STATUT_FALLBACK) : null;

  return (
    <>
      <Navbar />
      <main id="main-content" className="r4-page">
        <section className="mx-auto max-w-[860px] px-5 pb-20 pt-[150px]">
          <div className="v4-hero-eyebrow">
            <span className="dot" />
            Suivi de mission
          </div>
          <h1 className="mb-3 font-heading text-[34px] leading-tight text-white md:text-[42px]">
            Où en est <span className="v4-accent">mon véhicule</span> ?
          </h1>
          <p className="mb-8 max-w-[560px] text-[14.5px] leading-relaxed text-[#9aa6c9]">
            Tapez la plaque d'immatriculation du véhicule (ex. AB-123-CD) et votre code
            confidentiel, indiqué dans l'e-mail de suivi. Aucune information personnelle
            n'est affichée sur cette page.
          </p>

          <form onSubmit={submit} className="mb-8 flex flex-col gap-3 sm:flex-row">
            <label htmlFor="plaque-vehicule" className="sr-only">
              Plaque d'immatriculation
            </label>
            <input
              id="plaque-vehicule"
              value={plaque}
              maxLength={12}
              autoComplete="off"
              autoCapitalize="characters"
              onChange={(e) => setPlaque(e.target.value.toUpperCase())}
              placeholder="Plaque ex. AB-123-CD"
              className="suivi-field suivi-input w-full flex-1 px-4 py-3.5 text-[15px] tracking-[0.12em] focus:outline-none"
            />
            <label htmlFor="code-confidentiel" className="sr-only">
              Code confidentiel
            </label>
            <input
              id="code-confidentiel"
              value={code}
              maxLength={16}
              autoComplete="off"
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Code ex. A7K9P2"
              className="suivi-field suivi-input w-full px-4 py-3.5 text-[15px] tracking-[0.18em] focus:outline-none sm:w-[190px]"
            />
            <button type="submit" className="v4-btn-primary justify-center" disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              <span className="ml-2">Suivre</span>
            </button>
          </form>


          {error && (
            <div className="mb-6 rounded-xl border border-[#ef4444]/30 bg-[#ef4444]/10 px-4 py-3 text-[13.5px] text-[#ffb4b4]">
              {error}
            </div>
          )}

          {result?.found && statut && (
            <div className="rounded-2xl border border-[#7aa3ff]/20 bg-white/[0.03] p-6">
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <span
                  className="suivi-badge inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12.5px] font-bold"
                  style={{
                    background: `${statut.color}1f`,
                    color: statut.color,
                    border: `1px solid ${statut.color}44`,
                    boxShadow: `0 0 18px -6px ${statut.color}`,
                  }}
                >
                  <PackageCheck size={14} /> {statut.label}
                </span>
                <span className="text-[12.5px] text-[#9aa6c9]">Mission {result.numero}</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-start gap-2.5 text-[13.5px]">
                  <MapPin size={16} className="suivi-ico mt-0.5 shrink-0" />
                  <span className="suivi-txt-depart">
                    {result.ville_depart || "Départ"}
                  </span>
                  <span className="shrink-0 text-[#8fa0c4]">→</span>
                  <span className="suivi-txt-arrivee">{result.ville_arrivee || "Arrivée"}</span>
                </div>
                <div className="flex items-start gap-2.5 text-[13.5px]">
                  <Clock size={16} className="suivi-ico suivi-ico-horloge mt-0.5 shrink-0" />
                  <span className="suivi-txt-horloge">
                    {result.date_prise_en_charge
                      ? `Prise en charge prévue le ${new Date(result.date_prise_en_charge).toLocaleDateString("fr-FR")}`
                      : "Date de prise en charge à confirmer"}
                  </span>
                </div>
                {(result.vehicule || result.immatriculation) && (
                  <div className="flex items-start gap-2.5 text-[13.5px]">
                    <CarFront size={16} className="suivi-ico mt-0.5 shrink-0" />
                    <span className="suivi-txt-depart">
                      {result.vehicule || "Véhicule"}
                      {result.immatriculation && (
                        <span className="ml-2 inline-flex align-middle">
                          <PlateBadge plate={result.immatriculation} size="sm" />
                        </span>
                      )}
                    </span>
                  </div>
                )}
                {result.destinataire && (
                  <div className="flex items-start gap-2.5 text-[13.5px]">
                    <User size={16} className="suivi-ico suivi-ico-horloge mt-0.5 shrink-0" />
                    <span className="suivi-txt-horloge">Destinataire : {result.destinataire}</span>
                  </div>
                )}
              </div>

              {result.position && (
                <div className="mt-6">
                  <p className="mb-2 text-[12px] uppercase tracking-[0.1em] text-[#9aa6c9]">
                    Suivi GPS
                  </p>
                  <ClientOnly fallback={<div className="h-[280px] rounded-xl bg-white/[0.04]" />}>
                    <Suspense fallback={<div className="h-[280px] rounded-xl bg-white/[0.04]" />}>
                      <LiveMissionMap
                        className="h-[280px] w-full overflow-hidden rounded-xl"
                        points={result.points ?? []}
                        origin={result.ville_depart}
                        destination={result.ville_arrivee}
                        role="client"
                        completed={result.statut === "livree"}
                        completedPlaque={result.immatriculation}
                      />
                    </Suspense>
                  </ClientOnly>
                  {result.updated_at && (
                    <p className="mt-2 text-[12px] text-[#7f8bb0]">
                      Dernière mise à jour :{" "}
                      {new Date(result.updated_at).toLocaleString("fr-FR")}
                    </p>
                  )}
                </div>
              )}

              <p className="mt-6 flex items-start gap-2 text-[12px] leading-relaxed text-[#7f8bb0]">
                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[#4f8cff]" />
                Par respect de la confidentialité, les coordonnées du client, du convoyeur et le montant
                de la mission ne sont pas affichés ici. Connectez-vous à votre espace pour le détail complet.
              </p>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
