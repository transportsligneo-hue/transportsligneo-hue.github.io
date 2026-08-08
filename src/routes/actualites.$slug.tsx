import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getArticleBySlug } from "@/lib/public-articles.functions";

export const Route = createFileRoute("/actualites/$slug")({
  loader: async ({ params }) => {
    const article = await getArticleBySlug({ data: { slug: params.slug } });
    if (!article) throw notFound();
    return { article };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Article indisponible · Transports Ligneo" }, { name: "robots", content: "noindex" }],
      };
    }
    const { titre, extrait, image_url } = loaderData.article;
    const desc = extrait ?? "Actualité convoyage automobile — Transports Ligneo.";
    return {
      meta: [
        { title: `${titre} · Transports Ligneo` },
        { name: "description", content: desc.slice(0, 158) },
        { property: "og:title", content: titre },
        { property: "og:description", content: desc.slice(0, 158) },
        { property: "og:type", content: "article" },
        ...(image_url && image_url.startsWith("https://")
          ? [
              { property: "og:image", content: image_url },
              { name: "twitter:image", content: image_url },
            ]
          : []),
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
  const { article } = Route.useLoaderData();

  return (
    <>
      <Navbar />
      <main id="main-content" className="r4-page">
        <article className="mx-auto max-w-[760px] px-5 pb-20 pt-[150px]">
          <Link
            to="/actualites"
            className="mb-6 inline-flex items-center gap-1.5 text-[12.5px] font-bold text-[#4f8cff]"
          >
            <ArrowLeft size={14} /> Actualités
          </Link>
          <h1 className="mb-3 font-heading text-[32px] leading-tight text-white md:text-[40px]">
            {article.titre}
          </h1>
          {article.published_at && (
            <p className="mb-8 flex items-center gap-1.5 text-[12.5px] text-[#9aa6c9]">
              <CalendarDays size={13} className="text-[#4f8cff]" />
              {new Date(article.published_at).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          )}
          {article.image_url && (
            <img
              src={article.image_url}
              alt={article.titre}
              className="mb-8 w-full rounded-2xl object-cover"
            />
          )}
          <div className="space-y-4 text-[15px] leading-relaxed text-[#c7d0e8]">
            {article.contenu.split(/\n{2,}/).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
