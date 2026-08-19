import remiseVehicule from "@/assets/blog/remise-vehicule.jpg";
import rotationsFlotte from "@/assets/blog/rotations-flotte.jpg";
import etatDesLieuxDigital from "@/assets/blog/etat-des-lieux-digital.jpg";
import vehiculeElectrique from "@/assets/blog/vehicule-electrique.jpg";
import routeBarcelone from "@/assets/blog/route-barcelone.jpg";
import appDriver from "@/assets/blog/app-driver.jpg";
import delaisFrance from "@/assets/blog/delais-france.jpg";
import concessionDigitale from "@/assets/blog/concession-digitale.jpg";
import chauffeurLigneo from "@/assets/blog/metier-convoyeur.jpg";
import driverSupercar from "@/assets/blog/vehicule-premium.jpg";

export type ArticleCategorie =
  | "Conseils clients"
  | "Coulisses"
  | "Métier convoyeur"
  | "Ligneo Pro";

export type ArticleBloc =
  | { type: "p"; texte: string }
  | { type: "h2"; texte: string }
  | { type: "image"; src: string; alt: string; legende?: string };

export type Article = {
  slug: string;
  titre: string;
  categorie: ArticleCategorie;
  date: string; // ISO
  dateLabel: string;
  auteur: string;
  lecture: number; // minutes
  extrait: string;
  cover: string;
  coverAlt: string;
  featured?: boolean;
  contenu: ArticleBloc[];
};

export const CATEGORIES: ArticleCategorie[] = [
  "Conseils clients",
  "Coulisses",
  "Métier convoyeur",
  "Ligneo Pro",
];

export const ARTICLES: Article[] = [
  {
    slug: "guide-complet-preparer-remise-vehicule",
    titre:
      "Convoyage automobile : le guide complet pour bien préparer la remise de votre véhicule",
    categorie: "Conseils clients",
    date: "2026-08-18",
    dateLabel: "18 août 2026",
    auteur: "Équipe Ligneo",
    lecture: 6,
    featured: true,
    extrait:
      "Un convoyage se joue souvent avant même le départ. Voici comment préparer la remise de votre véhicule pour que la mission se déroule sans accroc, du premier appel à la signature finale.",
    cover: remiseVehicule,
    coverAlt: "Clés de véhicule et document de remise posés sur un tableau de bord",
    contenu: [
      {
        type: "p",
        texte:
          "Confier son véhicule à un convoyeur, c'est confier un objet de valeur à quelqu'un que l'on n'a parfois jamais rencontré. La plupart des incidents que nous observons ne viennent pas de la route, mais d'une remise mal préparée : une clé manquante, un carburant au plus bas, un contact injoignable au moment du départ. En dix minutes de préparation, on évite l'essentiel des mauvaises surprises. Voici ce que nous recommandons à nos clients particuliers comme professionnels.",
      },
      { type: "h2", texte: "Rassembler les documents avant le jour J" },
      {
        type: "p",
        texte:
          "Le convoyeur doit pouvoir circuler légalement. Cela suppose la carte grise originale ou sa copie autorisée, une attestation d'assurance en cours de validité et, selon les cas, le bon de commande ou l'ordre de mission. Si le véhicule est encore immatriculé au nom d'un ancien propriétaire, prévenez-nous en amont : nous adaptons les documents de mission en conséquence. Un contrôle routier sans papiers, c'est une immobilisation de plusieurs heures et une livraison décalée d'une journée.",
      },
      {
        type: "p",
        texte:
          "Pensez également au dispositif de péage si vous en avez un dans le véhicule. Nous préférons que le badge reste dans la boîte à gants et que les frais soient refacturés, plutôt que d'avancer sur un compte qui n'est pas le vôtre. C'est plus clair pour tout le monde au moment de la facture.",
      },
      { type: "h2", texte: "Préparer physiquement le véhicule" },
      {
        type: "p",
        texte:
          "Un véhicule propre est un véhicule que l'on peut inspecter correctement. La carrosserie couverte de poussière masque les micro-rayures, et c'est précisément ce qui crée les litiges à l'arrivée. Un lavage rapide avant la prise en charge vous protège autant qu'il nous protège. Vérifiez aussi la pression des pneus, le niveau d'huile et l'état de la roue de secours ou du kit anti-crevaison.",
      },
      {
        type: "p",
        texte:
          "Côté carburant, prévoyez au minimum un quart de réservoir pour un trajet régional, davantage pour une longue distance. Pour un véhicule électrique, une charge d'au moins soixante-dix pour cent au départ évite un premier arrêt inutile dans la première heure. Retirez les objets personnels, les documents confidentiels et tout ce qui n'est pas indispensable : nous assurons le véhicule, pas les effets laissés à l'intérieur.",
      },
      {
        type: "image",
        src: etatDesLieuxDigital,
        alt: "Smartphone photographiant la carrosserie d'un véhicule lors de l'état des lieux",
        legende:
          "Chaque angle du véhicule est photographié au départ, puis à l'arrivée, dans l'application driver.",
      },
      { type: "h2", texte: "Le moment de l'état des lieux" },
      {
        type: "p",
        texte:
          "À la prise en charge, le convoyeur réalise un état des lieux digital complet : photos des quatre angles, du toit, de l'habitacle, du compteur kilométrique et du niveau de carburant, relevé des impacts éventuels sur un schéma du véhicule. Cette étape dure entre dix et quinze minutes. Restez présent si vous le pouvez, ou désignez une personne de confiance. La signature du document se fait directement sur l'écran, et vous recevez le rapport par email dans la foulée.",
      },
      {
        type: "p",
        texte:
          "Si vous ne pouvez pas être là, dites-le nous à la commande. Nous mettons en place une remise en agence, en concession ou sur un point relais convenu à l'avance, avec un code de suivi que le destinataire présente au convoyeur. Ce cas de figure est fréquent et ne pose aucune difficulté dès lors qu'il est anticipé.",
      },
      { type: "h2", texte: "Rester joignable pendant la mission" },
      {
        type: "p",
        texte:
          "Une mission de convoyage vit. Un embouteillage, une borne hors service, un destinataire absent : ces aléas se règlent en trente secondes par téléphone et coûtent une demi-journée quand personne ne répond. Donnez-nous un numéro joignable, et celui du destinataire si ce n'est pas vous. Vous recevez un lien de suivi qui vous indique l'état d'avancement en temps réel, ce qui évite déjà la moitié des appels.",
      },
      { type: "h2", texte: "La livraison, dernière étape à ne pas bâcler" },
      {
        type: "p",
        texte:
          "À l'arrivée, le second état des lieux est comparé au premier, photo par photo. Le destinataire signe, et le procès-verbal complet est archivé et envoyé aux deux parties. C'est ce document qui fait foi en cas de contestation ultérieure, alors prenez le temps de le lire avant de signer. Si vous constatez quelque chose, signalez-le immédiatement : une réserve inscrite le jour même se traite en quelques jours, une réclamation trois semaines plus tard devient beaucoup plus difficile à instruire.",
      },
      {
        type: "p",
        texte:
          "Un convoyage bien préparé se remarque à peu de choses : il n'y a rien à raconter à la fin. C'est exactement l'objectif que nous poursuivons sur chaque mission.",
      },
    ],
  },
  {
    slug: "loueurs-concessions-automatiser-rotations-api",
    titre:
      "Loueurs et concessions : automatiser vos rotations de véhicules grâce à notre API",
    categorie: "Ligneo Pro",
    date: "2026-08-14",
    dateLabel: "14 août 2026",
    auteur: "Équipe Ligneo",
    lecture: 5,
    extrait:
      "Quand les rotations se comptent en dizaines par semaine, l'email et le tableur atteignent vite leur limite. Notre API permet de créer, suivre et facturer les convoyages depuis vos propres outils.",
    cover: rotationsFlotte,
    coverAlt: "Parc de véhicules neufs en attente de convoyage",
    contenu: [
      {
        type: "p",
        texte:
          "Un loueur qui déplace quinze véhicules par semaine entre deux agences n'a pas le même besoin qu'un particulier qui fait convoyer sa voiture une fois dans sa vie. Le premier a besoin que la commande parte de son propre système, que le statut remonte sans qu'il ait à demander, et que la facturation se rapproche seule de ses lignes de coût. C'est exactement ce que nous avons construit avec l'API Ligneo Pro.",
      },
      { type: "h2", texte: "Ce que l'API permet concrètement" },
      {
        type: "p",
        texte:
          "Vous créez une demande de convoyage en un appel, avec l'adresse de départ, l'adresse d'arrivée, les informations du véhicule et la fenêtre horaire souhaitée. Nous répondons avec un identifiant de mission et une estimation tarifaire calculée sur la même grille que celle de votre contrat. À partir de là, chaque changement d'état est disponible : convoyeur attribué, véhicule pris en charge, état des lieux de départ validé, en route, livré.",
      },
      {
        type: "p",
        texte:
          "Les documents suivent le même chemin. Le procès-verbal de départ, celui d'arrivée et la facture sont récupérables au format PDF, avec leurs métadonnées. Beaucoup de nos clients les injectent directement dans leur outil de gestion de parc, ce qui supprime la ressaisie et le classement manuel.",
      },
      { type: "h2", texte: "Le suivi en temps réel sans relance" },
      {
        type: "p",
        texte:
          "Plutôt que d'interroger notre API en boucle, vous déclarez une adresse de réception et nous vous envoyons un événement à chaque étape. Chaque envoi est signé, ce qui vous permet de vérifier qu'il vient bien de nous, et nous réessayons automatiquement en cas d'indisponibilité de votre serveur. Pour une équipe logistique, cela change la nature du travail : on ne court plus après l'information, on traite les exceptions.",
      },
      {
        type: "image",
        src: concessionDigitale,
        alt: "Ordinateur portable affichant le suivi des convoyages d'une concession",
      },
      { type: "h2", texte: "Un exemple d'intégration" },
      {
        type: "p",
        texte:
          "La création d'une mission tient en une requête. Vous authentifiez votre appel avec votre clé partenaire, vous décrivez le trajet et le véhicule, et vous recevez immédiatement l'identifiant à conserver dans votre base. Les équipes techniques que nous accompagnons mettent en général une demi-journée à faire fonctionner le premier appel, et deux à trois jours pour couvrir tout le cycle de vie d'une mission, tests compris.",
      },
      {
        type: "p",
        texte:
          "Nous fournissons un environnement de test avec des missions fictives, pour que vos développeurs puissent dérouler l'ensemble des statuts sans mobiliser un vrai convoyeur. Les clés de production ne sont délivrées qu'ensuite, une fois le parcours validé de bout en bout.",
      },
      { type: "h2", texte: "À qui cela s'adresse" },
      {
        type: "p",
        texte:
          "L'API a été pensée pour les loueurs multi-agences, les concessions et groupes de distribution, les plateformes de vente en ligne et les gestionnaires de flotte. En dessous d'une dizaine de mouvements mensuels, l'espace Ligneo Pro en ligne suffit largement et ne demande aucun développement. Au-delà, l'automatisation se rentabilise en quelques semaines, essentiellement sur le temps administratif économisé.",
      },
      {
        type: "p",
        texte:
          "Nous accompagnons chaque intégration avec un interlocuteur unique côté Ligneo, qui connaît votre contrat et vos contraintes. Si vous souhaitez évaluer la faisabilité pour votre organisation, la documentation complète et un accès de test sont disponibles sur demande.",
      },
    ],
  },
  {
    slug: "devenir-convoyeur-independant-2026",
    titre:
      "Devenir convoyeur indépendant en 2026 : ce qu'il faut savoir avant de se lancer",
    categorie: "Métier convoyeur",
    date: "2026-08-07",
    dateLabel: "7 août 2026",
    auteur: "Équipe Ligneo",
    lecture: 6,
    extrait:
      "Statut, assurances, revenus réels, rythme de vie : le point honnête sur un métier qui attire beaucoup, et qui demande plus de rigueur qu'on ne l'imagine.",
    cover: chauffeurLigneo,
    coverAlt: "Habitacle d'un véhicule prêt au départ, clés sur le siège",
    contenu: [
      {
        type: "p",
        texte:
          "Chaque semaine, nous recevons des candidatures de personnes qui veulent se lancer dans le convoyage. Le métier attire pour de bonnes raisons : de l'autonomie, de la route, un contact direct avec les clients et une barrière à l'entrée raisonnable. Il mérite aussi d'être présenté sans enjolivement, parce que ceux qui abandonnent au bout de trois mois sont souvent ceux qui s'attendaient à autre chose.",
      },
      { type: "h2", texte: "Le statut et les obligations administratives" },
      {
        type: "p",
        texte:
          "La très grande majorité des convoyeurs exercent en micro-entreprise, avec un code d'activité adapté au transport de véhicules par route sous conduite. L'immatriculation est gratuite et se fait en ligne. Ce statut convient bien tant que le chiffre d'affaires reste sous les plafonds, et il permet de démarrer sans capital. Au-delà, ou si vous employez quelqu'un, la société devient plus pertinente.",
      },
      {
        type: "p",
        texte:
          "Le permis B suffit pour les véhicules légers, mais l'ancienneté compte : la plupart des donneurs d'ordre, nous compris, demandent au moins trois ans de permis et un relevé d'information d'assurance sans sinistre responsable récent. Un extrait de casier judiciaire est également demandé, puisque vous manipulez des biens de valeur appartenant à des tiers.",
      },
      { type: "h2", texte: "L'assurance, le point à ne pas négliger" },
      {
        type: "p",
        texte:
          "C'est le sujet sur lequel les débutants se trompent le plus. Votre assurance auto personnelle ne couvre pas la conduite d'un véhicule confié dans un cadre professionnel. Il vous faut une responsabilité civile professionnelle, et selon les missions une garantie spécifique pour le véhicule convoyé. Chez Ligneo, la couverture du véhicule pendant la mission est portée par nos contrats, mais le convoyeur doit disposer de sa propre responsabilité civile professionnelle. Demandez toujours à voir l'attestation du donneur d'ordre avant de prendre le volant.",
      },
      {
        type: "image",
        src: driverSupercar,
        alt: "Véhicule premium prêt à être pris en charge",
      },
      { type: "h2", texte: "Les revenus, sans promesse creuse" },
      {
        type: "p",
        texte:
          "Une mission se rémunère au forfait, selon la distance, le type de véhicule et l'urgence. Un convoyeur régulier enchaîne entre huit et quinze missions par semaine selon la saison et sa zone géographique. Ce qui fait la différence sur le revenu net, ce n'est pas le tarif affiché mais les temps morts : les retours à vide, les attentes en concession, les trains ou covoiturages pour rentrer. Un convoyeur expérimenté organise ses journées en boucles, avec une mission aller et une mission retour, et améliore mécaniquement sa rentabilité.",
      },
      {
        type: "p",
        texte:
          "Comptez aussi les charges réelles : cotisations sociales, assurance, téléphone, repas, hébergement occasionnel. Un chiffre d'affaires confortable en apparence peut fondre si ces postes ne sont pas suivis dès le premier mois.",
      },
      { type: "h2", texte: "Le rythme et les qualités qui comptent" },
      {
        type: "p",
        texte:
          "Le métier demande de la souplesse horaire, des départs tôt, parfois des nuits loin de chez soi. Il demande surtout une rigueur documentaire que beaucoup sous-estiment : un état des lieux bâclé et c'est votre responsabilité qui est engagée sur une rayure que vous n'avez pas faite. Les convoyeurs qui durent sont ceux qui prennent le temps de photographier correctement, de signaler ce qui cloche et de prévenir avant que le client ne s'inquiète.",
      },
      {
        type: "p",
        texte:
          "Enfin, la conduite d'un véhicule qui ne vous appartient pas s'apprend. On roule souplement, on ne teste pas les reprises, on ramène le véhicule dans l'état où on l'a pris, réglages du siège remis en place et habitacle propre. C'est cette exigence quotidienne qui fait revenir les clients, et qui fait la réputation d'un convoyeur bien plus que son nombre de kilomètres.",
      },
    ],
  },
  {
    slug: "etat-des-lieux-digital-transports-ligneo",
    titre: "Comment se déroule un état des lieux digital chez Transports Ligneo",
    categorie: "Coulisses",
    date: "2026-07-31",
    dateLabel: "31 juillet 2026",
    auteur: "Équipe Ligneo",
    lecture: 5,
    extrait:
      "Photos horodatées, schéma de carrosserie, signatures sur écran et procès-verbal envoyé dans la minute. Visite guidée de l'étape la plus importante d'une mission.",
    cover: etatDesLieuxDigital,
    coverAlt: "Smartphone affichant un état des lieux numérique devant une carrosserie",
    contenu: [
      {
        type: "p",
        texte:
          "L'état des lieux est le cœur d'une mission de convoyage. C'est lui qui établit, de manière incontestable, dans quel état le véhicule a été pris et dans quel état il a été rendu. Pendant longtemps, cette étape s'est faite sur un formulaire papier photocopié, avec un schéma minuscule et des croix approximatives. Nous avons remplacé ce document par un parcours guidé dans l'application driver, et cela a changé la vie de tout le monde.",
      },
      { type: "h2", texte: "Le parcours vu par le convoyeur" },
      {
        type: "p",
        texte:
          "Quand le convoyeur ouvre sa mission, l'application lui impose un ordre précis. Il commence par les informations du véhicule : plaque, kilométrage, niveau de carburant ou état de charge. Vient ensuite la série de photos obligatoires, angle par angle, avec un cadre indicatif à l'écran pour éviter les clichés flous ou trop rapprochés. Impossible de passer à l'étape suivante tant qu'une photo manque, et c'est volontaire.",
      },
      {
        type: "p",
        texte:
          "Sur le schéma de carrosserie, il place ensuite les dommages constatés : rayure, impact, enfoncement, éclat de pare-brise. Chaque marque peut être accompagnée d'une photo rapprochée et d'un commentaire. Le tout est horodaté et géolocalisé au moment de la validation, ce qui évite les contestations sur le lieu et l'heure de la prise en charge.",
      },
      { type: "h2", texte: "Ce que la technologie ajoute" },
      {
        type: "p",
        texte:
          "Le scanner de documents intégré permet de photographier la carte grise et de récupérer automatiquement les informations du véhicule, sans ressaisie. Une analyse d'image assiste le convoyeur en signalant les zones qui ressemblent à un dommage sur les photos prises. Le convoyeur garde toujours la main : la machine propose, l'humain valide ou corrige. Nous avons délibérément refusé un système entièrement automatique, parce qu'une détection manquée créerait un faux sentiment de sécurité.",
      },
      {
        type: "p",
        texte:
          "Les photos sont envoyées au fur et à mesure, et l'application fonctionne hors ligne. Dans un parking souterrain ou une zone blanche, le convoyeur poursuit son état des lieux normalement, et tout se synchronise dès que le réseau revient.",
      },
      {
        type: "image",
        src: remiseVehicule,
        alt: "Clés et document de remise posés sur le tableau de bord",
        legende:
          "La signature du client et celle du convoyeur sont recueillies sur l'écran, puis intégrées au procès-verbal.",
      },
      { type: "h2", texte: "Signature et procès-verbal" },
      {
        type: "p",
        texte:
          "L'étape finale réunit les deux signatures, celle du convoyeur et celle de la personne qui remet ou reçoit le véhicule. Le procès-verbal est généré immédiatement en PDF, avec la totalité des photos, le schéma annoté, les relevés et les signatures. Il part par email aux parties concernées et reste consultable dans l'espace client. À la livraison, le même parcours se répète et le document d'arrivée est mis en regard de celui du départ.",
      },
      { type: "h2", texte: "Pourquoi cela réduit les litiges" },
      {
        type: "p",
        texte:
          "Depuis le passage au digital, la quasi-totalité des réclamations se tranche en consultant deux jeux de photos. Quand un dommage était déjà présent au départ, la preuve est immédiate et le client en est informé le jour même plutôt que trois semaines plus tard. Quand un dommage est survenu pendant la mission, nous le reconnaissons tout aussi vite, et le traitement démarre sans discussion sur les faits. C'est cette symétrie qui fait la valeur du procédé : il protège autant le client que le convoyeur.",
      },
    ],
  },
  {
    slug: "convoyage-vehicule-electrique-bons-reflexes",
    titre:
      "Convoyage de véhicule électrique : les bons réflexes pour une livraison sans stress",
    categorie: "Conseils clients",
    date: "2026-07-24",
    dateLabel: "24 juillet 2026",
    auteur: "Équipe Ligneo",
    lecture: 5,
    extrait:
      "Charge au départ, câbles, badges de recharge, temps de trajet réel : ce qui distingue un convoyage électrique d'un convoyage thermique, et comment l'anticiper.",
    cover: vehiculeElectrique,
    coverAlt: "Véhicule électrique en charge sur une aire d'autoroute",
    contenu: [
      {
        type: "p",
        texte:
          "La part de véhicules électriques dans nos missions a doublé en deux ans. Techniquement, un convoyage électrique n'a rien de compliqué, mais il obéit à d'autres contraintes qu'un convoyage thermique. Les ignorer, c'est transformer un trajet de quatre heures en journée entière. Voici ce que nous avons appris sur le terrain.",
      },
      { type: "h2", texte: "Partir avec une charge suffisante" },
      {
        type: "p",
        texte:
          "Le premier réflexe, c'est la charge au départ. Nous demandons au minimum soixante-dix pour cent pour un trajet régional et une charge complète pour une longue distance. Un véhicule remis à vingt pour cent oblige le convoyeur à s'arrêter dans la première demi-heure, souvent sur une borne saturée en heure de pointe, et le retard se propage sur toute la journée. Si le véhicule sort d'un stockage prolongé, vérifiez aussi la batterie de servitude : une batterie douze volts à plat immobilise une voiture électrique aussi sûrement qu'une thermique.",
      },
      {
        type: "p",
        texte:
          "Laissez les câbles dans le coffre, y compris le câble domestique. Ils font partie du véhicule, ils seront inventoriés à l'état des lieux, et ils peuvent sauver une fin de trajet si la borne prévue est hors service.",
      },
      { type: "h2", texte: "Les cartes et badges de recharge" },
      {
        type: "p",
        texte:
          "Nos convoyeurs disposent de leurs propres badges couvrant les principaux réseaux, et les frais de recharge sont refacturés au réel sur la facture de mission. Si vous préférez que nous utilisions votre abonnement, laissez la carte dans le véhicule et signalez-le à la commande. Dans tous les cas, indiquez si le véhicule est bridé sur certains réseaux ou si l'accès à la recharge rapide est verrouillé par un code, ce qui arrive sur des véhicules de flotte.",
      },
      { type: "h2", texte: "Le temps de trajet réel" },
      {
        type: "p",
        texte:
          "Sur autoroute, un véhicule électrique consomme davantage que son autonomie annoncée ne le laisse penser, particulièrement en hiver ou avec des roues de grande taille. Nous calculons nos délais en intégrant un arrêt de recharge toutes les deux heures et demie environ, soit vingt-cinq à quarante minutes selon la puissance acceptée par le véhicule. Concrètement, un Tours vers Lyon se planifie sur une demi-journée pleine, là où une thermique se ferait d'une traite.",
      },
      {
        type: "p",
        texte:
          "Nous conduisons également les électriques différemment : vitesse stabilisée, anticipation des ralentissements, récupération d'énergie exploitée plutôt que freinage tardif. Ce n'est pas seulement une question d'autonomie, c'est aussi la meilleure façon de rendre un véhicule qui n'a pas souffert.",
      },
      {
        type: "image",
        src: delaisFrance,
        alt: "Autoroute française traversant la campagne au lever du jour",
      },
      { type: "h2", texte: "À l'arrivée" },
      {
        type: "p",
        texte:
          "Nous livrons systématiquement avec un niveau de charge exploitable, jamais en dessous de vingt pour cent, sauf demande contraire. Le pourcentage relevé au départ et à l'arrivée figure sur le procès-verbal au même titre que le kilométrage. Si le véhicule doit rester stationné plusieurs semaines après la livraison, une charge autour de cinquante pour cent est préférable pour la longévité de la batterie, et nous pouvons viser ce niveau si vous nous le précisez.",
      },
      {
        type: "p",
        texte:
          "Le convoyage électrique demande un peu plus de préparation, pas plus de complexité. Une charge correcte au départ, les câbles à bord et une information claire sur les accès de recharge suffisent à ce que la mission se déroule exactement comme une autre.",
      },
    ],
  },
  {
    slug: "coulisses-mission-longue-distance-tours-barcelone",
    titre: "Dans les coulisses d'une mission longue distance : Tours vers Barcelone",
    categorie: "Coulisses",
    date: "2026-07-15",
    dateLabel: "15 juillet 2026",
    auteur: "Équipe Ligneo",
    lecture: 6,
    extrait:
      "Environ dix heures de route, un passage de frontière, une livraison en fin de journée. Récit détaillé d'une mission internationale, de la préparation au retour du convoyeur.",
    cover: routeBarcelone,
    coverAlt: "Route de montagne vers l'Espagne au coucher du soleil",
    contenu: [
      {
        type: "p",
        texte:
          "Les missions internationales représentent une petite part de notre activité, mais ce sont celles qui demandent le plus de préparation. Nous avons suivi un convoyage Tours vers Barcelone pour montrer ce qui se passe réellement entre la prise en charge et la remise des clés, à plus de mille kilomètres de distance.",
      },
      { type: "h2", texte: "La veille : préparation et validation" },
      {
        type: "p",
        texte:
          "Tout commence la veille au bureau. Le dossier est vérifié point par point : carte grise, attestation d'assurance couvrant l'Espagne, ordre de mission bilingue, coordonnées du destinataire et créneau de livraison confirmé. Le convoyeur reçoit la mission sur son application avec l'itinéraire, les péages estimés et les arrêts recommandés. Il valide sa disponibilité et prépare son retour, dans ce cas précis un train depuis Barcelone en fin de soirée.",
      },
      {
        type: "p",
        texte:
          "Le trajet représente environ dix heures de route effective, hors pauses, et un seul passage de frontière, celui entre la France et l'Espagne. C'est cette réalité qui structure la journée : un départ très tôt est indispensable pour livrer avant la fermeture du site destinataire.",
      },
      { type: "h2", texte: "Six heures du matin, prise en charge" },
      {
        type: "p",
        texte:
          "Le convoyeur arrive sur site avant l'ouverture. État des lieux complet sous les projecteurs du parking, une vingtaine de photos, relevé du kilométrage, vérification des niveaux et de la pression des pneus. Le véhicule part avec le plein fait. Signature du remettant sur l'écran, procès-verbal envoyé, et la mission bascule en statut départ effectué. Le client reçoit sa notification à six heures vingt.",
      },
      {
        type: "image",
        src: routeBarcelone,
        alt: "Autoroute traversant un paysage de montagne près de la frontière espagnole",
        legende:
          "L'approche des Pyrénées marque la seule frontière du parcours entre la France et l'Espagne.",
      },
      { type: "h2", texte: "La route et ses pauses obligatoires" },
      {
        type: "p",
        texte:
          "La descente vers le sud se fait par étapes. Nos règles internes imposent une pause d'au moins vingt minutes toutes les deux heures, et le convoyeur les respecte scrupuleusement parce que sa position et ses arrêts sont visibles côté exploitation. Vers midi, un arrêt plus long permet de déjeuner et de faire le second plein. La traversée de la frontière se passe sans formalité particulière, mais le dossier papier reste à portée de main dans l'éventualité d'un contrôle.",
      },
      {
        type: "p",
        texte:
          "L'entrée dans l'agglomération de Barcelone est le moment le plus délicat de la journée. Circulation dense, zones à faibles émissions, accès livraison parfois étroits : le convoyeur avait vérifié la veille que le véhicule était éligible à la circulation dans la zone concernée. Ce contrôle en amont évite une amende et une livraison impossible.",
      },
      { type: "h2", texte: "La livraison, puis le retour" },
      {
        type: "p",
        texte:
          "Arrivée en fin d'après-midi. Second état des lieux, comparé photo par photo avec celui du matin, aucune réserve. Le destinataire signe, reçoit le procès-verbal en espagnol et en français, et la mission se clôture. Le convoyeur rejoint la gare, envoie ses justificatifs de péage et de carburant depuis l'application, et prend son train.",
      },
      {
        type: "p",
        texte:
          "Une mission de ce type ne s'improvise pas. Ce qui la rend fluide, ce n'est pas la performance sur la route, c'est tout ce qui a été vérifié avant le départ. Quand la préparation est faite, il ne reste qu'à conduire proprement et à tenir les horaires annoncés.",
      },
    ],
  },
  {
    slug: "de-la-mission-papier-au-smartphone",
    titre:
      "De la mission papier au smartphone : comment l'app driver a changé notre quotidien",
    categorie: "Métier convoyeur",
    date: "2026-07-01",
    dateLabel: "1 juillet 2026",
    auteur: "Équipe Ligneo",
    lecture: 5,
    extrait:
      "Avant, il fallait imprimer, classer, rappeler le bureau. Aujourd'hui tout tient dans une poche. Retour sur ce que la numérisation a réellement changé pour nos convoyeurs.",
    cover: appDriver,
    coverAlt: "Smartphone affichant l'application mission dans un habitacle",
    contenu: [
      {
        type: "p",
        texte:
          "Il y a encore quelques années, une journée de convoyage commençait par un passage au bureau ou par une impression à la maison. Ordre de mission, formulaire d'état des lieux, feuille de route, parfois une carte annotée à la main. On repartait le soir avec une pochette de papiers à scanner ou à déposer, et la facturation attendait que tout arrive. Ce fonctionnement marchait, mais il coûtait à chacun une heure par jour et générait sa part d'erreurs.",
      },
      { type: "h2", texte: "Ce qui a disparu" },
      {
        type: "p",
        texte:
          "La première chose que l'application a supprimée, c'est l'appel au bureau pour savoir quoi faire. La mission arrive avec tout ce qu'il faut : adresses exactes, contacts, particularités du véhicule, créneau attendu, tarif convenu. Le convoyeur ouvre son téléphone et sait immédiatement où il va et ce qui est attendu de lui.",
      },
      {
        type: "p",
        texte:
          "La deuxième, c'est le formulaire papier. Plus de croix illisibles sur un schéma minuscule, plus de photos prises sur un téléphone personnel puis oubliées dans la galerie. Les photos sont attachées à la mission, horodatées, envoyées au fil de l'eau. Le convoyeur ne s'occupe plus de transmettre quoi que ce soit.",
      },
      {
        type: "p",
        texte:
          "La troisième, c'est l'attente de paiement liée aux documents manquants. Les justificatifs de péage, de carburant et de transport se photographient depuis l'application. Quand la mission se clôture, le dossier est complet, et le règlement suit le calendrier prévu sans relance.",
      },
      {
        type: "image",
        src: appDriver,
        alt: "Smartphone affichant la mission en cours dans l'habitacle",
      },
      { type: "h2", texte: "Ce qui a été plus difficile à accepter" },
      {
        type: "p",
        texte:
          "Il serait malhonnête de présenter la transition comme unanimement bien accueillie. L'application impose des étapes obligatoires, et certains convoyeurs ont vécu cela comme un contrôle. Une checklist de sécurité qui bloque le départ tant qu'elle n'est pas remplie, cela agace quand on est pressé. Nous avons maintenu ces contraintes parce que ce sont précisément les missions expédiées à la hâte qui finissent en litige, et le litige se retourne toujours contre le convoyeur.",
      },
      {
        type: "p",
        texte:
          "Nous avons en revanche beaucoup retravaillé l'ergonomie à partir des retours du terrain. Les boutons ont grossi, le nombre d'écrans a diminué, le mode hors ligne a été fiabilisé après plusieurs plaintes sur les parkings souterrains. Les convoyeurs qui râlaient le plus au départ sont souvent ceux qui nous ont le plus aidés à améliorer l'outil.",
      },
      { type: "h2", texte: "Le bilan après deux ans" },
      {
        type: "p",
        texte:
          "Le temps administratif quotidien est passé d'environ une heure à une quinzaine de minutes. Les litiges sur l'état du véhicule se règlent en général le jour même. Et le rapport avec le client a changé : quand la personne qui reçoit le véhicule voit le rapport complet arriver par mail avant même que le convoyeur ne soit reparti, la confiance s'installe autrement.",
      },
      {
        type: "p",
        texte:
          "Le métier, lui, n'a pas changé. Il s'agit toujours de prendre soin d'un véhicule qui ne nous appartient pas et de le rendre à l'heure. L'outil n'a fait que retirer ce qui empêchait de s'y consacrer.",
      },
    ],
  },
  {
    slug: "concessionnaires-digitaliser-suivi-convoyages",
    titre:
      "Concessionnaires : pourquoi digitaliser le suivi de vos convoyages change tout",
    categorie: "Ligneo Pro",
    date: "2026-06-24",
    dateLabel: "24 juin 2026",
    auteur: "Équipe Ligneo",
    lecture: 5,
    extrait:
      "Le convoyage est souvent le dernier maillon non suivi de la chaîne de livraison. C'est aussi celui que le client final juge en premier.",
    cover: concessionDigitale,
    coverAlt: "Poste de travail concession avec tableau de bord des livraisons",
    contenu: [
      {
        type: "p",
        texte:
          "Dans une concession, presque tout est tracé. Le stock, les commandes, les passages en atelier, les relances commerciales. Le convoyage, lui, reste souvent géré par téléphone et par mail, avec un tableur partagé qui n'est jamais à jour au bon moment. C'est paradoxal, parce que c'est l'étape qui détermine la date de livraison promise au client final.",
      },
      { type: "h2", texte: "Le coût invisible de l'absence de suivi" },
      {
        type: "p",
        texte:
          "Quand un vendeur ne sait pas où en est un véhicule, il fait ce qu'il peut : il appelle. Ce sont trois à cinq appels par mouvement, multipliés par le nombre de véhicules en transit. Additionnés sur un mois, cela représente plusieurs journées de travail passées à chercher une information qui existe déjà quelque part. Le vrai coût n'est pas là non plus, il est dans la promesse tenue ou non au client, qui se souviendra du retard bien plus que de la remise commerciale.",
      },
      {
        type: "p",
        texte:
          "Les litiges de carrosserie suivent la même logique. Sans état des lieux photographique daté, la discussion entre la concession, le transporteur et le client final se fait de mémoire. Elle se solde en général par un geste commercial, faute de preuve.",
      },
      { type: "h2", texte: "Ce que change un suivi partagé" },
      {
        type: "p",
        texte:
          "Avec un espace de suivi, chaque véhicule en mouvement a un statut lisible par toute l'équipe : commandé, convoyeur attribué, pris en charge, en route, livré. Le vendeur consulte lui-même plutôt que d'appeler, et le client peut recevoir un lien de suivi si vous le souhaitez. Les documents de mission sont attachés au dossier du véhicule et restent accessibles des mois plus tard, ce qui est décisif le jour où un client revient sur un impact de pare-brise.",
      },
      {
        type: "image",
        src: rotationsFlotte,
        alt: "Véhicules alignés sur le parc de livraison d'une concession",
      },
      { type: "h2", texte: "Le pilotage sur la durée" },
      {
        type: "p",
        texte:
          "Un suivi structuré produit des données exploitables. Vous voyez le délai moyen par axe, le taux de livraisons dans le créneau annoncé, le coût réel par véhicule déplacé et la part de mouvements urgents dans votre volume. Ces indicateurs ne servent pas à faire des tableaux, ils servent à négocier vos plannings de livraison et à repérer les trajets où l'anticipation vous ferait économiser sur l'express.",
      },
      {
        type: "p",
        texte:
          "Pour les groupes multi-sites, la vision consolidée fait apparaître autre chose : des véhicules qui se croisent entre deux points de vente, ou des mouvements qui pourraient être groupés dans la même journée. Ce sont des économies immédiates, sans changer de prestataire ni renégocier un tarif.",
      },
      { type: "h2", texte: "Par où commencer" },
      {
        type: "p",
        texte:
          "L'espace Ligneo Pro s'utilise sans installation ni développement. Vous commandez vos convoyages en ligne, vous suivez vos véhicules en temps réel, vous retrouvez vos procès-verbaux et vos factures au même endroit, avec un accès par utilisateur et une vue par site. Pour les structures qui déplacent plusieurs dizaines de véhicules par mois, l'étape suivante consiste à connecter votre outil de gestion de parc à notre API pour supprimer entièrement la saisie manuelle.",
      },
      {
        type: "p",
        texte:
          "Dans les deux cas, la mise en route se fait en quelques jours. Le gain se mesure dès le premier mois sur le nombre d'appels que votre équipe ne passe plus.",
      },
    ],
  },
  {
    slug: "delais-convoyage-france-grille-reference",
    titre:
      "Combien de temps prévoir pour un convoyage France entière ? Notre grille de référence",
    categorie: "Conseils clients",
    date: "2026-06-16",
    dateLabel: "16 juin 2026",
    auteur: "Équipe Ligneo",
    lecture: 5,
    extrait:
      "Distances, contraintes horaires, disponibilité des interlocuteurs : les repères que nous utilisons pour annoncer un délai réaliste, et les facteurs qui l'allongent.",
    cover: delaisFrance,
    coverAlt: "Autoroute française vue du ciel au lever du soleil",
    contenu: [
      {
        type: "p",
        texte:
          "La question revient à chaque demande de devis : combien de temps pour amener ce véhicule d'un point à un autre. La réponse honnête tient en deux parties. Il y a le temps de route, qui se calcule, et il y a le temps d'organisation, qui dépend de vous autant que de nous. Voici les repères que nous utilisons au quotidien.",
      },
      { type: "h2", texte: "Les repères par distance" },
      {
        type: "p",
        texte:
          "En dessous de deux cents kilomètres, la mission se fait dans la journée, souvent en une demi-journée. Entre deux cents et cinq cents kilomètres, comptez une journée complète, avec une prise en charge le matin et une livraison en fin d'après-midi. Entre cinq cents et huit cents kilomètres, la journée reste possible avec un départ très tôt, mais nous préférons annoncer une journée et demie pour ne pas dépendre du trafic.",
      },
      {
        type: "p",
        texte:
          "Au-delà de huit cents kilomètres, par exemple un Lille vers Marseille ou un Brest vers Nice, il faut prévoir deux jours. La réglementation sur le temps de conduite et notre propre politique de sécurité interdisent d'enchaîner dix heures de volant sans coupure longue. Un convoyage express en une seule journée reste envisageable sur certains axes avec un relais entre deux convoyeurs, mais c'est une prestation spécifique qui se planifie à l'avance.",
      },
      { type: "h2", texte: "Le délai de mise en route" },
      {
        type: "p",
        texte:
          "À ce temps de route s'ajoute le délai d'attribution. En semaine, sur les axes fréquentés, nous positionnons un convoyeur sous vingt-quatre à quarante-huit heures. Sur des zones plus rurales ou pour des véhicules particuliers comme les utilitaires longs, les véhicules non roulants ou les modèles de collection, prévoyez plutôt trois à cinq jours. Une demande déposée le vendredi après-midi pour un départ le lundi matin est courante et se traite sans difficulté.",
      },
      {
        type: "image",
        src: remiseVehicule,
        alt: "Clés et document de livraison à l'arrivée de la mission",
      },
      { type: "h2", texte: "Ce qui allonge réellement les délais" },
      {
        type: "p",
        texte:
          "Le premier facteur, ce sont les horaires d'ouverture. Une concession qui ne prend pas les véhicules avant neuf heures et ferme à dix-sept heures réduit la fenêtre utile, et transforme parfois une mission d'une journée en mission d'une journée et demie. Le second, c'est la disponibilité des interlocuteurs : un remettant absent le matin décale tout le reste.",
      },
      {
        type: "p",
        texte:
          "Viennent ensuite les cas particuliers. Un véhicule électrique demande des arrêts de recharge, ce qui ajoute une à deux heures sur une longue distance. Un véhicule non roulant impose un plateau et une planification différente. Les périodes de départs en vacances et les vendredis de fin de mois pèsent sur le trafic et sur la disponibilité des convoyeurs. Enfin, une commande sans date précise attend forcément plus longtemps qu'une commande avec un créneau clair.",
      },
      { type: "h2", texte: "Comment obtenir le meilleur délai" },
      {
        type: "p",
        texte:
          "Donnez une date souhaitée dès la demande, même approximative, et indiquez les plages horaires possibles au départ comme à l'arrivée. Rassemblez les documents en amont. Communiquez un contact réellement joignable des deux côtés. Ces trois points suffisent à faire gagner une demi-journée sur la plupart des missions.",
      },
      {
        type: "p",
        texte:
          "Nous préférons annoncer un délai tenable plutôt qu'un délai flatteur. Quand une mission est réellement urgente, dites-le : nous vous dirons franchement si nous pouvons la tenir, et à quelles conditions.",
      },
    ],
  },
];

export function getArticle(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}

export function getRelated(slug: string, limit = 3): Article[] {
  const current = getArticle(slug);
  if (!current) return ARTICLES.slice(0, limit);
  const sameCat = ARTICLES.filter((a) => a.slug !== slug && a.categorie === current.categorie);
  const others = ARTICLES.filter((a) => a.slug !== slug && a.categorie !== current.categorie);
  return [...sameCat, ...others].slice(0, limit);
}
