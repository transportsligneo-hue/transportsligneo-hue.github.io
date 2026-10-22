import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getAvisPublics } from "@/lib/avis.functions";
import { GoogleG } from "@/components/mobile/MobileIcons";

type AvisRow = {
  id: string;
  note: number;
  commentaire: string;
  nom_affiche_public: string | null;
  ville: string | null;
  type_client: string | null;
};

/** Note Google + vrais avis publiés depuis l'admin (jamais de faux avis). */
export default function MobileGoogleReviews() {
  const [avis, setAvis] = useState<AvisRow[]>([]);
  const fetchAvis = useServerFn(getAvisPublics);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await fetchAvis();
        if (mounted && data) setAvis(data as AvisRow[]);
      } catch {
        /* liste masquée si indisponible */
      }
    })();
    return () => {
      mounted = false;
    };
  }, [fetchAvis]);

  return (
    <div className="mh2-sec" aria-labelledby="mh2-avis-title">
      <div className="mh2-h2">Note Google</div>
      <h2 id="mh2-avis-title" className="mh2-t2">
        Ils nous font <em>confiance</em>
      </h2>
      <div className="mh2-gb" aria-label="Note Google 4,8 sur 5">
        <GoogleG size={30} />
        <div>
          <b>
            4,8<small>/5</small>
          </b>
          <div className="mh2-gs">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={13} className="mh-i" />
            ))}
          </div>
        </div>
        <span>Avis Google</span>
      </div>
      {avis.length > 0 && (
        <div className="mh2-rev">
          {avis.map((a) => (
            <article key={a.id} className="mh2-rv">
              <div className="mh2-gs" aria-label={`Note ${a.note} sur 5`}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={13} className="mh-i" style={i < a.note ? undefined : { opacity: 0.25 }} />
                ))}
              </div>
              <p>« {a.commentaire} »</p>
              <small>
                {a.nom_affiche_public}
                {[a.ville, a.type_client].filter(Boolean).length > 0 && ` · ${[a.ville, a.type_client].filter(Boolean).join(" · ")}`}
              </small>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
