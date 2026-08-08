import { useEffect, useState } from "react";
import { Star, Quote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type AvisRow = {
  id: string;
  note: number;
  commentaire: string;
  nom_affiche: string;
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

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("avis_clients")
        .select("id, note, commentaire, nom_affiche, ville, type_client, date_avis")
        .eq("statut", "publie")
        .order("date_avis", { ascending: false })
        .limit(6);
      if (mounted && data) setAvis(data as AvisRow[]);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (avis.length === 0) return null;

  return (
    <section className="v4-section" aria-labelledby="avis-title">
      <div className="v4-section-head">
        <div className="v4-hero-eyebrow" style={{ justifyContent: "center", width: "100%" }}>
          <span className="dot" />
          Avis clients
        </div>
        <h2 id="avis-title">Ce que disent nos clients</h2>
        <p>Des avis réels, laissés après livraison du véhicule.</p>
      </div>

      <div className="mx-auto grid max-w-[1180px] gap-5 px-5 sm:grid-cols-2 lg:grid-cols-3">
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
            <p className="text-[12.5px] font-bold text-white">{a.nom_affiche}</p>
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
      </div>
    </section>
  );
}
