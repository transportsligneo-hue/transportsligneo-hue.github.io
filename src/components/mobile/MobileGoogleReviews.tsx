import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import logoCat from "@/assets/logo-cat.png";
import logoTransak from "@/assets/logo-transakauto.png";

const PARTNERS = [
  { src: logoCat, alt: "CAT France" },
  { src: logoTransak, alt: "TransakAuto" },
];

/** Mini bandeau défilant des partenaires, version fine du desktop. */
function MiniPartners() {
  const loop = [...PARTNERS, ...PARTNERS, ...PARTNERS, ...PARTNERS, ...PARTNERS, ...PARTNERS];
  return (
    <div className="mb-5">
    <div className="mh2-h2" style={{ textAlign: "center" }}>Partenaires &amp; clients de référence</div>
    <h2 className="mh2-t2" style={{ textAlign: "center" }}>
      Ils nous confient leurs <span style={{ color: "#c084fc", fontStyle: "normal", textShadow: "0 0 14px rgba(192,132,252,.7)" }}>véhicules</span>
    </h2>
    <div className="logo-marquee-mask overflow-hidden -mx-5 px-1" aria-label="Ils nous confient leurs véhicules">
      <div className="logo-marquee">
        {[0, 1].map((k) => (
          <div key={k} className="logo-marquee-track" aria-hidden={k === 1 ? true : undefined}>
            {loop.map((p, i) => (
              <div key={i} className="shrink-0 flex items-center justify-center h-11">
                <img src={p.src} alt={k === 0 ? p.alt : ""} loading="lazy" decoding="async" className="h-9 w-auto object-contain" style={{ filter: "drop-shadow(0 0 6px rgba(168,85,247,.75)) drop-shadow(0 0 14px rgba(217,70,239,.45))" }} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
    </div>
  );
}

/** Étoiles partielles : 4,8 → la dernière étoile n'est remplie qu'à 80 %. */
function PartialStars({ rating }: { rating: number }) {
  const row = (dim: boolean) => (
    <span style={{ display: "inline-flex", whiteSpace: "nowrap", opacity: dim ? 0.25 : 1 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={13} className="mh-i" />
      ))}
    </span>
  );
  return (
    <span style={{ position: "relative", display: "inline-flex" }} aria-hidden="true">
      {row(true)}
      <span style={{ position: "absolute", left: 0, top: 0, overflow: "hidden", width: `${(rating / 5) * 100}%` }}>{row(false)}</span>
    </span>
  );
}
import { useServerFn } from "@tanstack/react-start";
import { getAvisPublics } from "@/lib/avis.functions";
import { GoogleG } from "@/components/mobile/MobileIcons";
import { GOOGLE_RATING, GOOGLE_REVIEWS } from "@/lib/google-reviews";

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
      <MiniPartners />
      <div className="mh2-gb" aria-label="Note Google 4,8 sur 5">
        <GoogleG size={30} />
        <div>
          <b>
            {String(GOOGLE_RATING).replace(".", ",")}<small>/5</small>
          </b>
          <div className="mh2-gs">
            <PartialStars rating={GOOGLE_RATING} />
          </div>
        </div>
        <span>Avis Google</span>
      </div>
      <div className="mh2-rev">
        {GOOGLE_REVIEWS.map((g) => (
          <article key={g.id} className="mh2-rv mh2-rv--g">
            <div className="mh2-rv-h">
              <span className="mh2-av" style={{ background: g.color }}>{g.name[0].toUpperCase()}</span>
              <div>
                <b>{g.name}</b>
                <span>{g.role}</span>
              </div>
              <GoogleG size={18} />
            </div>
            <div className="mh2-gs" aria-label={`Note ${g.note} sur 5`}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={13} className="mh-i" style={i < g.note ? undefined : { opacity: 0.25 }} />
              ))}
            </div>
            <p>{g.text}</p>
          </article>
        ))}
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
    </div>
  );
}
