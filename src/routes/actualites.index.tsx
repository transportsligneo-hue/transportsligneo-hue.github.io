import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, CalendarDays, Clock, Code2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import NewsletterForm from "@/components/public/NewsletterForm";
import { ARTICLES, CATEGORIES, type Article, type ArticleCategorie } from "@/content/actualites";

export const Route = createFileRoute("/actualites/")({
  component: ActualitesPage,
  head: () => ({
    meta: [
      { title: "Le journal du convoyage · Transports Ligneo" },
      {
        name: "description",
        content:
          "Conseils clients, coulisses de missions, métier de convoyeur et actualités Ligneo Pro : le blog de Transports Ligneo, convoyage de véhicules en France et en Europe.",
      },
      { property: "og:title", content: "Le journal du convoyage · Transports Ligneo" },
      {
        property: "og:description",
        content:
          "Conseils, coulisses de missions et actualités du convoyage automobile par Transports Ligneo.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://transportsligneo.fr/actualites" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://transportsligneo.fr/actualites" }],
  }),
});

const FILTRE_TOUS = "Tous les articles" as const;
type Filtre = typeof FILTRE_TOUS | ArticleCategorie;

function CategoryPill({ categorie }: { categorie: ArticleCategorie }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[#d9b54a]/35 bg-[#d9b54a]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#e3c56a]">
      {categorie}
    </span>
  );
}

function Meta({ article }: { article: Article }) {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-[#9aa6c9]">
      <span className="inline-flex items-center gap-1.5">
        <CalendarDays size={13} className="text-[#4f8cff]" />
        {article.dateLabel}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Clock size={13} className="text-[#4f8cff]" />
        {article.lecture} min de lecture
      </span>
    </p>
  );
}

function ArticleCard({ article }: { article: Article }) {
  return (
    <Link
      to="/actualites/$slug"
      params={{ slug: article.slug }}
      className="group flex flex-col overflow-hidden rounded-[26px] border border-[#7aa3ff]/20 bg-white/[0.035] transition-all duration-300 hover:-translate-y-1 hover:border-[#4f8cff]/45"
    >
      <div className="relative overflow-hidden">
        <img
          src={article.cover}
          alt={article.coverAlt}
          loading="lazy"
          width={1280}
          height={720}
          className="h-[190px] w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
        <div className="absolute left-4 top-4">
          <CategoryPill categorie={article.categorie} />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <Meta article={article} />
        <h2 className="mb-2 mt-3 font-heading text-[17px] font-bold leading-snug text-white">
          {article.titre}
        </h2>
        <p className="mb-4 flex-1 text-[13px] leading-relaxed text-[#9aa6c9]">{article.extrait}</p>
        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-[#4f8cff]">
          Lire l'article <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}

function ApiCallout() {
  return (
    <section className="my-16 overflow-hidden rounded-[30px] border border-[#4f8cff]/25 bg-gradient-to-br from-[#0a1638] to-[#132a6b] p-7 md:p-10">
      <div className="grid items-center gap-8 lg:grid-cols-2">
        <div>
          <div className="v4-hero-eyebrow">
            <span className="dot" />
            Ligneo Pro
          </div>
          <h2 className="mb-3 mt-3 font-heading text-[24px] leading-tight text-white md:text-[28px]">
            Connectez vos convoyages à <span className="v4-accent">votre système</span>
          </h2>
          <p className="mb-6 max-w-[460px] text-[14px] leading-relaxed text-[#9aa6c9]">
            Loueurs, concessions et gestionnaires de flotte : créez vos missions, suivez chaque
            statut en temps réel et récupérez vos procès-verbaux et factures directement depuis vos
            propres outils.
          </p>
          <Link to="/pro" className="v4-btn-outline">
            Découvrir l'API Ligneo <ArrowRight size={13} className="ml-1.5 inline" />
          </Link>
        </div>
        <div className="overflow-hidden rounded-2xl border border-[#7aa3ff]/25 bg-[#050c22]/80">
          <div className="flex items-center gap-2 border-b border-[#7aa3ff]/15 px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-[#9aa6c9]">
            <Code2 size={13} className="text-[#4f8cff]" />
            Créer une mission
          </div>
          <pre className="overflow-x-auto px-4 py-4 text-[11.5px] leading-relaxed text-[#c8d4f5]">
            <code>{`POST /api/v1/missions
Authorization: Bearer sk_live_...

{
  "depart":  { "ville": "Tours",  "cp": "37000" },
  "arrivee": { "ville": "Nantes", "cp": "44000" },
  "vehicule": { "immat": "AB-123-CD", "energie": "electrique" },
  "date_souhaitee": "2026-09-12"
}

200 OK
{ "mission": "MIS-TLG-2026-#118", "statut": "en_attribution" }`}</code>
          </pre>
        </div>
      </div>
    </section>
  );
}

function ActualitesPage() {
  const [filtre, setFiltre] = useState<Filtre>(FILTRE_TOUS);

  const tries = useMemo(
    () => [...ARTICLES].sort((a, b) => (a.date < b.date ? 1 : -1)),
    [],
  );
  const featured = tries.find((a) => a.featured) ?? tries[0];
  const liste = useMemo(
    () =>
      tries.filter(
        (a) => (filtre === FILTRE_TOUS ? a.slug !== featured.slug : a.categorie === filtre),
      ),
    [tries, filtre, featured.slug],
  );

  const filtres: Filtre[] = [FILTRE_TOUS, ...CATEGORIES];
  const moitie = Math.ceil(liste.length / 2);

  return (
    <>
      <Navbar />
      <main id="main-content" className="r4-page">
        <section className="mx-auto max-w-[1180px] px-5 pb-20 pt-[150px]">
          <div className="v4-hero-eyebrow">
            <span className="dot" />
            Actualités
          </div>
          <h1 className="mb-3 mt-3 font-heading text-[34px] leading-tight text-white md:text-[42px]">
            Le journal du <span className="v4-accent">convoyage</span>
          </h1>
          <p className="mb-8 max-w-[640px] text-[14.5px] leading-relaxed text-[#9aa6c9]">
            Conseils pratiques pour préparer vos livraisons, coulisses de nos missions en France et
            en Europe, et regards sur le métier de convoyeur.
          </p>

          <div className="mb-10 flex flex-wrap gap-2">
            {filtres.map((f) => {
              const actif = f === filtre;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFiltre(f)}
                  className={`rounded-full border px-4 py-2 text-[12.5px] font-bold transition-colors ${
                    actif
                      ? "border-[#4f8cff] bg-[#2f5fff] text-white"
                      : "border-[#7aa3ff]/25 bg-white/[0.04] text-[#9aa6c9] hover:border-[#4f8cff]/50 hover:text-white"
                  }`}
                >
                  {f}
                </button>
              );
            })}
          </div>

          {filtre === FILTRE_TOUS && (
            <Link
              to="/actualites/$slug"
              params={{ slug: featured.slug }}
              className="group mb-12 grid overflow-hidden rounded-[30px] border border-[#7aa3ff]/22 bg-white/[0.035] transition-all duration-300 hover:border-[#4f8cff]/45 lg:grid-cols-2"
            >
              <div className="overflow-hidden">
                <img
                  src={featured.cover}
                  alt={featured.coverAlt}
                  width={1280}
                  height={720}
                  className="h-full min-h-[240px] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              </div>
              <div className="flex flex-col justify-center p-7 md:p-9">
                <div className="mb-3 flex items-center gap-2">
                  <CategoryPill categorie={featured.categorie} />
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#4f8cff]">
                    À la une
                  </span>
                </div>
                <h2 className="mb-3 font-heading text-[22px] leading-tight text-white md:text-[27px]">
                  {featured.titre}
                </h2>
                <p className="mb-4 text-[13.5px] leading-relaxed text-[#9aa6c9]">
                  {featured.extrait}
                </p>
                <Meta article={featured} />
                <span className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-bold text-[#4f8cff]">
                  Lire l'article <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          )}

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {liste.slice(0, moitie).map((a) => (
              <ArticleCard key={a.slug} article={a} />
            ))}
          </div>

          <ApiCallout />

          {liste.length > moitie && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {liste.slice(moitie).map((a) => (
                <ArticleCard key={a.slug} article={a} />
              ))}
            </div>
          )}

          <section className="mt-16 rounded-[30px] border border-[#7aa3ff]/22 bg-white/[0.035] p-7 text-center md:p-10">
            <h2 className="mb-2 font-heading text-[22px] text-white md:text-[26px]">
              Recevez nos prochains articles
            </h2>
            <p className="mx-auto mb-6 max-w-[520px] text-[13.5px] leading-relaxed text-[#9aa6c9]">
              Un email occasionnel, uniquement quand nous publions un contenu utile sur le convoyage
              et la gestion de flotte. Désinscription en un clic.
            </p>
            <div className="mx-auto max-w-[440px] text-left">
              <NewsletterForm />
            </div>
          </section>
        </section>
      </main>
      <Footer />
    </>
  );
}
