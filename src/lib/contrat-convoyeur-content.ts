/**
 * Contrat permanent de convoyage · texte contractuel Transports Ligneo.
 * Les thèmes couverts sont ceux d'un contrat de convoyage professionnel complet ;
 * la rédaction, le vocabulaire et l'ordre des idées sont propres à Transports Ligneo.
 * Les montants (franchise, frais d'annulation) sont regroupés dans CONTRAT_MONTANTS
 * pour être ajustés en un seul endroit.
 */
import type { CompanyInfo } from "@/lib/doc-branding";

export const CONTRAT_MONTANTS = {
  franchiseParticulier: { chiffres: "1 300 €", lettres: "mille trois cents euros" },
  franchiseUtilitaire: { chiffres: "2 000 €", lettres: "deux mille euros" },
  annulationPrestataireParticulier: "25 €",
  annulationPrestataireUtilitaire: "40 €",
  penaliteVeille: "50 %",
  penaliteJourJ: "100 %",
  indemniteLigneoVeille: "50 %",
  indemniteLigneoJourJ: "70 %",
} as const;

export type ContratItem = string | { t: string; sub: string[] };
export type ContratBloc =
  | { p: string }
  | { ul: ContratItem[] }
  | { h3: string; ref: string };

export interface ContratSection {
  id: string;
  title: string;
  blocs: ContratBloc[];
}

export const CONTRAT_NOM = "TRANSPORTS LIGNEO";

export function buildContratPreambule(c?: CompanyInfo | null): { entre: string; rappel: string[]; droits: string[] } {
  const forme = c?.forme_juridique?.trim() || "entreprise individuelle";
  const adresse = [c?.adresse_ligne1, [c?.adresse_cp, c?.adresse_ville].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  const siren = (c?.siret || "753 320 001").replace(/\s/g, "").slice(0, 9).replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3");
  const ville = c?.adresse_ville || "Tours";
  const signataire = c?.signataire_nom || "Olivier Gourlaouen";
  const fonction = c?.signataire_fonction || "Fondateur et dirigeant";
  const capital = c?.capital_social ? `, au capital de ${c.capital_social}` : "";
  return {
    entre:
      `**${CONTRAT_NOM}**, ${forme}${capital}, inscrite sous le numéro SIREN ${siren} (RCS ${ville})` +
      `${adresse ? `, établie au ${adresse}` : `, établie à ${ville} (37), France`}. ` +
      `Elle agit par l'intermédiaire de Monsieur ${signataire}, ${fonction},`,
    rappel: [
      `${CONTRAT_NOM} propose un service de convoyage et de logistique automobile à une clientèle de particuliers et d'entreprises. ` +
        `Pour réaliser ces missions, elle fait appel à des conducteurs professionnels indépendants, dans le cadre du présent contrat-cadre de prestation de services de convoyage (ci-après le « Contrat »).`,
      `Le PRESTATAIRE intervient en qualité de travailleur indépendant (entrepreneur individuel, micro-entrepreneur ou dirigeant de société), immatriculé sous son propre numéro SIRET, à ses risques, avec ses propres moyens, et sans aucun lien de subordination avec ${CONTRAT_NOM}. Le Contrat est un contrat de prestation de services entre professionnels : il n'est ni un contrat de travail, ni un contrat d'agent commercial ou de mandat.`,
      `Par application de l'article L. 7341-1 du Code du travail, ${CONTRAT_NOM} garantit au PRESTATAIRE les droits suivants :`,
    ],
    droits: [
      "suivre une formation gratuite, sanctionnée par une attestation ;",
      "connaître en toute clarté les règles d'attribution des missions ainsi que les tarifs pratiqués ;",
      "disposer d'une voie de recours en cas de désaccord ;",
      "voir ses données personnelles protégées conformément au RGPD.",
    ],
  };
}

export function buildContratSections(c?: CompanyInfo | null): ContratSection[] {
  const N = CONTRAT_NOM;
  const M = CONTRAT_MONTANTS;
  const mail = c?.email_contact || "contact@transportsligneo.fr";
  const ville = c?.adresse_ville || "Tours";
  return [
    {
      id: "A",
      title: "CONDITIONS PRÉALABLES",
      blocs: [
        { p: "Avant toute mission, le PRESTATAIRE doit réunir l'ensemble des conditions ci-dessous. À défaut, le Contrat ne peut pas prendre effet :" },
        {
          ul: [
            "être immatriculé comme travailleur indépendant (numéro SIRET actif, Kbis ou avis de situation INSEE à l'appui) et le rester pendant toute la durée du Contrat ;",
            "remettre, à la signature puis tous les six (6) mois, l'attestation de vigilance de l'URSSAF (articles L. 8222-1 et D. 8222-5 du Code du travail) ;",
            "détenir un permis de catégorie B valide, obtenu dans un État de l'Union européenne depuis au moins cinq (5) ans, et s'assurer qu'il en va de même pour tout conducteur qu'il se substituerait dans les conditions de la section K ;",
            "n'avoir fait l'objet d'aucun retrait ni d'aucune suspension de permis, et contrôler qu'aucun de ses éventuels remplaçants n'est dans ce cas ;",
            `prendre connaissance des modules d'information de l'application ${N} Driver (vidéos, supports et quiz) sur les règles de sécurité et les procédures d'état des lieux, et les transmettre à ses éventuels remplaçants. L'accès à ces modules est gratuit et n'emporte aucune obligation de suivre des horaires ou des méthodes de travail.`,
          ],
        },
        { p: `${N} remet au PRESTATAIRE une attestation de formation, comme le prévoit l'article L. 6353-1 du Code du travail.` },
        { p: "Le PRESTATAIRE certifie par ailleurs, toujours sous peine de nullité, que lui-même et ses éventuels remplaçants :" },
        {
          ul: [
            "conservent au minimum six (6) points sur leur permis ;",
            "présentent un coefficient bonus-malus d'assurance automobile situé entre 0,50 et 1 ;",
            "n'ont pas été à l'origine de plus d'un (1) sinistre automobile avec leur responsabilité engagée, avec ou sans tiers (dommages, vol, incendie, bris de glace compris) durant les trois (3) dernières années ;",
            "n'ont subi aucune condamnation pour conduite sous l'emprise de l'alcool ou de stupéfiants durant les cinq (5) dernières années ;",
            "peuvent produire un bulletin n° 3 du casier judiciaire sans mention.",
          ],
        },
      ],
    },
    {
      id: "B",
      title: "DÉROULEMENT DES MISSIONS",
      blocs: [
        { h3: "Contenu de la mission", ref: "B 1." },
        { p: "Suivant ce qu'indique la fiche de chaque mission, le PRESTATAIRE est amené à :" },
        {
          ul: [
            `rejoindre le lieu d'enlèvement indiqué sur la fiche de mission, y retirer les clés et les papiers du véhicule ;`,
            `dresser l'état des lieux du véhicule selon la procédure de preuve exigée par le client et l'assureur ;`,
            "conduire le véhicule du point A au point B, soit par la route, soit par camion porte-voitures ; dans cette seconde hypothèse, il doit justifier d'une assurance « véhicules transportés » à hauteur de la valeur des véhicules qui lui sont confiés ;",
            `si la mission le prévoit, reprendre un véhicule au point B pour le déposer sur un parc ou à tout autre endroit désigné par ${N} ;`,
            "si la mission le prévoit, effectuer en plus un nettoyage, un plein de carburant ou une recharge, une mise en main, etc. ;",
            "si la mission le prévoit, patienter au point B puis repartir avec le véhicule, soit vers le point A, soit vers un point C.",
          ],
        },
        { h3: "Communication des missions", ref: "B 2." },
        { p: `Les missions sont portées à la connaissance du PRESTATAIRE par l'application mobile de ${N}. Chaque annonce précise en particulier :` },
        {
          ul: [
            "le lieu où prendre le véhicule, la date et, selon le cas, le créneau horaire ;",
            "le lieu où le livrer, la date et, selon le cas, le créneau horaire ;",
            { t: "les prestations complémentaires éventuelles (liste non exhaustive), par exemple :", sub: ["le lavage du véhicule,", "le plein de carburant ou la recharge,", "la mise en main au client ;"] },
            "les formations exigées pour accomplir la mission ;",
            "la date et l'heure butoirs pour se positionner ou accepter la mission ;",
            `le prix de la prestation : un prix affiché, que le PRESTATAIRE accepte ou refuse sans le modifier ; ou, lorsque la mission est proposée par enchères, un prix que le PRESTATAIRE peut proposer lui-même dans les conditions indiquées sur l'annonce.`,
          ],
        },
        { p: `Le PRESTATAIRE est libre d'accepter ou de refuser chaque mission, sans avoir à se justifier, sans pénalité et sans conséquence sur les missions qui pourraient lui être proposées ensuite. ${N} ne lui garantit aucun volume de missions, ne lui impose ni minimum de missions, ni disponibilité, ni horaires, ni exclusivité.` },
        { h3: "Réalisation des missions", ref: "B 3." },
        { p: `Le PRESTATAIRE exécute chaque mission qu'il a acceptée avec tout le soin attendu d'un professionnel. Il organise librement son travail : itinéraire, heure de départ à l'intérieur du créneau, pauses et moyens de transport. ${N} ne contrôle que le résultat, c'est-à-dire la conformité de la prestation à la fiche de mission et aux demandes du client, et non la manière dont le PRESTATAIRE s'organise.` },
        { p: `Avant le démarrage de chaque mission, ${N} met à sa disposition une fiche détaillée indiquant :` },
        { ul: ["les coordonnées du client et les caractéristiques du véhicule ;", "les prestations complémentaires commandées ;", "le prix et les règles de remboursement des frais."] },
        { p: "Du début à la fin de la mission, le véhicule est placé sous la garde du PRESTATAIRE, qui répond de sa conservation dans les conditions des sections D et E." },
        { p: `${N} n'impose au PRESTATAIRE ni uniforme, ni logo, ni signe distinctif. Toutefois, comme il est en contact direct avec les clients, le PRESTATAIRE se présente en tenue correcte et propre, conforme aux usages d'un métier de service : les survêtements, tenues de sport, tenues déchirées ou sales sont à proscrire. Il adopte également un comportement courtois et professionnel.` },
        { p: "Le conducteur de la mission doit toujours avoir avec lui :" },
        {
          ul: [
            "sa pièce d'identité et son permis de conduire en cours de validité ;",
            "l'attestation d'assurance du véhicule et une copie de la carte grise, pour pouvoir répondre à un contrôle des forces de l'ordre.",
          ],
        },
        { h3: "Obligations et interdits", ref: "B 4." },
        { p: "Dans l'intérêt du client, de la sécurité et de la conformité de la prestation, le PRESTATAIRE s'engage sur les points suivants :" },
        {
          ul: [
            { t: "le véhicule sert uniquement à la mission de convoyage ou de conciergerie. Sont donc exclus :", sub: ["le transport de personnes ou de biens, gratuit ou payant ;", "tout usage personnel ;", "toute activité professionnelle sans rapport direct avec la mission ;"] },
            "seuls le PRESTATAIRE, ou le remplaçant qu'il s'est substitué conformément à la section K, conduisent le véhicule.",
          ],
        },
        { p: "Il est formellement interdit de conduire après avoir consommé de l'alcool, des stupéfiants ou des substances psychotropes." },
        { p: "Le véhicule reste sur les voies ouvertes à la circulation publique." },
        { p: "Il est interdit de fumer dans le véhicule, et les animaux n'y sont pas acceptés." },
        { p: "À la livraison, le véhicule doit se trouver dans l'état exact constaté lors de l'enlèvement : aucun dommage, aucun élément manquant." },
        { p: "La propreté, à l'intérieur comme à l'extérieur, doit également être identique à celle de l'enlèvement ; si un nettoyage a été commandé, le véhicule doit être rendu parfaitement propre." },
        { p: `Si l'un de ces engagements n'est pas respecté, ${N} en informe le PRESTATAIRE par écrit, lui permet de présenter ses observations, puis applique la section G.` },
        { p: "Les infractions commises par le PRESTATAIRE ou ses remplaçants, routières ou autres, restent à sa seule charge, avec toutes leurs conséquences." },
        { p: `Dès qu'il reçoit un avis d'infraction, le PRESTATAIRE en informe aussitôt ${N}. Lorsque ${N} avance des sommes à ce titre, le PRESTATAIRE les lui rembourse sans attendre.` },
        { p: "Le PRESTATAIRE n'a le droit ni de céder ou sous-louer le véhicule, ni d'y concéder ou laisser naître un droit au profit d'un tiers." },
        { p: `Le PRESTATAIRE informe sans délai ${N} et le client de tout retard ou incident. Pour la preuve de la prestation et le suivi demandé par le client, la position du véhicule est partagée avec ${N} pendant la seule durée de la mission, de l'enlèvement à la livraison. Aucune géolocalisation n'est exercée en dehors des missions.` },
        { p: `Dans les douze (12) heures qui suivent la remise du véhicule, le PRESTATAIRE adresse à ${N}, par voie électronique, tous les documents de la mission : états des lieux, procès-verbal de livraison et procès-verbal de restitution.` },
      ],
    },
    {
      id: "C",
      title: "PRIX, FACTURATION ET FRAIS",
      blocs: [
        { p: `Le prix de chaque prestation est celui convenu avec le PRESTATAIRE avant son acceptation de la mission. Par le présent Contrat, le PRESTATAIRE donne mandat à ${N} d'établir ses factures en son nom et pour son compte (auto-facturation, article 289, I-2 du Code général des impôts). ${N} génère automatiquement, pour chaque règlement, une auto-facture numérotée qui détaille chaque mission et chaque montant, et la met à disposition du PRESTATAIRE dans son espace. Le PRESTATAIRE n'a aucune facture à envoyer. Il dispose de sept (7) jours pour contester une auto-facture par écrit ; à défaut, elle est réputée acceptée. Il peut mettre fin à ce mandat à tout moment en résiliant le Contrat. Il reste seul responsable de ses déclarations et de ses cotisations fiscales et sociales (URSSAF, TVA le cas échéant).` },
        { h3: "Paiement du prix", ref: "C.1." },
        { p: "Le prix est payé une fois la mission accomplie, à condition d'avoir remis :" },
        { ul: ["l'état des lieux numérique ;", "le procès-verbal de livraison ou de restitution, si la mission l'exige."] },
        { h3: "Prise en charge des frais", ref: "C.2." },
        { p: "Le prix couvre la prestation dans son ensemble, frais compris (le PRESTATAIRE supporte ses propres frais de déplacement et de retour)." },
        { p: "Parmi ces frais, seul le carburant peut être remboursé, si la mission porte la mention « carburant remboursé » et que le PRESTATAIRE joint les justificatifs :" },
        {
          ul: [
            "en fin de mission et au plus tard sous cinq (5) jours ouvrés, depuis l'application ;",
            `sauf si, face à une difficulté technique, ${N} accorde un délai supplémentaire sur demande motivée du PRESTATAIRE.`,
          ],
        },
        { h3: "Règlement", ref: "C.3." },
        { p: "Le règlement s'effectue par virement bancaire, tous les quinze (15) jours, selon le calendrier affiché dans l'application." },
        { p: "Le PRESTATAIRE saisit son RIB dans son espace partenaire de la plateforme." },
        { p: "Point d'attention :" },
        { p: `Seuls les factures et tickets d'origine, établis par des tiers, valent justificatifs. Ils doivent porter le nom de la société (${N}) ; tout justificatif qui ne le mentionne pas est refusé.` },
      ],
    },
    {
      id: "D",
      title: "ASSURANCE DU VÉHICULE CONVOYÉ",
      blocs: [
        { p: `${N} traite les sinistres éventuels avec son assureur, selon la démarche indiquée dans l'application.` },
        { p: `Si un tiers est impliqué, le PRESTATAIRE établit autant que possible un constat amiable avec lui et l'envoie par voie électronique dans les vingt-quatre (24) heures, via l'application ou à ${mail}.` },
        { p: "Lorsqu'un constat amiable n'est pas réalisable, le PRESTATAIRE rédige dans le même délai, par les mêmes moyens, une déclaration détaillée des circonstances." },
        { p: "Si la responsabilité du PRESTATAIRE est engagée, ou si aucun tiers responsable n'est identifié :" },
        {
          ul: [
            `le PRESTATAIRE supporte une partie de la franchise : ${M.franchiseParticulier.lettres} (${M.franchiseParticulier.chiffres}) pour un véhicule de tourisme, ${M.franchiseUtilitaire.lettres} (${M.franchiseUtilitaire.chiffres}) pour un utilitaire. Ces sommes sont réexaminées chaque année selon la sinistralité ;`,
            "un sinistre met en attente le paiement de la mission concernée, qui est versé dès que l'assureur a indemnisé le client.",
          ],
        },
      ],
    },
    {
      id: "E",
      title: "RESPONSABILITÉ CIVILE PROFESSIONNELLE",
      blocs: [
        { p: `Le PRESTATAIRE souscrit et maintient en vigueur une assurance de responsabilité civile professionnelle adaptée à son métier de convoyeur, conformément aux pratiques du secteur, pour pouvoir intervenir pour le compte de ${N}.` },
        { p: `Il doit être en mesure d'en justifier, avant chaque mission, auprès de ${N} ou de son représentant.` },
      ],
    },
    {
      id: "F",
      title: "ANNULATION D'UNE MISSION",
      blocs: [
        { p: "Les indemnités ci-dessous sont forfaitaires et réciproques. Elles constituent une clause pénale que le juge peut modérer (article 1231-5 du Code civil). Une annulation n'entraîne aucune autre sanction, ni réduction des missions proposées ensuite." },
        { h3: "Si le PRESTATAIRE annule :", ref: "F.1." },
        {
          ul: [
            `plus de 48 h avant : indemnité forfaitaire de ${M.annulationPrestataireParticulier} pour un véhicule de tourisme, ${M.annulationPrestataireUtilitaire} pour un utilitaire, sauf cas de force majeure (maladie, accident) attesté par certificat médical ;`,
            `la veille : indemnité forfaitaire de ${M.penaliteVeille} du prix de la prestation, sauf force majeure (maladie, accident) attestée par certificat médical ;`,
            `le jour même : indemnité forfaitaire de ${M.penaliteJourJ} du prix de la prestation, sauf force majeure (maladie, accident) attestée par certificat médical.`,
          ],
        },
        { h3: `Si ${N} annule :`, ref: "F.2." },
        {
          ul: [
            "plus de 48 h avant : aucune indemnité ;",
            `la veille : le PRESTATAIRE reçoit une indemnité égale à ${M.indemniteLigneoVeille} du prix de la prestation ;`,
            `le jour même : le PRESTATAIRE reçoit une indemnité égale à ${M.indemniteLigneoJourJ} du prix de la prestation.`,
          ],
        },
      ],
    },
    {
      id: "G",
      title: "INEXÉCUTION ET RESPONSABILITÉ",
      blocs: [
        { p: "En cas d'inexécution ou de mauvaise exécution d'une mission, chaque Partie engage sa responsabilité contractuelle de droit commun." },
        { p: `${N} notifie le manquement par écrit et laisse au PRESTATAIRE sept (7) jours pour présenter ses observations ou y remédier. À défaut, elle peut réduire ou refuser le paiement de la seule mission non conforme, à proportion du préjudice justifié, ou mettre fin au Contrat selon la section I.` },
        { p: "Le Contrat ne prévoit aucune sanction disciplinaire, aucune retenue forfaitaire et aucun barème de sanctions : seuls les dommages réellement subis et justifiés peuvent être réclamés." },
      ],
    },
    {
      id: "H",
      title: "DURÉE ET SUSPENSION",
      blocs: [
        { h3: "Durée", ref: "H.1." },
        { p: "Le Contrat est un contrat-cadre conclu sans limite de durée. Il ne garantit aucun volume de missions : chaque mission acceptée par le PRESTATAIRE forme une prestation distincte." },
        { p: "Il prend effet à la signature par les deux Parties. Aucune mission n'est confiée avant cette signature." },
        { h3: "Suspension", ref: "H.2." },
        { p: `En cas de faute grave du PRESTATAIRE, ${N} peut cesser temporairement de lui proposer des missions, après :` },
        { ul: ["une mise en demeure écrite ;", "un délai de sept (7) jours pour corriger la situation ;", "une décision écrite et motivée, contestable devant un médiateur indépendant."] },
      ],
    },
    {
      id: "I",
      title: "FIN DU CONTRAT",
      blocs: [
        { p: "Chaque Partie peut mettre fin au Contrat à tout moment, sans avoir à se justifier, par e-mail ou par lettre recommandée avec accusé de réception." },
        { ul: ["avec un préavis de quinze (15) jours lorsque le Contrat court depuis moins de six (6) mois ;", "avec un préavis d'un (1) mois lorsqu'il court depuis plus de six (6) mois."] },
        { p: "En cas de manquement grave, la Partie lésée peut résilier le Contrat sans préavis, après une mise en demeure restée sans effet pendant sept (7) jours." },
        { p: "La fin du Contrat ne fait pas obstacle à une demande de dommages et intérêts." },
      ],
    },
    {
      id: "J",
      title: "CONFIDENTIALITÉ",
      blocs: [
        { p: "Le PRESTATAIRE s'interdit de révéler les informations, documents et données strictement confidentiels qu'il découvre à l'occasion du Contrat ou de son exécution." },
        { p: `En retour, ${N} s'engage envers le PRESTATAIRE à :` },
        { ul: ["respecter le RGPD (accès, rectification, effacement) ;", "ne collecter que les données utiles ;", "effacer ses données une fois le Contrat terminé, sauf obligation légale de les garder."] },
      ],
    },
    {
      id: "K",
      title: "SOUS-TRAITANCE",
      blocs: [{ p: `Le PRESTATAIRE peut se faire remplacer, ou sous-traiter tout ou partie d'une mission, par un autre professionnel indépendant ou par un salarié de sa propre entreprise, à condition que ce remplaçant remplisse les conditions de la section A. Il en informe ${N} par écrit avant la mission ; ${N} ne peut s'y opposer que si ces conditions ne sont pas remplies. Le PRESTATAIRE reste responsable de l'exécution de la mission et de son remplaçant.` }],
    },
    {
      id: "L",
      title: "AMENDES ET CONTRAVENTIONS",
      blocs: [{ p: "Toute infraction au code de la route, avec les amendes et contraventions qui s'ensuivent, incombe uniquement au PRESTATAIRE." }],
    },
    {
      id: "M",
      title: "PROTECTION DES DONNÉES",
      blocs: [
        { p: "Chacune des Parties respecte la réglementation sur les données à caractère personnel (les « Données ») auxquelles l'exécution du Contrat lui donne accès." },
        { p: "Elle traite ces Données dans le respect des principes posés par la loi et les règlements en vigueur, ainsi que des obligations qui lui sont propres." },
        { p: "Chaque Partie s'oblige à :" },
        {
          ul: [
            "n'exploiter, copier et communiquer les Données que pour exécuter le Contrat, remplir une obligation légale, exercer un droit prévu par la loi (par exemple la défense en justice) ou servir l'intérêt légitime des responsables de traitement ou de leurs destinataires, sans porter atteinte aux droits et libertés des personnes concernées ;",
            "prendre les mesures techniques et d'organisation nécessaires pour garantir une sécurité proportionnée aux risques, et en particulier éviter que les Données soient altérées, détournées, utilisées frauduleusement, endommagées ou transmises à des personnes non habilitées ;",
            "obtenir de toute personne qu'elle autorise à traiter les Données un engagement de confidentialité ;",
            "collaborer, autant que possible, avec l'autre Partie pour assurer le respect de la réglementation ;",
            "garder les Données seulement le temps requis par les finalités du Contrat, sauf obligation ou prérogative légale imposant une conservation plus longue.",
          ],
        },
      ],
    },
    {
      id: "N",
      title: "INDÉPENDANCE DES PARTIES",
      blocs: [
        {
          ul: [
            "Les Parties reconnaissent être et rester des partenaires professionnels indépendants, chacune assumant les risques de sa propre activité.",
            "Quelle que soit la stipulation du Contrat, aucune Partie ne peut engager l'autre, ni la lier par les accords qu'elle passerait avec des tiers. Rien dans le Contrat n'autorise une Partie à agir au nom ou pour le compte de l'autre, ni ne crée entre elles un mandat ou une association d'intérêts. Le Contrat ne donne naissance ni à une filiale ni à une entreprise commune.",
            "Chaque Partie supporte donc seule les suites de sa propre activité et des opérations pour lesquelles elle a sollicité l'aide de l'autre ; elle ne peut ni reporter ses pertes sur l'autre, ni être tenue de lui céder une part de ses gains.",
            `Dans le respect du Contrat, le PRESTATAIRE organise librement son activité, sans lien de subordination ni de représentation sous quelque forme que ce soit. Il peut travailler pour d'autres entreprises que ${N}, y compris concurrentes, tant qu'il honore les missions qu'il a acceptées. Aucune exclusivité ne lui est demandée.`,
            `Le PRESTATAIRE est immatriculé à son propre compte, utilise ses propres moyens (téléphone, équipement, titres de transport, assurances), fixe librement ses jours et ses horaires de travail, supporte ses propres frais et déclare lui-même ses revenus. Il est seul redevable de ses cotisations fiscales et sociales.`,
            `${N} n'exerce à l'égard du PRESTATAIRE aucun pouvoir de direction, de contrôle de l'organisation de son travail ni de sanction disciplinaire. Elle ne verse ni salaire, ni congés payés, ni prime, et ne lui fournit aucun outil de travail autre que l'accès à l'application de mise en relation. Les Parties reconnaissent que la présomption de non-salariat de l'article L. 8221-6 du Code du travail s'applique au PRESTATAIRE.`,
          ],
        },
      ],
    },
    {
      id: "O",
      title: "EFFET DE L'ANNULATION D'UNE CLAUSE",
      blocs: [
        { p: "Si une ou plusieurs clauses du Contrat sont annulées, par le juge ou d'un commun accord, les autres demeurent applicables dans leur totalité, pour autant que l'équilibre général du Contrat soit préservé." },
        { p: "Lorsque l'application d'une clause devient impossible à la suite de son annulation, les Parties cherchent à s'entendre sur une clause de remplacement, la plus proche possible de l'originale par son esprit et sa lettre ; le reste du Contrat continue de s'appliquer." },
        { p: "À défaut d'accord, ou si l'équilibre du Contrat est profondément modifié, les Parties peuvent, d'un commun accord écrit, constater l'annulation de l'ensemble du Contrat." },
      ],
    },
    {
      id: "P",
      title: "DIVISIBILITÉ ET TOLÉRANCE",
      blocs: [
        { p: "La nullité, la caducité ou l'inopposabilité d'une stipulation n'affecte pas les autres, qui restent pleinement applicables et s'interprètent de manière à respecter ce que les Parties voulaient à l'origine." },
        { p: "Qu'une Partie n'invoque pas une stipulation à un moment donné ne signifie pas qu'elle renonce à l'invoquer plus tard." },
      ],
    },
    {
      id: "Q",
      title: "LOI APPLICABLE ET TRIBUNAUX COMPÉTENTS",
      blocs: [
        { p: "Le Contrat est régi par le droit français." },
        { p: "Pour tout litige sur son interprétation ou son exécution, les Parties tentent d'abord de parvenir à un accord amiable avant d'agir en justice." },
        { p: `À défaut d'accord, seuls les tribunaux du ressort de ${ville} sont compétents.` },
      ],
    },
    {
      id: "R",
      title: "DOMICILE CHOISI",
      blocs: [
        { p: "Pour l'exécution du Contrat, chaque Partie élit domicile à son siège ou à son adresse habituelle." },
        { p: "Tout changement d'adresse doit être notifié à l'autre Partie par lettre recommandée avec avis de réception pour lui être opposable." },
      ],
    },
  ];
}

export function buildContratSignatureSection(): { title: string; paragraphes: string[] } {
  const N = CONTRAT_NOM;
  return {
    title: "SIGNATURE",
    paragraphes: [
      "Le PRESTATAIRE choisit de signer le Contrat sur papier ou par voie électronique. La signature électronique respecte les articles 1366 et 1367 du Code civil : elle s'effectue avec l'outil mis à disposition par " +
        `${N}, qui identifie le signataire puis le valide grâce à un code à usage unique envoyé par SMS ou par e-mail aux coordonnées déclarées par le PRESTATAIRE.`,
      "Dans le cas d'une signature électronique, chaque Partie reconnaît avoir été informée des conditions d'usage de ce procédé et l'employer en toute connaissance. Elle s'interdit en conséquence de contester la fiabilité de la signature, ou sa volonté de conclure le Contrat, au seul motif du procédé utilisé.",
      `Toujours en cas de signature électronique, et en application de l'article 1375 du Code civil, il n'est pas nécessaire de remettre un original papier à chaque Partie pour établir les engagements pris. L'exemplaire électronique conservé par ${N} et accessible au PRESTATAIRE fait foi. Un dossier de preuve (horodatage, adresse IP, consentement, empreinte numérique du document) est conservé et remis au PRESTATAIRE sur simple demande.`,
    ],
  };
}
