import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type ArticleRow = {
  id: string;
  titre: string;
  slug: string;
  extrait: string | null;
  image_url: string | null;
  published_at: string | null;
};

/** Teaser « Dernières actualités » — masqué s'il n'y a aucun article publié. */
export default function DerniersArticles() {
  const [articles, setArticles] = useState<ArticleRow[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("articles")
        .select("id, titre, slug, extrait, image_url, published_at")
        .eq("statut", "publie")
        .order("published_at", { ascending: false })
        .limit(3);
      if (mounted && data) setArticles(data as ArticleRow[]);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (articles.length === 0) return null;

  return (
    <section className="v4-section" aria-labelledby="actus-title">
      <div className="v4-section-head">
        <div className="v4-hero-eyebrow" style={{ justifyContent: "center", width: "100%" }}>
          <span className="dot" />
          Actualités
        </div>
        <h2 id="actus-title">Le journal du convoyage</h2>
      </div>

      <div className="mx-auto grid max-w-[1180px] gap-5 px-5 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((a) => (
          <Link
            key={a.id}
            to="/actualites/$slug"
            params={{ slug: a.slug }}
            className="group overflow-hidden rounded-2xl border border-[#7aa3ff]/20 bg-white/[0.03] transition-transform duration-300 hover:-translate-y-1"
          >
            {a.image_url && (
              <img src={a.image_url} alt={a.titre} loading="lazy" className="h-[160px] w-full object-cover" />
            )}
            <div className="p-5">
              {a.published_at && (
                <p className="mb-2 flex items-center gap-1.5 text-[11.5px] text-[#9aa6c9]">
                  <CalendarDays size={13} className="text-[#4f8cff]" />
                  {new Date(a.published_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              )}
              <h3 className="mb-2 text-[15.5px] font-bold leading-snug text-white">{a.titre}</h3>
              {a.extrait && <p className="text-[13px] leading-relaxed text-[#9aa6c9]">{a.extrait}</p>}
            </div>
          </Link>
        ))}
      </div>

      <div className="v5-teaser-cta">
        <Link to="/actualites" className="v4-btn-outline">
          Toutes les actualités <ArrowRight size={13} className="ml-1.5 inline" />
        </Link>
      </div>
    </section>
  );
}
