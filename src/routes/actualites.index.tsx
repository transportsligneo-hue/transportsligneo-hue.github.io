import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";

type ArticleRow = {
  id: string;
  titre: string;
  slug: string;
  extrait: string | null;
  image_url: string | null;
  published_at: string | null;
};

export const Route = createFileRoute("/actualites/")({
  component: ActualitesPage,
  head: () => ({
    meta: [
      { title: "Actualités convoyage · Transports Ligneo" },
      {
        name: "description",
        content:
          "Conseils, coulisses et actualités du convoyage automobile par Transports Ligneo : livraison de véhicules en France et en Europe.",
      },
      { property: "og:title", content: "Actualités convoyage · Transports Ligneo" },
      {
        property: "og:description",
        content: "Conseils et actualités du convoyage automobile par Transports Ligneo.",
      },
    ],
  }),
});

function ActualitesPage() {
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("articles")
        .select("id, titre, slug, extrait, image_url, published_at")
        .eq("statut", "publie")
        .order("published_at", { ascending: false });
      if (mounted) {
        setArticles((data ?? []) as ArticleRow[]);
        setLoaded(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <>
      <Navbar />
      <main id="main-content" className="r4-page">
        <section className="mx-auto max-w-[1180px] px-5 pb-20 pt-[150px]">
          <div className="v4-hero-eyebrow">
            <span className="dot" />
            Actualités
          </div>
          <h1 className="mb-3 font-heading text-[34px] leading-tight text-white md:text-[42px]">
            Le journal du <span className="v4-accent">convoyage</span>
          </h1>
          <p className="mb-10 max-w-[620px] text-[14.5px] leading-relaxed text-[#9aa6c9]">
            Conseils pratiques, coulisses de nos missions et évolutions du métier de convoyeur.
          </p>

          {loaded && articles.length === 0 && (
            <p className="text-[14px] text-[#9aa6c9]">
              Aucun article publié pour le moment. Revenez bientôt.
            </p>
          )}

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((a) => (
              <Link
                key={a.id}
                to="/actualites/$slug"
                params={{ slug: a.slug }}
                className="group overflow-hidden rounded-2xl border border-[#7aa3ff]/20 bg-white/[0.03] transition-transform duration-300 hover:-translate-y-1"
              >
                {a.image_url && (
                  <img
                    src={a.image_url}
                    alt={a.titre}
                    loading="lazy"
                    className="h-[170px] w-full object-cover"
                  />
                )}
                <div className="p-5">
                  {a.published_at && (
                    <p className="mb-2 flex items-center gap-1.5 text-[11.5px] text-[#9aa6c9]">
                      <CalendarDays size={13} className="text-[#4f8cff]" />
                      {new Date(a.published_at).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  )}
                  <h2 className="mb-2 text-[16px] font-bold leading-snug text-white">{a.titre}</h2>
                  {a.extrait && (
                    <p className="mb-3 text-[13px] leading-relaxed text-[#9aa6c9]">{a.extrait}</p>
                  )}
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-[#4f8cff]">
                    Lire l'article <ArrowRight size={13} />
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
