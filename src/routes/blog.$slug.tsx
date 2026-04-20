import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ArrowLeft, Calendar, Clock } from "lucide-react";
import { getArticle, articles } from "@/lib/blog-articles";

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => {
    const article = getArticle(params.slug);
    if (!article) throw notFound();
    return { article };
  },
  component: BlogArticlePage,
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center section-bg px-4">
      <div className="text-center">
        <h1 className="font-heading text-primary text-2xl tracking-[0.2em] uppercase">Article introuvable</h1>
        <Link to="/blog" className="inline-block mt-6 text-primary hover:text-gold-light text-sm">← Retour au blog</Link>
      </div>
    </div>
  ),
  head: ({ loaderData }) => {
    const a = loaderData?.article;
    if (!a) return { meta: [{ title: "Article introuvable" }] };
    return {
      meta: [
        { title: `${a.title} — Blog Transports Ligneo` },
        { name: "description", content: a.metaDescription },
        { property: "og:title", content: a.title },
        { property: "og:description", content: a.metaDescription },
        { property: "og:type", content: "article" },
      ],
    };
  },
});

function BlogArticlePage() {
  const { article } = Route.useLoaderData();
  const others = articles.filter((a) => a.slug !== article.slug).slice(0, 2);

  return (
    <>
      <Navbar />
      <main className="pt-24 pb-20">
        <article className="py-16 section-bg">
          <div className="max-w-3xl mx-auto px-6">
            <Link to="/blog" className="inline-flex items-center gap-2 text-cream/55 hover:text-primary text-xs tracking-[0.15em] uppercase mb-8 transition-colors">
              <ArrowLeft size={14} /> Retour au blog
            </Link>
            <p className="font-heading text-primary/70 text-[10px] tracking-[0.3em] uppercase mb-3">
              {article.category}
            </p>
            <h1 className="font-heading text-3xl md:text-4xl text-primary tracking-[0.05em] leading-tight">
              {article.title}
            </h1>
            <div className="flex items-center gap-5 text-cream/45 text-xs mt-5">
              <span className="inline-flex items-center gap-1.5"><Calendar size={12} /> {article.date}</span>
              <span className="inline-flex items-center gap-1.5"><Clock size={12} /> {article.readTime}</span>
            </div>
            <div className="gold-divider-short mt-8" />

            <div className="mt-10 space-y-6">
              {article.content.map((block, i) => {
                if (block.type === "h2") {
                  return (
                    <h2 key={i} className="font-heading text-primary text-xl md:text-2xl tracking-wide mt-10">
                      {block.text}
                    </h2>
                  );
                }
                if (block.type === "ul") {
                  return (
                    <ul key={i} className="space-y-2 pl-5 list-disc marker:text-primary/60">
                      {block.items?.map((it, j) => (
                        <li key={j} className="text-cream/75 text-base leading-relaxed">{it}</li>
                      ))}
                    </ul>
                  );
                }
                if (block.type === "quote") {
                  return (
                    <blockquote key={i} className="border-l-2 border-primary/60 pl-5 py-2 my-8 italic text-cream/75 text-lg">
                      "{block.text}"
                    </blockquote>
                  );
                }
                return (
                  <p key={i} className="text-cream/75 text-base leading-relaxed">{block.text}</p>
                );
              })}
            </div>

            <div className="mt-14 p-6 card-premium rounded text-center">
              <p className="font-heading text-primary tracking-[0.1em] uppercase text-sm mb-2">
                Besoin d'un convoyage ?
              </p>
              <p className="text-cream/65 text-sm mb-5">
                Estimation gratuite en moins d'une minute.
              </p>
              <Link
                to="/tarifs"
                className="inline-block px-8 py-3 bg-primary text-primary-foreground font-heading text-xs tracking-[0.15em] uppercase hover:bg-gold-light transition-colors"
              >
                Estimer mon trajet
              </Link>
            </div>
          </div>
        </article>

        {others.length > 0 && (
          <section className="py-16 section-bg-alt">
            <div className="max-w-4xl mx-auto px-6">
              <p className="font-heading text-primary tracking-[0.2em] uppercase text-sm text-center mb-8">
                À lire aussi
              </p>
              <div className="grid sm:grid-cols-2 gap-5">
                {others.map((o) => (
                  <Link
                    key={o.slug}
                    to="/blog/$slug"
                    params={{ slug: o.slug }}
                    className="card-premium p-5 rounded hover:border-primary/40 transition-colors block"
                  >
                    <p className="font-heading text-primary/60 text-[10px] tracking-[0.2em] uppercase mb-2">{o.category}</p>
                    <h3 className="font-heading text-primary text-base leading-snug tracking-wide">{o.title}</h3>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
