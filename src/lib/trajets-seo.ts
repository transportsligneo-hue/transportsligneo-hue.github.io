import { kmBasePrice } from "@/lib/km-tarif";

/** Villes desservies depuis / vers Tours : distance routière approximative (km). */
export const TRAJETS_VILLES: Array<{ nom: string; slug: string; km: number; dept: string }> = [
  { nom: "Paris", slug: "paris", km: 235, dept: "75" },
  { nom: "Orléans", slug: "orleans", km: 115, dept: "45" },
  { nom: "Le Mans", slug: "le-mans", km: 85, dept: "72" },
  { nom: "Angers", slug: "angers", km: 110, dept: "49" },
  { nom: "Poitiers", slug: "poitiers", km: 105, dept: "86" },
  { nom: "Nantes", slug: "nantes", km: 215, dept: "44" },
  { nom: "Rennes", slug: "rennes", km: 240, dept: "35" },
  { nom: "Limoges", slug: "limoges", km: 215, dept: "87" },
  { nom: "Bordeaux", slug: "bordeaux", km: 345, dept: "33" },
  { nom: "Lyon", slug: "lyon", km: 460, dept: "69" },
  { nom: "Lille", slug: "lille", km: 520, dept: "59" },
  { nom: "Toulouse", slug: "toulouse", km: 580, dept: "31" },
  { nom: "Strasbourg", slug: "strasbourg", km: 650, dept: "67" },
  { nom: "Marseille", slug: "marseille", km: 800, dept: "13" },
  { nom: "Nice", slug: "nice", km: 930, dept: "06" },
];

export interface TrajetSeo {
  slug: string;
  depart: string;
  arrivee: string;
  km: number;
  dureeLabel: string;
  prixDepuis: number;
  autres: Array<{ slug: string; label: string }>;
}

function duree(km: number): string {
  const min = Math.round((km / 88) * 60 / 5) * 5;
  const h = Math.floor(min / 60), m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

export const TRAJET_SLUGS: string[] = TRAJETS_VILLES.flatMap((v) => [`tours-${v.slug}`, `${v.slug}-tours`]);

export function getTrajet(slug: string): TrajetSeo | null {
  const m = slug.match(/^(.+)-(.+)$/);
  const ville = TRAJETS_VILLES.find((v) => slug === `tours-${v.slug}` || slug === `${v.slug}-tours`);
  if (!ville || !m) return null;
  const aller = slug === `tours-${ville.slug}`;
  const autres = TRAJETS_VILLES.filter((v) => v.slug !== ville.slug)
    .slice(0, 6)
    .map((v) => ({ slug: aller ? `tours-${v.slug}` : `${v.slug}-tours`, label: aller ? `Tours → ${v.nom}` : `${v.nom} → Tours` }));
  return {
    slug,
    depart: aller ? "Tours" : ville.nom,
    arrivee: aller ? ville.nom : "Tours",
    km: ville.km,
    dureeLabel: duree(ville.km),
    // Même grille kilométrique que l'estimateur (TTC, véhicule standard)
    prixDepuis: kmBasePrice(ville.km),
    autres,
  };
}
