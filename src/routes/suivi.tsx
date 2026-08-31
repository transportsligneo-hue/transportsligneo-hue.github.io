import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { Search, MapPin, Clock, PackageCheck, Loader2, ShieldCheck } from "lucide-react";
import Navbar from "@/components/Navbar";
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
          "Suivez l'avancement de votre convoyage automobile avec votre numéro de mission : statut, position approximative et date de prise en charge.",
      },
      { property: "og:title", content: "Suivre ma mission · Transports Ligneo" },
      {
        property: "og:description",
        content: "Statut en temps réel de votre convoyage, sans connexion, avec votre numéro de mission.",
      },
    ],
  }),
});

const STATUT_LABEL: Record<string, { label: string; color: string }> = {
  en_attente: { label: "En attente de prise en charge", color: "#d9b54a" },
  en_cours: { label: "En cours de convoyage", color: "#4f8cff" },
  livree: { label: "Véhicule livré", color: "#22c55e" },
  annulee: { label: "Mission annulée", color: "#ef4444" },
};

function SuiviPage() {
  const [numero, setNumero] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PublicTracking | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = numero.trim();
    const codeValue = code.trim();
    if (value.length < 3 || codeValue.length < 4) {
      setError("Numéro ou code incorrect.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await trackMissionPublic({ data: { numero: value, code: codeValue } });
      setResult(res);
      if (!res.found) {
        setError(
          res.blocked
            ? "Trop de tentatives. Réessayez dans une dizaine de minutes."
            : "Numéro ou code incorrect.",
        );
      }
    } catch {
      setError("Le suivi est momentanément indisponible. Réessayez dans quelques instants.");
    } finally {
      setLoading(false);
    }
  };

  const statut = result?.statut ? STATUT_LABEL[result.statut] : null;

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
            Saisissez votre numéro de mission et votre code confidentiel (tous deux indiqués sur votre
            confirmation) pour connaître le statut de votre convoyage. Aucune information personnelle
            n'est affichée sur cette page.
          </p>

          <form onSubmit={submit} className="mb-8 flex flex-col gap-3 sm:flex-row">
            <label htmlFor="numero-mission" className="sr-only">
              Numéro de mission
            </label>
            <input
              id="numero-mission"
              value={numero}
              maxLength={40}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="Ex. M-2026-0142"
              className="flex-1 rounded-xl border border-[#7aa3ff]/25 bg-white/[0.04] px-4 py-3.5 text-[15px] text-white placeholder:text-[#6f7ba0] focus:border-[#4f8cff] focus:outline-none"
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
              className="w-full rounded-xl border border-[#7aa3ff]/25 bg-white/[0.04] px-4 py-3.5 text-[15px] tracking-[0.18em] text-white placeholder:tracking-normal placeholder:text-[#6f7ba0] focus:border-[#4f8cff] focus:outline-none sm:w-[190px]"
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
                  className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12.5px] font-bold"
                  style={{ background: `${statut.color}1f`, color: statut.color }}
                >
                  <PackageCheck size={14} /> {statut.label}
                </span>
                <span className="text-[12.5px] text-[#9aa6c9]">Mission {result.numero}</span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-2.5 text-[13.5px] text-[#c7d0e8]">
                  <MapPin size={16} className="mt-0.5 shrink-0 text-[#4f8cff]" />
                  <span>
                    {result.ville_depart || "Départ"} → {result.ville_arrivee || "Arrivée"}
                  </span>
                </div>
                <div className="flex items-start gap-2.5 text-[13.5px] text-[#c7d0e8]">
                  <Clock size={16} className="mt-0.5 shrink-0 text-[#d9b54a]" />
                  <span>
                    {result.date_prise_en_charge
                      ? `Prise en charge prévue le ${new Date(result.date_prise_en_charge).toLocaleDateString("fr-FR")}`
                      : "Date de prise en charge à confirmer"}
                  </span>
                </div>
              </div>

              {result.position && (
                <div className="mt-6">
                  <p className="mb-2 text-[12px] uppercase tracking-[0.1em] text-[#9aa6c9]">
                    Position approximative
                  </p>
                  <ClientOnly fallback={<div className="h-[280px] rounded-xl bg-white/[0.04]" />}>
                    <Suspense fallback={<div className="h-[280px] rounded-xl bg-white/[0.04]" />}>
                      <LiveMissionMap
                        className="h-[280px] w-full overflow-hidden rounded-xl"
                        points={[
                          {
                            latitude: result.position.lat,
                            longitude: result.position.lng,
                            recorded_at: result.updated_at ?? new Date().toISOString(),
                            accuracy: null,
                          },
                        ]}
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
