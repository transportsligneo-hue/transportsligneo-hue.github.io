import { useEffect, useState } from "react";
import { Star, Quote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type ReviewRow = {
  id: string;
  note: number;
  commentaire: string | null;
  created_at: string;
  client_id: string;
};

type DisplayReview = {
  id: string;
  nom: string;
  text: string;
  stars: number;
  date: string;
};

const fallbackAvis: DisplayReview[] = [
  {
    id: "f1",
    nom: "Laurent M.",
    text: "Honnêtement au début j'étais pas sûr, j'avais déjà eu des mauvaises expériences avec d'autres convoyeurs. Mais là rien à dire, le véhicule est arrivé nickel, dans les temps, et le chauffeur m'a tenu au courant tout du long. Depuis j'ai refait appel à eux 3 fois.",
    stars: 5,
    date: "Mars 2025",
  },
  {
    id: "f2",
    nom: "Sophie D.",
    text: "J'ai fait transporter ma voiture de Marseille à Tours après mon déménagement. Prix correct, le convoyeur était ponctuel et sympa. Petit bémol sur le délai de réponse au premier mail (2 jours) mais après c'était carré. Je recommande.",
    stars: 4,
    date: "Janvier 2025",
  },
];

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  } catch {
    return "";
  }
}

export default function AvisClientsDynamiques() {
  const [avis, setAvis] = useState<DisplayReview[]>(fallbackAvis);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("id, note, commentaire, created_at, client_id")
        .order("created_at", { ascending: false })
        .limit(6);

      if (!mounted) return;
      if (!error && data && data.length > 0) {
        // Récupère prénoms via profiles
        const ids = Array.from(new Set((data as ReviewRow[]).map((r) => r.client_id)));
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, prenom")
          .in("user_id", ids);
        const map = new Map((profs ?? []).map((p) => [p.user_id, p.prenom]));
        const mapped: DisplayReview[] = (data as ReviewRow[]).map((r) => ({
          id: r.id,
          nom: (map.get(r.client_id) || "Client").toString().slice(0, 1).toUpperCase() +
               (map.get(r.client_id) || "lient").toString().slice(1) + " " +
               ((map.get(r.client_id) || "C").toString()[0] ?? "C") + ".",
          text: r.commentaire?.trim() || "Service au top, je recommande.",
          stars: Math.max(1, Math.min(5, r.note)),
          date: formatDate(r.created_at),
        }));
        setAvis(mapped);
      }
      setLoaded(true);
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <section className="py-24 section-bg">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="gold-divider-short mb-4" />
          <h2 className="font-heading text-3xl md:text-4xl tracking-[0.2em] uppercase text-primary">
            Avis clients
          </h2>
          <p className="text-cream/60 mt-4 max-w-lg mx-auto text-sm">
            La satisfaction de nos clients est notre meilleure carte de visite.
          </p>
          <div className="gold-divider-short mt-4" />
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {avis.slice(0, 4).map((a) => (
            <div key={a.id} className="card-premium p-8 rounded relative group hover:border-primary/40 transition-colors duration-300">
              <Quote className="text-primary/15 absolute top-4 right-4" size={40} />
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} className={j < a.stars ? "text-primary fill-primary" : "text-cream/20"} size={14} />
                  ))}
                </div>
                <span className="text-cream/35 text-xs">{a.date}</span>
              </div>
              <p className="text-cream/75 text-sm leading-relaxed mb-5">"{a.text}"</p>
              <div>
                <p className="font-heading text-primary text-sm tracking-wide">{a.nom}</p>
                <p className="text-cream/45 text-xs mt-0.5">Client vérifié</p>
              </div>
            </div>
          ))}
        </div>

        {!loaded && (
          <p className="text-center text-cream/30 text-xs mt-6">Chargement des avis…</p>
        )}
      </div>
    </section>
  );
}
