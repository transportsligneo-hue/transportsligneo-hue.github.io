import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, CalendarDays, Clock, User } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ARTICLES, getArticle, getRelated } from "@/content/actualites";

export const Route = createFileRoute("/actualites/$slug")({
  loader: ({ params }) => {
    const article = getArticle(params.slug);
    if (!article) throw notFound();
    return { slug: params.slug };
  },
  head: ({ params, loaderData }) => {
    const article = loaderData ? getArticle(loaderData.slug) : undefined;
    if (!article) {
      return {
        meta: [
          { title: "Article indisponible · Transports Ligneo" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const url = `https://transportsligneo.fr/actualites/${params.slug}`;
    return {
      meta: [
        { title: `${article.titre} · Transports Ligneo` },
        { name: "description", content: article.extrait.slice(0, 158) },
        { property: "og:title", content: article.titre },
        { property: "og:description", content: article.extrait.slice(0, 158) },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: article.titre,
            datePublished: article.date,
            author: { "@type": "Organization", name: "Transports Ligneo" },
            publisher: { "@type": "Organization", name: "Transports Ligneo" },
            mainEntityOfPage: url,
          }),
        },
      ],
    };
  },
  component: ArticlePage,
  errorComponent: () => <ArticleFallback title="Article indisponible" />,
  notFoundComponent: () => <ArticleFallback title="Article introuvable" />,
});

function ArticleFallback({ title }: { title: string }) {
  return (
    <>
      <Navbar />
      <main id="main-content" className="r4-page">
        <section className="mx-auto max-w-[760px] px-5 pb-20 pt-[150px]">
          <h1 className="mb-4 font-heading text-[30px] text-white">{title}</h1>
          <Link to="/actualites" className="v4-btn-outline">
            Retour aux actualités
          </Link>
        </section>
      </main>
      <Footer />
    </>
  );
}

function ArticlePage() {
  const { slug } = Route.useLoaderData();
  const article = getArticle(slug) ?? ARTICLES[0];
  const similaires = getRelated(slug, 3);

  return (
    <>
      <Navbar />
      <main id="main-content" className="r4-page">
        <article className="mx-auto max-w-[820px] px-5 pb-16 pt-[140px]">
          <Link
            to="/actualites"
            className="mb-6 inline-flex items-center gap-1.5 text-[12.5px] font-bold text-[#4f8cff]"
          >
            <ArrowLeft size={14} /> Actualités
          </Link>

          <span className="inline-flex items-center rounded-full border border-[#d9b54a]/35 bg-[#d9b54a]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#e3c56a]">
            {article.categorie}
          </span>

          <h1 className="mb-4 mt-4 font-heading text-[29px] leading-tight text-white md:text-[38px]">
            {article.titre}
          </h1>

          <p className="mb-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-[#9aa6c9]">
            <span className="inline-flex items-center gap-1.5">
              <User size={13} className="text-[#4f8cff]" />
              {article.auteur}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays size={13} className="text-[#4f8cff]" />
              {article.dateLabel}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock size={13} className="text-[#4f8cff]" />
              {article.lecture} min de lecture
            </span>
          </p>

          <img
            src={article.cover}
            alt={article.coverAlt}
            width={1280}
            height={720}
            className="mb-9 w-full rounded-[26px] border border-[#7aa3ff]/20 object-cover"
          />

          <p className="mb-8 border-l-2 border-[#d9b54a]/60 pl-5 text-[15.5px] leading-relaxed text-[#c8d4f5]">
            {article.extrait}
          </p>

          <div className="space-y-5">
            {article.contenu.map((bloc, i) => {
              if (bloc.type === "h2") {
                return (
                  <h2
                    key={i}
                    className="pt-4 font-heading text-[20px] leading-snug text-white md:text-[23px]"
                  >
                    {bloc.texte}
                  </h2>
                );
              }
              if (bloc.type === "image") {
                return (
                  <figure key={i} className="py-3">
                    <img
                      src={bloc.src}
                      alt={bloc.alt}
                      loading="lazy"
                      width={1280}
                      height={720}
                      className="w-full rounded-[22px] border border-[#7aa3ff]/18 object-cover"
                    />
                    {bloc.legende && (
                      <figcaption className="mt-2.5 text-[12px] italic text-[#9aa6c9]">
                        {bloc.legende}
                      </figcaption>
                    )}
                  </figure>
                );
              }
              return (
                <p key={i} className="text-[15px] leading-[1.8] text-[#c2cce8]">
                  {bloc.texte}
                </p>
              );
            })}
          </div>
        </article>

        <section className="mx-auto max-w-[1180px] px-5 pb-24">
          <h2 className="mb-6 font-heading text-[21px] text-white">Articles similaires</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {similaires.map((a) => (
              <Link
                key={a.slug}
                to="/actualites/$slug"
                params={{ slug: a.slug }}
                className="group flex flex-col overflow-hidden rounded-[26px] border border-[#7aa3ff]/20 bg-white/[0.035] transition-all duration-300 hover:-translate-y-1 hover:border-[#4f8cff]/45"
              >
                <img
                  src={a.cover}
                  alt={a.coverAlt}
                  loading="lazy"
                  width={1280}
                  height={720}
                  className="h-[160px] w-full object-cover"
                />
                <div className="flex flex-1 flex-col p-5">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#e3c56a]">
                    {a.categorie}
                  </p>
                  <h3 className="mb-2 font-heading text-[15.5px] font-bold leading-snug text-white">
                    {a.titre}
                  </h3>
                  <p className="mb-3 flex-1 text-[12.5px] leading-relaxed text-[#9aa6c9]">
                    {a.extrait.slice(0, 110)}…
                  </p>
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-[#4f8cff]">
                    Lire <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
