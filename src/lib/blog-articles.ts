export interface BlogArticle {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  category: string;
  metaDescription: string;
  content: { type: "h2" | "p" | "ul" | "quote"; text: string; items?: string[] }[];
}

export const articles: BlogArticle[] = [
  {
    slug: "comment-fonctionne-le-convoyage-automobile",
    title: "Comment fonctionne le convoyage automobile ?",
    excerpt:
      "Du devis à la livraison : découvrez chaque étape d'un convoyage professionnel et ce qui distingue un service premium d'un simple transfert.",
    date: "15 mars 2025",
    readTime: "5 min",
    category: "Guide",
    metaDescription:
      "Comment fonctionne le convoyage automobile en 2025 ? Étapes, garanties, prix moyens et conseils pour choisir le bon prestataire.",
    content: [
      { type: "p", text: "Le convoyage automobile consiste à confier la livraison de votre véhicule à un chauffeur professionnel qui le conduit jusqu'à sa destination, le plus souvent par la route. Contrairement au transport sur plateau, le véhicule roule par ses propres moyens — ce qui est généralement plus rapide, plus économique, et particulièrement adapté aux véhicules en parfait état de marche." },
      { type: "h2", text: "Les 3 grandes étapes d'un convoyage" },
      { type: "ul", text: "", items: [
        "Devis & réservation : vous communiquez le trajet, la date souhaitée et les caractéristiques du véhicule. Un tarif ferme vous est envoyé sous 24 h.",
        "Prise en charge : le convoyeur se présente au point de départ, effectue une inspection contradictoire (photos, niveau carburant, état général) et vous remet un bon de prise en charge signé.",
        "Livraison : le véhicule est livré à l'adresse convenue. Un second état des lieux est réalisé avec le destinataire, et un bon de livraison signé clôture la mission.",
      ] },
      { type: "h2", text: "Ce qui doit être inclus dans un service sérieux" },
      { type: "ul", text: "", items: [
        "Une assurance circulation tous risques pendant le trajet",
        "Le carburant et les péages",
        "Le suivi GPS ou des points d'étape réguliers",
        "Une inspection photo avant/après documentée",
      ] },
      { type: "h2", text: "Combien coûte un convoyage ?" },
      { type: "p", text: "Les tarifs varient selon la distance, le type de véhicule et le délai. Comptez en moyenne 0,80 à 1,20 € / km en France. Pour un trajet Tours – Paris (env. 240 km), prévoyez un budget de 220 à 280 € tout compris." },
      { type: "quote", text: "Le bon convoyeur, c'est celui qui traite votre véhicule comme s'il était le sien." },
      { type: "h2", text: "Comment choisir son prestataire ?" },
      { type: "p", text: "Vérifiez l'inscription au registre des transporteurs, l'assurance circulation, les avis clients et la transparence du devis. Méfiez-vous des prix anormalement bas : le carburant et les péages représentent à eux seuls une part significative du coût." },
    ],
  },
  {
    slug: "convoyage-tours-paris-combien-ca-coute",
    title: "Convoyage Tours – Paris : combien ça coûte en 2025 ?",
    excerpt:
      "Tarif moyen, délais, ce qui est inclus et les pièges à éviter pour un trajet Tours – Paris ou Tours – Île-de-France.",
    date: "8 mars 2025",
    readTime: "4 min",
    category: "Tarifs",
    metaDescription:
      "Convoyage Tours Paris : tarifs 2025, délais de livraison, options express et conseils pour bien comparer les devis.",
    content: [
      { type: "p", text: "Le trajet Tours – Paris est l'un des axes les plus demandés en convoyage automobile. Que ce soit pour un véhicule acheté en concession, une livraison à un client, un déménagement ou un retour de location longue durée, voici les vrais prix pratiqués en 2025." },
      { type: "h2", text: "Tarif moyen Tours – Paris" },
      { type: "p", text: "Pour un véhicule standard (citadine, berline, SUV compact) sur le trajet Tours – Paris (≈ 240 km), comptez entre 220 € et 280 € TTC, péages et carburant inclus. Les tarifs montent à 320–380 € pour un utilitaire ou un véhicule de luxe." },
      { type: "h2", text: "Ce qui doit être inclus" },
      { type: "ul", text: "", items: [
        "Carburant",
        "Péages autoroute",
        "Assurance circulation",
        "Inspection avant / après",
        "Retour du convoyeur",
      ] },
      { type: "h2", text: "Délai standard ou express ?" },
      { type: "p", text: "En standard, comptez 24 à 72 h selon la disponibilité. En express (départ sous 24 h), prévoyez un supplément de 30 à 50 €. Pour un convoyage urgent dans la journée, certains prestataires proposent un service prioritaire à partir de 350 €." },
      { type: "h2", text: "Les pièges à éviter" },
      { type: "ul", text: "", items: [
        "Prix qui n'incluent pas les péages (vous les payez en supplément à la livraison)",
        "Pas d'inspection contradictoire (impossible de prouver un dommage)",
        "Convoyeurs non déclarés (pas d'assurance valide en cas de pépin)",
      ] },
    ],
  },
  {
    slug: "pourquoi-confier-sa-voiture-a-un-convoyeur-professionnel",
    title: "Pourquoi confier sa voiture à un convoyeur professionnel ?",
    excerpt:
      "Gain de temps, sécurité, garanties : 5 raisons concrètes de passer par un convoyeur plutôt que de faire le trajet vous-même.",
    date: "1 mars 2025",
    readTime: "6 min",
    category: "Conseils",
    metaDescription:
      "Convoyeur automobile professionnel : 5 vraies raisons d'externaliser le transport de votre véhicule plutôt que de conduire vous-même.",
    content: [
      { type: "p", text: "Confier sa voiture à un inconnu pour qu'il fasse 500 km à votre place : sur le papier, l'idée peut surprendre. Pourtant, des milliers de particuliers et de professionnels font appel à des convoyeurs chaque mois. Voici pourquoi." },
      { type: "h2", text: "1. Gagner du temps (vraiment)" },
      { type: "p", text: "Faire un Tours – Marseille en voiture, c'est minimum une journée perdue, plus la fatigue. Un convoyeur s'en charge pendant que vous travaillez ou prenez le train pour rentrer. Le retour est même plus rapide en TGV." },
      { type: "h2", text: "2. Limiter le kilométrage de votre véhicule" },
      { type: "p", text: "Sur un véhicule en leasing ou en LLD, chaque kilomètre compte. Sur un véhicule de collection, c'est encore plus vrai. Un convoyeur peut aussi convoyer sur plateau si vous voulez zéro km supplémentaire." },
      { type: "h2", text: "3. Une assurance dédiée" },
      { type: "p", text: "Un convoyeur professionnel est couvert par une assurance circulation spécifique. En cas de sinistre, vous êtes mieux protégé qu'avec votre assurance personnelle classique." },
      { type: "h2", text: "4. Inspection contradictoire" },
      { type: "p", text: "Photos avant / après, état des lieux signé : tout est tracé. C'est essentiel pour les concessionnaires, les loueurs, mais aussi pour un particulier qui livre une voiture à un acheteur." },
      { type: "h2", text: "5. Pas de stress logistique" },
      { type: "p", text: "Pas besoin de gérer un aller-retour, de réserver un train, de poser une journée de RTT. Vous donnez les clés, vous les récupérez à l'arrivée. Simple." },
      { type: "quote", text: "Externaliser le convoyage, c'est acheter du temps et de la sérénité." },
    ],
  },
];

export function getArticle(slug: string) {
  return articles.find((a) => a.slug === slug);
}
