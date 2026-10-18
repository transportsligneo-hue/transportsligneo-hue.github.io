# Roadmap
- [x] Vroomy : bouton et en-tête animés ; images originales intactes, regard, ouverture/fermeture, Échap et réduction des animations vérifiés sur ordinateur et téléphone, sans erreur JavaScript. Logique du chat inchangée.
- [x] Migration externe : audit local et procédure sûre v2 livrés ; 421 migrations principales et 50 Drizzle inventoriées avec SHA-256, ancien SQL consolidé signalé non validé. Aucun transfert ni changement de connexion.
- [ ] Migration externe : obtenir export officiel de la base et fichiers Storage ; disponibilité Lovable Cloud et accès au projet cible non confirmés. Import, validation et bascule nécessitent une nouvelle autorisation.
- [x] Priorité : numéro de PO en gros dans l’en-tête des factures, récupération en lecture seule du PO facture/trajet/commande liée. Sept tests réussis ; facture CAT fictive contrôlée visuellement sur une page. Téléchargement réel connecté non vérifié.
- [x] Signature et tampon officiels harmonisés via la composition de référence de la facture : devis, factures, bons de commande, mandats, passages à vide, contrats et chartes. Sept PDF générés et contrôlés ; signatures personnelles et originaux signés préservés. Vérification depuis une mission connectée toujours soumise au SMS ci-dessous.
- [x] Plaques harmonisées avec le modèle fourni ; reprise des plaques manquantes en lecture seule et options Recharge électrique/Mise en main uniquement si sélectionnées. Tests et huit PDF contrôlés ; vérification depuis une vraie mission admin toujours bloquée par le SMS.
- [x] Devis, bons de commande et factures : présentation des trois modèles fournis reprise dans les générateurs partagés, auto-remplissage conservé, mentions démo uniquement en démonstration ; versions réelles et démo contrôlées, taxes et signatures préservées. Chevauchement plaque/description facture et espacement légal corrigés. Test depuis les écrans connectés toujours bloqué par le code SMS.
- [x] PV livraison/restitution : deux modèles vectoriels fournis raccordés au remplissage automatique dans tous les espaces, mentions démo uniquement en démonstration ; libellé « restitution et livraison » harmonisé. Quatre PDF contrôlés ; villes résiduelles et position du bandeau démo corrigées.
- [ ] Vérifier le téléchargement des nouveaux PV depuis une vraie mission dans l’admin : la session de test est arrêtée par la vérification SMS, impossible de poursuivre sans validation utilisateur.
- [x] Démo pro : modèles officiels devis, bon de commande, PV et facture reliés aux téléchargements avec données fictives ; quatre PDF téléchargés et leurs quatre pages contrôlées, tests de confidentialité réussis. Accès par invitation non vérifié sans lien valide.
- [x] Afficher Recharge électrique et Mise en main dans le type de prestation du PDF groupé lorsque sélectionnées ; PDF vérifié sur une page sans chevauchement.
- [x] Aligner les colonnes et les totaux du PDF groupé ; conserver la motorisation issue de la recherche de chaque plaque (livraison et restitution). PDF de contrôle 11 véhicules vérifié sur une page ; tests électriques réussis.
- [ ] Vérifier la recherche réelle de plaque depuis un compte connecté : bloqué sans session de prévisualisation disponible.
- [x] Admin devis : retirer le type global en groupé, garder les trois types par véhicule et proposer les adresses favorites du client en simple/groupé.
- [x] Corriger l’affichage des deux options Recharge dans les missions simples et ajouter le choix par véhicule (livraison simple, livraison + restitution, recharge uniquement) dans les missions groupées.
- [x] Missions flotte simples et groupées : distinguer recharge trajet et recharge livraison (+25 € configurable par l'admin), sans modifier les autres tarifs.
- [ ] Harmoniser « Suivre ma mission » avec le GPS partagé en direct et la voiture Ligneo bleu électrique.

- [x] Brochures PDF professionnelles : téléchargements dans le menu professionnel, sur chaque page métier concernée et sur la page professionnelle complète.

- [x] Accueil ordinateur : prolonger naturellement la photo sur la gauche, recadrer sans couper la scène et éclaircir uniquement le logo brodé de la veste.
- [x] Remplacer la démo pro par le film sonore sur les profils et « Comment ça marche ? », remettre le logo Driver incliné, renforcer les néons par audience et renommer/colorer « Mon espace client » sur l'accueil.
- [x] Accueil ordinateur : raffiner les quatre choix de profil et leurs états au survol, au clavier et au clic sans changer leurs destinations.
- [x] Vidéos de démonstration : nouveau film particulier dans Services ; film loueurs à la place du film Driver sur les profils professionnels ; les deux parcours sur « Comment ça marche ? ».
- [x] Navbar : « Professionnels » actif en violet néon (clair + sombre) ; bloc « Besoin d'un conseil ? » moins lumineux + lien vers /contact
- [x] Notifications : bouton « Valider » dynamique — dégradé néon selon la couleur du toast (bleu/vert), glow, survol lumineux, effet de reflet
- [x] Vidéos de présentation : garder le premier démarrage automatique avec son, sans relancer automatiquement chaque vidéo ensuite ; lecture manuelle toujours possible.
- [x] Services pro : « Échanger avec un conseiller » en néon bleu électrique ; « Commander un transport » → /tarifs?audience=pro avec estimateur pré-sélectionné sur Professionnel ponctuel (desktop + mobile) ; « Demander une étude flotte » → /contact?audience=pro&formule=flotte.
- [x] Estimateur tarifs : prix lisible sur fond clair avec accents bleus, bouton « Continuer vers mon devis », étapes et confirmation de devis contrastées dans les deux thèmes.
- [x] Scanner client : fiabiliser le cadrage du scanner partagé avec l'état des lieux et la sortie du document.
- [x] Documents Driver : ouvrir ou partager les PDF sur mobile, y compris dans l'application installée.
- [x] Chargement web et application : logo conservé, TRANSPORTS blanc et LIGNEO bleu électrique, animation sobre.
- [x] Espace Driver PC : fenêtres et cartes opaques, texte contrasté, accents bleus/verts électriques ; espace pro sans doré avec accents violets électriques.
- [x] Audit lisibilité : fenêtre de notifications non coupée par la barre latérale, boutons et réponses de formation Driver contrastés en clair et sombre.
- [x] Tableau de bord admin : carte d’exploitation visible même sans position GPS, missions en cours et prochaines missions compactes et repliables sur le côté.
- [x] Mode sombre optionnel dans l'administration et les espaces particulier, pro et flotte (bouton de thème dans chaque menu).
- [x] Pastilles orange/jaunes des espaces connectés remplacées par les couleurs de la charte (bleu, violet pour pro).
- [x] Admin : barre d'outils des missions sur téléphone, 6 confirmations sensibles avec la fenêtre Ligneo, bandeau cookies compact sur téléphone.
- [x] Audit de l'espace particulier (compte existant), ordinateur et téléphone, clair et sombre.
- [x] Mode sombre pro : finitions (carte société du menu, onglets, chiffres du bandeau).
- [x] Statuts, e-mails et SMS : contrôle en lecture seule. (rapport livré)
- [x] E-mails : slogan en pied de page, accent doré remplacé par le bleu ; pastilles « En attente » convoyeur passées du jaune au bleu.
- [x] Page /suivi : préfixe MIS-TLG-2026- visible et champ à remplir (#XXX), champs effacés après recherche, statuts différenciés (attente bleu, en route violet, livrée vert, annulée rouge), adresses et prise en charge en bleu néon électrique, clair et sombre vérifiés à l'écran.
- [x] Page /suivi : infos véhicule (marque, modèle, immatriculation) et nom du destinataire affichés, sans téléphone ni e-mail — vérifié à l'écran (mission #116 : RENAULT RENAULT 5, HK-970-VH, AVEM / Mmm BAISSON Sabine).

## Espace pilotage Flotte/Pro (plan approuvé)
- [x] Indicateurs de pilotage + raccourcis sur la vue d'ensemble
- [x] Calendrier mois/semaine
- [x] Rapports + récap mensuel + export CSV
- [x] Comparaison EDL départ/arrivée avec alerte anomalie
- [x] Reprise rapide (plaque → dernier trajet du véhicule)
- [x] Filtres combinables avec puces (missions)
- [x] Filtres combinables sur le parc
- [x] Rôles Administrateur/Logistique/Comptabilité + invitations
- [x] Journal des actions par mission, préférences d'alertes, import CSV parc, bulles d'aide
- [x] Accès démo privé sur invitation avec demande publique et gestion admin.
- [x] Titres accueil + FAQ : voile bleu + dernier mot bleu électrique (gris #3e4759 retiré), vérifié à l0027écran en clair.

## Corrections demandées le 11 octobre
- [ ] SMS : réglages raccordés aux profils client/pro/flotte/convoyeur, contrôle fermé en cas d’erreur, codes à usage unique et sessions antérieures à la réactivation rejetées. Protection des accès directs aux données encore à finaliser ; validation réelle d’activation/envoi/réception non réalisée. Session disponible admin sans identifiant de session utilisable pour son contrôle SMS.
- [x] Demande groupée : plaque livraison unique, plaque retour avec recherche automatique uniquement pour restitution, métadonnées retour séparées, lavages communs/individuels sans prix sur les options. Contrôle depuis un vrai compte client reste non vérifié avec la session admin disponible.
- [x] Admin : blocs véhicules davantage séparés, détails et prix manuels conservés ; barèmes de lavage extérieur/intérieur/complet éditables sans montant imposé. Tests du calcul des suppléments réussis.
- [ ] Carte sans mission : moteur Mapbox et projection globe raccordés ; contrôle local des fonds Mapbox refusé (403), rendu géographique non vérifié. Bulles contenues dans l’écran et fermeture vérifiées visuellement. Vérification sur origine autorisée requise.
- [ ] Nouveaux fichiers plaque et ajout véhicule : reportés à la demande de l’utilisateur jusqu’à finition des corrections précédentes.

## Plaque universelle et fenêtre véhicule
- [x] Protection SMS appliquée aussi dans la base (missions, devis, factures, parc, adresses, photos)
- [x] Composants plaque (saisie + affichage) et bulles d'aide
- [x] Nouvelle fenêtre « Ajouter un véhicule » (flotte + onglet Parc véhicules admin)
- [x] Remplacer la plaque dans tous les autres écrans (estimateur, demandes, devis, driver, admin, PDF)
- [ ] Automatismes « Bientôt disponible » : brouillon convoyage garage, km auto, immobilisation, calendrier

## Jockeyage, nom du parc, Compte Kilomètres
- [x] Compléter les bulles des demandes simples et groupées : plaques, restitution et livraison, jockeyage, dates, options, récapitulatif et envoi ; aide du scanner partagé détaillée. Ouverture et fermeture vérifiées en contrôle isolé.
- [ ] Vérifier les bulles dans les demandes d'un compte connecté : aucune session autorisée disponible ; connexion dans l'aperçu nécessaire.
- [x] Services de jockeyage dans demandes simple et groupée (recharge électrique conservée)
- [x] Nom du parc synchronisé avec le nom de société
- [x] Interrupteur admin Compte Kilomètres
- [x] Brouillon convoyage garage (proposition sur fiche véhicule)
- [x] Démo : onglet Parc & automatismes
- [x] Bulles d'aide TCO et fiche véhicule
- [x] Images de catégories (citadine, berline, SUV, utilitaire, fourgon) et visites guidées : mission simple, groupée, ajout véhicule

## Demandes du 16 octobre
- [ ] Tableau de bord flotte : remplacer « Missions groupées par site » par les échéances du parc (CT, révision, assurance).
- [ ] Démo : fiche mission identique au vrai espace, avec GPS.
- [ ] Démo : signature de devis et paiement visibles mais validation bloquée.
- [ ] Démo : remplir sites, conducteurs et véhicules avec des données fictives.
