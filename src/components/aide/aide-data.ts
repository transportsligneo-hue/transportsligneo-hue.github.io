import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  PlusCircle,
  Truck,
  FileText,
  MapPin,
  Gauge,
  FolderOpen,
  UserCog,
  Car,
  Users,
  ScanLine,
  Bell,
  CreditCard,
  LifeBuoy,
} from "lucide-react";

export type AideAudience = "client" | "pro";

export interface AideCategory {
  id: string;
  label: string;
  color: string; // classes badge
  icon: LucideIcon;
  items: { q: string; a: string }[];
}

const commonSuivi: AideCategory = {
  id: "suivi",
  label: "Suivi des missions",
  color: "bg-sky-500/10 text-sky-700 border-sky-500/25",
  icon: Truck,
  items: [
    {
      q: "Comment suivre mon véhicule en temps réel ?",
      a: "Ouvrez « Missions » puis la mission souhaitée : la carte affiche la position du convoyeur en direct, la progression du trajet et l'heure d'arrivée estimée. En vue planning, chaque mission affiche sa date, son heure et sa plaque d'immatriculation.",
    },
    {
      q: "Que signifient les types de mission (Livraison, Restitution, Recharge uniquement) ?",
      a: "« Livraison simple » : le véhicule vous est remis une seule fois. « Livraison + Restitution » : deux trajets liés dans le même dossier, la livraison (L) puis la restitution (R). « Recharge uniquement » : le véhicule est conduit à une borne de recharge puis restitué, sans autre déplacement.",
    },
    {
      q: "Comment lire les dossiers liés (L / R) ?",
      a: "Quand une mission comporte une livraison et une restitution, les deux trajets apparaissent regroupés sous le même numéro de dossier, la livraison (L) toujours affichée en premier, avec le montant total combiné.",
    },
    {
      q: "Pourquoi une mission affiche-t-elle un motif d'annulation ?",
      a: "Si une mission est annulée (client absent, véhicule indisponible…), le motif est indiqué directement sur la mission dans vos listes et plannings pour une traçabilité complète.",
    },
    {
      q: "Que faire si le signal GPS est indiqué « perdu » ?",
      a: "Le statut « signal perdu » s'affiche lorsque la position n'a pas été reçue depuis plus de 15 minutes (zone sans réseau, téléphone en veille…). Le suivi reprend automatiquement dès que le convoyeur retrouve du réseau. Aucune action n'est nécessaire de votre côté.",
    },
  ],
};

const commonDocs: AideCategory = {
  id: "docs",
  label: "Documents & signatures",
  color: "bg-amber-500/10 text-amber-700 border-amber-500/25",
  icon: FolderOpen,
  items: [
    {
      q: "Où retrouver mes documents (états des lieux, PV, fiches de mission) ?",
      a: "Tous les documents de vos missions — état des lieux départ et livraison, PV, fiche de mission — sont téléchargeables en PDF depuis la fiche mission et regroupés dans « Mes documents » / « Documents ».",
    },
    {
      q: "Comment se déroule la signature de l'état des lieux ?",
      a: "Au départ et à l'arrivée, le convoyeur réalise l'état des lieux avec photos sur son application, puis vous (ou la personne désignée) signez directement sur l'écran. Le document signé est horodaté et ajouté à la mission automatiquement.",
    },
    {
      q: "Puis-je corriger les coordonnées du contact sur place ?",
      a: "Oui. Sur chaque mission, vous pouvez renseigner le nom, le téléphone et l'email de la personne présente au départ et à la livraison. Ces informations sont transmises au convoyeur.",
    },
  ],
};

const commonBilling: AideCategory = {
  id: "billing",
  label: "Devis & facturation",
  color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/25",
  icon: CreditCard,
  items: [
    {
      q: "Où trouver mes devis et mes factures ?",
      a: "La rubrique « Factures & devis » regroupe tous vos documents financiers, en vue planning (groupés par jour, les plus récents en haut) ou en liste. Chaque ligne affiche le type de mission, la date, l'heure et la plaque du véhicule concerné.",
    },
    {
      q: "Comment accepter un devis ?",
      a: "Ouvrez le devis depuis « Factures & devis » ou depuis le lien reçu par email, vérifiez les détails puis signez électroniquement. La mission est alors programmée automatiquement.",
    },
    {
      q: "Comment payer une facture ?",
      a: "Chaque facture dispose d'un lien de paiement sécurisé (CB). Vous pouvez aussi la télécharger en PDF pour votre comptabilité. Le numéro de PO / bon de commande, lorsqu'il est renseigné, figure sur la facture.",
    },
  ],
};

const commonLoyalty: AideCategory = {
  id: "loyalty",
  label: "Compte Kilomètres",
  color: "bg-violet-500/10 text-violet-700 border-violet-500/25",
  icon: Gauge,
  items: [
    {
      q: "Comment fonctionne le Compte Kilomètres ?",
      a: "Chaque kilomètre parcouru sur vos missions crédite votre compte. Les kilomètres cumulés font monter votre palier et se transforment en avoirs utilisables sur vos prochaines prestations.",
    },
    {
      q: "Où voir mon solde et mon palier ?",
      a: "La rubrique « Compte Kilomètres » affiche votre solde actuel, votre palier, l'historique des gains et les avoirs disponibles.",
    },
  ],
};

const commonNotifs: AideCategory = {
  id: "notifs",
  label: "Notifications",
  color: "bg-rose-500/10 text-rose-700 border-rose-500/25",
  icon: Bell,
  items: [
    {
      q: "Quelles notifications vais-je recevoir ?",
      a: "Vous êtes informé à chaque étape clé : devis prêt, mission attribuée, convoyeur en route, véhicule récupéré, véhicule livré, facture disponible. Les alertes importantes apparaissent aussi dans la cloche de notification de votre espace.",
    },
    {
      q: "Puis-je choisir mes canaux de notification ?",
      a: "Oui, depuis « Mon profil » (ou « Ma société »), rubrique notifications : activez ou désactivez l'email et le SMS selon vos préférences.",
    },
  ],
};

export function getAideCategories(audience: AideAudience): AideCategory[] {
  if (audience === "pro") {
    return [
      {
        id: "demarrage",
        label: "Prise en main",
        color: "bg-blue-600/10 text-blue-700 border-blue-600/25",
        icon: LayoutDashboard,
        items: [
          {
            q: "Comment est organisé mon espace ?",
            a: "« Vue d'ensemble » résume vos missions en cours et vos indicateurs. « Missions » liste toutes vos demandes (vue planning par défaut, les plus récentes en haut). « Nouvelle mission » permet de créer une demande simple ou groupée. « Factures & devis » centralise vos documents financiers.",
          },
          {
            q: "Créer une demande de mission simple ou groupée : quelle différence ?",
            a: "La mission simple concerne un seul véhicule. La mission groupée permet de demander le transport de plusieurs véhicules en une seule fois : chaque véhicule génère son propre devis, téléchargeable immédiatement après validation, et l'ensemble reste regroupé dans votre suivi.",
          },
          {
            q: "Comment fonctionne le scan de document ?",
            a: "Dans le formulaire de demande, le bouton « Scanner » détecte automatiquement les contours de la carte grise ou de la feuille, recadre le document et pré-remplit la plaque, le VIN, la marque, le modèle, la couleur et l'énergie. Vérifiez simplement les champs avant de valider.",
          },
          {
            q: "Le devis instantané, comment ça marche ?",
            a: "Après validation de votre demande, le devis PDF est généré immédiatement : vous pouvez le visualiser, le télécharger ou créer directement une nouvelle demande. Il est classé automatiquement dans « Factures & devis » et synchronisé avec nos équipes.",
          },
        ],
      },
      {
        id: "flotte",
        label: "Parc & conducteurs",
        color: "bg-indigo-500/10 text-indigo-700 border-indigo-500/25",
        icon: Car,
        items: [
          {
            q: "Comment gérer mon parc de véhicules ?",
            a: "La rubrique « Parc véhicules » liste vos véhicules avec leur plaque, leur état et leur localisation. Vous pouvez ajouter, modifier ou retirer un véhicule à tout moment.",
          },
          {
            q: "Convoyeur ou conducteur : quelle différence ?",
            a: "Un « conducteur » est un salarié ou collaborateur de votre société, que vous gérez dans « Conducteurs » (ajout, retrait, permis, coordonnées, véhicules associés, historique des affectations). Un « convoyeur » est un prestataire du réseau Transports Ligneo qui réalise vos missions : il n'apparaît jamais dans vos conducteurs.",
          },
          {
            q: "Comment associer un véhicule à un conducteur ?",
            a: "Dans « Conducteurs », ouvrez la fiche du conducteur puis associez un ou plusieurs véhicules du parc. Chaque affectation et chaque retrait est conservé dans l'historique.",
          },
          {
            q: "Mon organisation a plusieurs sites : comment les gérer ?",
            a: "Si votre organisation regroupe plusieurs agences (par exemple plusieurs villes), un sélecteur de site apparaît automatiquement en haut des listes : véhicules, missions et conducteurs sont alors filtrables par site. Avec un seul site, rien ne change dans votre interface.",
          },
        ],
      },
      commonSuivi,
      commonDocs,
      {
        id: "adresses",
        label: "Adresses favorites",
        color: "bg-cyan-500/10 text-cyan-700 border-cyan-500/25",
        icon: MapPin,
        items: [
          {
            q: "À quoi servent les adresses enregistrées ?",
            a: "« Mes adresses » mémorise vos points de départ et de livraison récurrents (dépôts, concessions, agences). Elles sont proposées automatiquement dans vos nouvelles demandes pour gagner du temps et éviter les erreurs de saisie.",
          },
        ],
      },
      commonBilling,
      commonLoyalty,
      commonNotifs,
      {
        id: "compte",
        label: "Compte & société",
        color: "bg-slate-500/10 text-slate-700 border-slate-500/25",
        icon: UserCog,
        items: [
          {
            q: "Comment modifier les informations de ma société ?",
            a: "Dans « Ma société », mettez à jour la raison sociale, l'adresse, le SIRET et les coordonnées de facturation. Ces informations sont reprises sur vos devis et factures.",
          },
          {
            q: "Comment brancher vos outils via l'API ?",
            a: "La rubrique « API & Intégrations » vous permet de générer des clés API et de recevoir des notifications automatiques (webhooks) sur les événements de vos missions : création, départ, livraison, facturation.",
          },
        ],
      },
    ];
  }

  // Espace client (particulier)
  return [
    {
      id: "demarrage",
      label: "Prise en main",
      color: "bg-blue-600/10 text-blue-700 border-blue-600/25",
      icon: LayoutDashboard,
      items: [
        {
          q: "Comment est organisé mon espace ?",
          a: "« Vue d'ensemble » affiche vos missions en cours et vos prochains rendez-vous. « Mes missions » liste tous vos transports en vue planning (les plus récents en haut). « Nouvelle réservation » permet de demander un transport en quelques minutes. « Factures & devis » regroupe vos documents.",
        },
        {
          q: "Comment réserver le transport de mon véhicule ?",
          a: "Cliquez sur « Nouvelle réservation », indiquez les adresses de départ et d'arrivée, le véhicule (marque, modèle, plaque) et vos disponibilités. Vous recevez un devis à signer électroniquement, puis la mission est programmée.",
        },
        {
          q: "Comment fonctionne le scan de ma carte grise ?",
          a: "Lors de la réservation, le bouton « Scanner » détecte automatiquement les contours du document, le recadre et pré-remplit la plaque, le VIN, la marque, le modèle, la couleur et l'énergie. Vous n'avez plus qu'à vérifier.",
        },
        {
          q: "Puis-je ajouter une option (lavage, recharge, remise en main) ?",
          a: "Oui, dans le formulaire de réservation, la section « Options » propose notamment la recharge électrique, le lavage et la remise en main propre avec clés et documents. Le prix est recalculé en direct.",
        },
      ],
    },
    commonSuivi,
    commonDocs,
    {
      id: "adresses",
      label: "Adresses favorites",
      color: "bg-cyan-500/10 text-cyan-700 border-cyan-500/25",
      icon: MapPin,
      items: [
        {
          q: "À quoi servent mes adresses enregistrées ?",
          a: "« Mes adresses » mémorise vos lieux habituels (domicile, garage, travail). Elles sont proposées automatiquement lors de vos réservations pour aller plus vite.",
        },
      ],
    },
    commonBilling,
    commonLoyalty,
    commonNotifs,
    {
      id: "compte",
      label: "Mon profil",
      color: "bg-slate-500/10 text-slate-700 border-slate-500/25",
      icon: UserCog,
      items: [
        {
          q: "Comment modifier mes coordonnées ?",
          a: "Dans « Mon profil », mettez à jour votre nom, téléphone, email et adresse. Les convoyeurs utilisent ces informations pour vous contacter le jour de la mission.",
        },
        {
          q: "Comment modifier mon mot de passe ?",
          a: "Depuis « Mon profil », rubrique sécurité. Si vous l'avez oublié, utilisez « Mot de passe oublié » sur la page de connexion.",
        },
      ],
    },
  ];
}

export const aideHero = {
  client: {
    eyebrow: "Centre d'aide",
    title: "Tout savoir sur",
    highlight: "votre espace",
    subtitle:
      "Réservez, suivez vos véhicules, signez vos documents et gérez vos factures : retrouvez ici le mode d'emploi de chaque outil.",
  },
  pro: {
    eyebrow: "Centre d'aide",
    title: "Tout savoir sur",
    highlight: "votre espace",
    subtitle:
      "Demandes de missions, parc, conducteurs, suivi temps réel, facturation : le mode d'emploi complet de vos outils Transports Ligneo.",
  },
};

export const aideToolsClient = [
  { icon: PlusCircle, label: "Nouvelle réservation" },
  { icon: Truck, label: "Suivi en temps réel" },
  { icon: ScanLine, label: "Scan de carte grise" },
  { icon: FileText, label: "Factures & devis" },
  { icon: Gauge, label: "Compte Kilomètres" },
  { icon: FolderOpen, label: "Documents PDF" },
  { icon: MapPin, label: "Adresses favorites" },
  { icon: Bell, label: "Notifications" },
];

export const aideToolsPro = [
  { icon: PlusCircle, label: "Missions simples & groupées" },
  { icon: Truck, label: "Suivi GPS temps réel" },
  { icon: ScanLine, label: "Scan de carte grise" },
  { icon: Car, label: "Parc véhicules" },
  { icon: Users, label: "Conducteurs" },
  { icon: FileText, label: "Factures & devis" },
  { icon: Gauge, label: "Compte Kilomètres" },
  { icon: LifeBuoy, label: "API & intégrations" },
];
