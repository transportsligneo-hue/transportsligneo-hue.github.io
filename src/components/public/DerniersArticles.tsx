import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays } from "lucide-react";
import { ARTICLES } from "@/content/actualites";

/** Teaser « Dernières actualités » — les 3 articles les plus récents du journal. */
export default function DerniersArticles() {
  const articles = [...ARTICLES].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 3);

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
            key={a.slug}
            to="/actualites/$slug"
            params={{ slug: a.slug }}
            className="group overflow-hidden rounded-2xl border border-[#7aa3ff]/20 bg-white/[0.03] transition-transform duration-300 hover:-translate-y-1"
          >
            <img
              src={a.cover}
              alt={a.coverAlt}
              loading="lazy"
              width={1280}
              height={720}
              className="h-[160px] w-full object-cover"
            />
            <div className="p-5">
              <p className="mb-2 flex items-center gap-1.5 text-[11.5px] text-[#9aa6c9]">
                <CalendarDays size={13} className="text-[#4f8cff]" />
                {a.dateLabel}
              </p>
              <h3 className="mb-2 text-[15.5px] font-bold leading-snug text-white">{a.titre}</h3>
              <p className="text-[13px] leading-relaxed text-[#9aa6c9]">{a.extrait}</p>
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
