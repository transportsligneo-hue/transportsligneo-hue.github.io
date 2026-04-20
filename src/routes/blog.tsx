import { createFileRoute, Link } from "@tanstack/react-router";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { articles } from "@/lib/blog-articles";
import { Calendar, Clock, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/blog")({
  component: BlogIndex,
  head: () => ({
    meta: [
      { title: "Blog convoyage automobile — Transports Ligneo" },
      { name: "description", content: "Conseils, guides et tarifs pour comprendre le convoyage automobile professionnel. Tours, Paris, France entière." },
      { property: "og:title", content: "Blog convoyage automobile — Transports Ligneo" },
      { property: "og:description", content: "Tout comprendre sur le convoyage : prix, étapes, garanties." },
    ],
  }),
});

function BlogIndex() {
  return (
    <>
      <Navbar />
      <main className="pt-24 pb-20">
        <section className="py-16 section-bg">
          <div className="max-w-5xl mx-auto px-6 text-center">
            <div className="gold-divider-short mb-4 mx-auto" />
            <p className="font-heading text-cream/55 text-xs tracking-[0.3em] uppercase">
              Blog & Ressources
            </p>
            <h1 className="font-heading text-3xl md:text-5xl tracking-[0.1em] uppercase text-primary mt-4">
              Convoyage automobile,<br />tout comprendre
            </h1>
            <p className="text-cream/70 text-base mt-6 max-w-2xl mx-auto">
              Guides, tarifs, conseils pratiques. L'essentiel pour faire les bons choix.
            </p>
            <div className="gold-divider-short mt-6 mx-auto" />
          </div>
        </section>

        <section className="py-12 section-bg-alt">
          <div className="max-w-5xl mx-auto px-6 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((a) => (
              <Link
                key={a.slug}
                to="/blog/$slug"
                params={{ slug: a.slug }}
                className="card-premium p-6 rounded hover:border-primary/40 transition-colors group flex flex-col"
              >
                <p className="font-heading text-primary/70 text-[10px] tracking-[0.2em] uppercase mb-3">
                  {a.category}
                </p>
                <h2 className="font-heading text-primary text-lg leading-snug tracking-wide mb-3 group-hover:text-gold-light transition-colors">
                  {a.title}
                </h2>
                <p className="text-cream/65 text-sm leading-relaxed mb-5 flex-1">
                  {a.excerpt}
                </p>
                <div className="flex items-center justify-between text-cream/40 text-[11px] mt-auto">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar size={12} /> {a.date}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock size={12} /> {a.readTime}
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 text-primary text-xs tracking-[0.15em] uppercase mt-4 group-hover:gap-2 transition-all">
                  Lire <ArrowRight size={12} />
                </span>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
