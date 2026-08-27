// Tarifs locaux par département — version basée sur les codes postaux.
// Règle :
//   - Départ ET arrivée dans la zone agglo de la ville principale  → 79 € / 129 € A/R (37 : 70 € / 120 €)
//   - Même département mais lun des deux hors zone agglo            → 99 € / 129 € A/R (37 : 90 € / 130 €)
//   - Départements différents                                        → null (fallback km appelant)
// Les tarifs FIXED_TARIFFS existants gardent leur priorité dans calculatePrice.

/** Liste explicite des codes postaux composant la zone agglo de chaque ville principale. */
export const DEPT_AGGLO: Record<string, { city: string; cps: string[] }> = {
  // 37 — Tours
  "37": {
    city: "Tours",
    cps: [
      "37000", "37100", "37200", "37300", // Tours + Joué-lès-Tours
      "37170", // Chambray-lès-Tours
      "37520", // La Riche
      "37540", // Saint-Cyr-sur-Loire
      "37700", // Saint-Pierre-des-Corps
      "37550", // Saint-Avertin
      "37230", // Fondettes
      "37510", // Ballan-Miré
      "37210", // Rochecorbon / Parçay-Meslay / Notre-Dame-d'Oé / Vouvray
      "37250", // Veigné / Montbazon
      "37270", // Montlouis-sur-Loire
      "37390", // La Membrolle / Mettray / Charentilly
    ],
  },
  // 75 — Paris (intra-muros uniquement)
  "75": {
    city: "Paris",
    cps: Array.from({ length: 20 }, (_, i) => `750${String(i + 1).padStart(2, "0")}`),
  },
  // 69 — Lyon
  "69": {
    city: "Lyon",
    cps: [
      "69001","69002","69003","69004","69005","69006","69007","69008","69009",
      "69100", // Villeurbanne
      "69200", // Vénissieux
      "69300", // Caluire-et-Cuire
      "69500", // Bron
      "69120", // Vaulx-en-Velin
      "69150", // Décines-Charpieu
      "69600", // Oullins
      "69230", // Saint-Genis-Laval
      "69160", // Tassin-la-Demi-Lune
      "69130", // Écully
    ],
  },
  // 13 — Marseille
  "13": {
    city: "Marseille",
    cps: [
      ...Array.from({ length: 16 }, (_, i) => `130${String(i + 1).padStart(2, "0")}`),
      "13008","13009","13010","13011","13012","13013","13014","13015","13016",
      "13700", // Marignane
      "13110", // Port-de-Bouc (proche)
      "13127", // Vitrolles
    ],
  },
  // 31 — Toulouse
  "31": {
    city: "Toulouse",
    cps: [
      "31000","31100","31200","31300","31400","31500",
      "31700", // Blagnac
      "31170", // Tournefeuille
      "31270", // Cugnaux / Villeneuve-Tolosane
      "31240", // L'Union / Saint-Jean
      "31520", // Ramonville-Saint-Agne
      "31130", // Balma / Quint-Fonsegrives
      "31320", // Castanet-Tolosan
      "31150", // Bruguières / Gratentour
    ],
  },
  // 33 — Bordeaux
  "33": {
    city: "Bordeaux",
    cps: [
      "33000","33100","33200","33300","33800",
      "33700", // Mérignac
      "33600", // Pessac
      "33400", // Talence
      "33170", // Gradignan
      "33150", // Cenon
      "33270", // Floirac
      "33310", // Lormont
      "33130", // Bègles
      "33520", // Bruges
      "33110", // Le Bouscat
      "33320", // Eysines
    ],
  },
  // 44 — Nantes
  "44": {
    city: "Nantes",
    cps: [
      "44000","44100","44200","44300",
      "44400", // Rezé
      "44800", // Saint-Herblain
      "44230", // Saint-Sébastien-sur-Loire
      "44120", // Vertou
      "44340", // Bouguenais
      "44240", // La Chapelle-sur-Erdre
      "44700", // Orvault
      "44470", // Carquefou
      "44980", // Sainte-Luce-sur-Loire
    ],
  },
  // 59 — Lille
  "59": {
    city: "Lille",
    cps: [
      "59000","59800","59777",
      "59100", // Roubaix
      "59200", // Tourcoing
      "59650", // Villeneuve-d'Ascq
      "59160", // Lomme / Capinghem
      "59260", // Lezennes / Hellemmes
      "59700", // Marcq-en-Barœul
      "59130", // Lambersart
      "59170", // Croix
      "59320", // Haubourdin
      "59370", // Mons-en-Barœul
    ],
  },
  // 67 — Strasbourg
  "67": {
    city: "Strasbourg",
    cps: [
      "67000","67100","67200",
      "67300", // Schiltigheim
      "67400", // Illkirch-Graffenstaden
      "67114", // Eschau
      "67800", // Hoenheim / Bischheim
      "67380", // Lingolsheim
      "67540", // Ostwald
      "67460", // Souffelweyersheim
    ],
  },
  // 34 — Montpellier
  "34": {
    city: "Montpellier",
    cps: [
      "34000","34070","34080","34090",
      "34170", // Castelnau-le-Lez
      "34430", // Saint-Jean-de-Védas
      "34970", // Lattes
      "34130", // Mauguio
      "34880", // Lavérune
      "34470", // Pérols
      "34920", // Le Crès
      "34160", // Castries
    ],
  },
  // 06 — Nice
  "06": {
    city: "Nice",
    cps: [
      "06000","06100","06200","06300",
      "06700", // Saint-Laurent-du-Var
      "06800", // Cagnes-sur-Mer
      "06150", // Cannes-la-Bocca (cas particulier — proche)
      "06400", // Cannes
      "06160", // Antibes / Juan-les-Pins
      "06600", // Antibes
      "06340", // La Trinité / Drap
      "06360", // Èze
      "06320", // Cap-d'Ail
    ],
  },
  // 35 — Rennes
  "35": {
    city: "Rennes",
    cps: [
      "35000","35200","35700",
      "35135", // Chantepie
      "35170", // Bruz
      "35131", // Chartres-de-Bretagne
      "35510", // Cesson-Sévigné
      "35740", // Pacé
      "35650", // Le Rheu
      "35760", // Saint-Grégoire / Montgermont
      "35830", // Betton
      "35136", // Saint-Jacques-de-la-Lande
    ],
  },
  // 76 — Rouen
  "76": {
    city: "Rouen",
    cps: [
      "76000","76100",
      "76300", // Sotteville-lès-Rouen
      "76800", // Saint-Étienne-du-Rouvray
      "76130", // Mont-Saint-Aignan
      "76140", // Le Petit-Quevilly
      "76240", // Le Mesnil-Esnard / Bonsecours
      "76250", // Déville-lès-Rouen
      "76230", // Bois-Guillaume / Isneauville
      "76160", // Darnétal
    ],
  },
  // 38 — Grenoble
  "38": {
    city: "Grenoble",
    cps: [
      "38000","38100",
      "38400", // Saint-Martin-d'Hères
      "38130", // Échirolles
      "38320", // Eybens / Poisat
      "38600", // Fontaine
      "38240", // Meylan
      "38700", // La Tronche / Corenc
      "38610", // Gières
      "38170", // Seyssinet-Pariset
    ],
  },
  // 21 — Dijon
  "21": {
    city: "Dijon",
    cps: [
      "21000",
      "21300", // Chenôve
      "21800", // Quetigny / Chevigny-Saint-Sauveur
      "21240", // Talant
      "21600", // Longvic
      "21121", // Fontaine-lès-Dijon / Daix
      "21850", // Saint-Apollinaire
    ],
  },
  // 49 — Angers
  "49": {
    city: "Angers",
    cps: [
      "49000","49100",
      "49130", // Les Ponts-de-Cé / Sainte-Gemmes
      "49480", // Saint-Sylvain-d'Anjou / Verrières-en-Anjou
      "49240", // Avrillé
      "49800", // Trélazé
      "49070", // Beaucouzé / Saint-Jean-de-Linières
      "49180", // Saint-Barthélemy-d'Anjou
    ],
  },
  // 51 — Reims
  "51": {
    city: "Reims",
    cps: [
      "51100",
      "51370", // Saint-Brice-Courcelles
      "51500", // Taissy / Cormontreuil
      "51430", // Tinqueux / Bezannes
      "51450", // Bétheny
    ],
  },
  // 63 — Clermont-Ferrand
  "63": {
    city: "Clermont-Ferrand",
    cps: [
      "63000","63100",
      "63800", // Cournon-d'Auvergne
      "63400", // Chamalières
      "63170", // Aubière / Pérignat-lès-Sarliève
      "63110", // Beaumont
      "63960", // Veyre-Monton (limite)
      "63430", // Pont-du-Château
      "63540", // Romagnat
    ],
  },
  // 64 — Pau
  "64": {
    city: "Pau",
    cps: [
      "64000",
      "64140", // Lons / Billère
      "64160", // Morlaàs
      "64320", // Bizanos / Idron
      "64110", // Jurançon / Gan
      "64230", // Lescar
    ],
  },
  // 83 — Toulon
  "83": {
    city: "Toulon",
    cps: [
      "83000","83100","83200",
      "83130", // La Garde
      "83160", // La Valette-du-Var
      "83140", // Six-Fours-les-Plages
      "83500", // La Seyne-sur-Mer
      "83190", // Ollioules
      "83400", // Hyères
      "83320", // Carqueiranne
    ],
  },
};

// ============================================================
// Reconnaissance par nom de commune (saisie sans code postal)
// ============================================================

/** Communes appartenant à la zone agglo de la ville principale. */
const DEPT_AGGLO_COMMUNES: Record<string, string[]> = {
  "37": [
    "Tours", "La Riche", "Joué-lès-Tours", "Joué les Tours", "Chambray-lès-Tours", "Chambray les Tours",
    "Saint-Cyr-sur-Loire", "St-Cyr-sur-Loire", "Saint-Pierre-des-Corps", "St-Pierre-des-Corps",
    "Saint-Avertin", "St-Avertin", "Fondettes", "Ballan-Miré", "Rochecorbon", "Parçay-Meslay",
    "Notre-Dame-d'Oé", "Notre Dame d'Oé", "Vouvray", "Veigné", "Montbazon", "Montlouis-sur-Loire",
    "La Membrolle", "Mettray", "Charentilly", "Luynes",
  ],
  "75": ["Paris"],
  "69": [
    "Lyon", "Villeurbanne", "Vénissieux", "Caluire-et-Cuire", "Bron", "Vaulx-en-Velin",
    "Décines-Charpieu", "Oullins", "Saint-Genis-Laval", "Tassin-la-Demi-Lune", "Écully", "Ecully",
  ],
  "13": ["Marseille", "Marignane", "Vitrolles"],
  "31": [
    "Toulouse", "Blagnac", "Tournefeuille", "Cugnaux", "Villeneuve-Tolosane", "L'Union",
    "Saint-Jean", "Ramonville-Saint-Agne", "Balma", "Quint-Fonsegrives", "Castanet-Tolosan",
  ],
  "33": [
    "Bordeaux", "Mérignac", "Pessac", "Talence", "Gradignan", "Cenon", "Floirac", "Lormont",
    "Bègles", "Bruges", "Le Bouscat", "Eysines",
  ],
  "44": [
    "Nantes", "Rezé", "Saint-Herblain", "St-Herblain", "Saint-Sébastien-sur-Loire",
    "Vertou", "Bouguenais", "La Chapelle-sur-Erdre", "Orvault", "Carquefou", "Sainte-Luce-sur-Loire",
  ],
  "59": [
    "Lille", "Roubaix", "Tourcoing", "Villeneuve-d'Ascq", "Lomme", "Hellemmes",
    "Marcq-en-Barœul", "Marcq en Baroeul", "Lambersart", "Croix", "Haubourdin", "Mons-en-Barœul",
  ],
  "67": [
    "Strasbourg", "Schiltigheim", "Illkirch-Graffenstaden", "Hoenheim", "Bischheim",
    "Lingolsheim", "Ostwald", "Souffelweyersheim",
  ],
  "34": [
    "Montpellier", "Castelnau-le-Lez", "Saint-Jean-de-Védas", "Lattes", "Mauguio",
    "Pérols", "Le Crès", "Castries",
  ],
  "06": [
    "Nice", "Saint-Laurent-du-Var", "St-Laurent-du-Var", "Cagnes-sur-Mer",
    "Cannes", "Antibes", "Juan-les-Pins", "La Trinité", "Èze", "Cap-d'Ail",
  ],
  "35": [
    "Rennes", "Chantepie", "Bruz", "Chartres-de-Bretagne", "Cesson-Sévigné",
    "Pacé", "Le Rheu", "Saint-Grégoire", "Betton", "Saint-Jacques-de-la-Lande",
  ],
  "76": [
    "Rouen", "Sotteville-lès-Rouen", "Saint-Étienne-du-Rouvray", "Mont-Saint-Aignan",
    "Le Petit-Quevilly", "Bonsecours", "Déville-lès-Rouen", "Bois-Guillaume", "Darnétal",
  ],
  "38": [
    "Grenoble", "Saint-Martin-d'Hères", "Échirolles", "Eybens", "Fontaine",
    "Meylan", "La Tronche", "Gières", "Seyssinet-Pariset",
  ],
  "21": ["Dijon", "Chenôve", "Quetigny", "Talant", "Longvic", "Fontaine-lès-Dijon", "Saint-Apollinaire"],
  "49": [
    "Angers", "Les Ponts-de-Cé", "Avrillé", "Trélazé", "Beaucouzé",
    "Saint-Barthélemy-d'Anjou",
  ],
  "51": ["Reims", "Saint-Brice-Courcelles", "Cormontreuil", "Tinqueux", "Bezannes", "Bétheny"],
  "63": [
    "Clermont-Ferrand", "Cournon-d'Auvergne", "Chamalières", "Aubière", "Beaumont",
    "Pont-du-Château", "Romagnat",
  ],
  "64": ["Pau", "Lons", "Billère", "Bizanos", "Idron", "Jurançon", "Lescar"],
  "83": [
    "Toulon", "La Garde", "La Valette-du-Var", "Six-Fours-les-Plages", "La Seyne-sur-Mer",
    "Ollioules", "Hyères", "Carqueiranne",
  ],
};

/** Communes connues du département mais hors zone agglo → forfait local (90 € en 37) si l'autre point est dans le même dept. */
const DEPT_OUTSIDE_COMMUNES: Record<string, string[]> = {
  "37": [
    "Loches", "Amboise", "Chinon", "Bléré", "Azay-le-Rideau", "Sainte-Maure-de-Touraine",
    "Langeais", "Château-Renault", "Descartes", "Preuilly-sur-Claise", "Richelieu",
    "L'Île-Bouchard", "Montrésor", "Le Grand-Pressigny",
  ],
};

function normalizeStr(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[''`]/g, " ")
    .replace(/-/g, " ")
    .replace(/\bsainte\b/g, "ste")
    .replace(/\bsaint\b/g, "st")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function addrContainsCommune(addrNorm: string, commune: string): boolean {
  const c = normalizeStr(commune);
  if (!c) return false;
  const esc = c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`).test(addrNorm);
}

/** Cherche le département + zone (agglo|hors agglo) pour une adresse via nom de commune. */
function findDeptByCommune(address: string): { dept: string; inAgglo: boolean; matchLen: number } | null {
  const norm = normalizeStr(address);
  if (!norm) return null;
  let best: { dept: string; inAgglo: boolean; matchLen: number } | null = null;

  const test = (dept: string, communes: string[], inAgglo: boolean) => {
    for (const c of communes) {
      if (addrContainsCommune(norm, c)) {
        const len = normalizeStr(c).length;
        if (!best || len > best.matchLen) best = { dept, inAgglo, matchLen: len };
      }
    }
  };

  for (const [dept, communes] of Object.entries(DEPT_AGGLO_COMMUNES)) test(dept, communes, true);
  for (const [dept, communes] of Object.entries(DEPT_OUTSIDE_COMMUNES)) test(dept, communes, false);
  return best;
}

// Compat : ancien export utilisé ailleurs
export const DEPT_MAIN_CITIES: Record<string, string> = Object.fromEntries(
  Object.entries(DEPT_AGGLO).map(([k, v]) => [k, v.city]),
);

/** Extrait le code postal (5 chiffres) depuis une adresse. */
export function extractPostalCode(address: string): string | null {
  if (!address) return null;
  const m = address.match(/\b(\d{5})\b/);
  return m ? m[1] : null;
}

/** Extrait le code département (2 chiffres) depuis un code postal présent dans l'adresse. */
export function extractDeptCode(address: string): string | null {
  const cp = extractPostalCode(address);
  if (!cp) return null;
  if (cp.startsWith("20")) return null; // Corse non gérée
  return cp.slice(0, 2);
}

export interface LocalTariff {
  price: number;
  label: string;
  finalPrice: number;
  multiplierLabel: string;
  hasExtra: boolean;
}

/** Résout pour une adresse : dept + appartenance à la zone agglo. CP prioritaire, sinon nom de commune. */
function resolveAddrZone(address: string): { dept: string; inAgglo: boolean } | null {
  const cp = extractPostalCode(address);
  if (cp && !cp.startsWith("20")) {
    const dept = cp.slice(0, 2);
    const entry = DEPT_AGGLO[dept];
    if (entry) return { dept, inAgglo: entry.cps.includes(cp) };
  }
  const byCommune = findDeptByCommune(address);
  if (byCommune) return { dept: byCommune.dept, inAgglo: byCommune.inAgglo };
  return null;
}

/**
 * Renvoie le forfait local si départ et arrivée sont dans le même département couvert.
 * Détection via code postal OU nom de commune (zone agglo + hors agglo connues).
 */
export function resolveLocalDeptTariff(
  departure: string,
  arrival: string,
  _distanceKm: number,
  option: string,
): LocalTariff | null {
  const zDep = resolveAddrZone(departure);
  const zArr = resolveAddrZone(arrival);
  if (!zDep || !zArr) return null;
  if (zDep.dept !== zArr.dept) return null;

  const entry = DEPT_AGGLO[zDep.dept];
  if (!entry) return null;

  const bothAgglo = zDep.inAgglo && zArr.inAgglo;
  // Indre-et-Loire (37) : grille dédiée — 70 € intra-agglo Tours / 120 € A-R,
  // 90 € hors agglo / 130 € A-R. Autres départements : grille standard.
  const isDept37 = zDep.dept === "37";
  const simple = isDept37 ? (bothAgglo ? 70 : 90) : bothAgglo ? 79 : 99;
  const retour = isDept37 ? (bothAgglo ? 120 : 130) : 129;

  const label = bothAgglo
    ? `Forfait ${entry.city} (agglomération)`
    : `Forfait département ${zDep.dept} — hors agglomération`;

  if (option === "aller-retour") {
    return { price: simple, label, finalPrice: retour, multiplierLabel: "Livraison + Restitution", hasExtra: true };
  }
  if (option === "express") {
    return { price: simple, label, finalPrice: Math.round(simple * 1.2), multiplierLabel: "+20% express", hasExtra: true };
  }
  return { price: simple, label, finalPrice: simple, multiplierLabel: "", hasExtra: false };
}
