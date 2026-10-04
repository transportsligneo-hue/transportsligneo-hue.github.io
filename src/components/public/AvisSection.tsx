import { useEffect, useState } from "react";
import { Star, Quote } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getAvisPublics } from "@/lib/avis.functions";

type AvisRow = {
  id: string;
  note: number;
  commentaire: string;
  nom_affiche_public: string | null;
  ville: string | null;
  type_client: string | null;
  date_avis: string;
};

/**
 * Section témoignages — uniquement de vrais avis publiés depuis l'admin.
 * Si aucun avis n'est publié, la section n'est pas affichée (jamais de faux avis).
 */
export default function AvisSection() {
  const [avis, setAvis] = useState<AvisRow[]>([]);
  const fetchAvis = useServerFn(getAvisPublics);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await fetchAvis();
        if (mounted && data) setAvis(data as AvisRow[]);
      } catch {
        /* section masquée si indisponible */
      }
    })();
    return () => {
      mounted = false;
    };
  }, [fetchAvis]);


  return (
    <section className="v4-section" aria-labelledby="avis-title">
      <div className="v4-section-head">
        <div className="v4-hero-eyebrow" style={{ justifyContent: "center", width: "100%" }}>
          <span className="dot" />
          Note Google
        </div>
        <h2 id="avis-title">Une exigence <span className="hx-neon">vérifiée</span></h2>
        <p>Chaque mission est suivie, documentée et livrée avec le même soin.</p>
        <div className="mx-auto mt-4 inline-flex items-center gap-3 rounded-2xl border border-[#7aa3ff]/20 bg-white/[0.03] px-5 py-3" aria-label="Note Google 4,7 sur 5">
          <svg width="26" height="26" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
          <span className="text-[22px] font-extrabold">4,7<span className="text-[14px] opacity-70">/5</span></span>
          <span className="flex gap-0.5">{Array.from({ length: 5 }).map((_, i) => (<Star key={i} size={15} className={i < 4 ? "fill-[#4f8cff] text-[#4f8cff]" : "fill-[#4f8cff]/60 text-[#4f8cff]"} />))}</span>
          <span className="text-[12.5px] opacity-75">sur Google</span>
        </div>
      </div>

      {avis.length > 0 && <div className="mx-auto grid max-w-[1180px] gap-5 px-5 sm:grid-cols-2 lg:grid-cols-3">
        {avis.map((a) => (
          <article
            key={a.id}
            className="relative rounded-2xl border border-[#7aa3ff]/20 bg-white/[0.03] p-6"
          >
            <Quote size={22} className="mb-3 text-[#d9b54a]/70" />
            <div className="mb-3 flex gap-1" aria-label={`Note ${a.note} sur 5`}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  size={14}
                  className={i < a.note ? "fill-[#d9b54a] text-[#d9b54a]" : "text-[#4a5680]"}
                />
              ))}
            </div>
            <p className="mb-4 text-[13.5px] leading-relaxed text-[#c7d0e8]">{a.commentaire}</p>
            <p className="text-[12.5px] font-bold text-white">{a.nom_affiche_public}</p>
            <p className="text-[12px] text-[#9aa6c9]">
              {[a.ville, a.type_client].filter(Boolean).join(" · ")}
              {a.date_avis && (
                <span className="ml-1 opacity-70">
                  · {new Date(a.date_avis).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
                </span>
              )}
            </p>
          </article>
        ))}
      </div>}
    </section>
  );
}
