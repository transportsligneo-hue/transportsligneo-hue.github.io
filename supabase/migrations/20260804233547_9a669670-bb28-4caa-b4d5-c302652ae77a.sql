UPDATE public.modules
SET content = $c$
## Avant de présenter le véhicule
Vérifiez la propreté, retirez vos effets personnels, contrôlez la présence des clés et des documents.

## L'état des lieux d'arrivée
Suivez les indications de l'état des lieux digitalisé de l'application. Le protocole photo à l'arrivée est identique à celui du départ : les deux séries seront comparées automatiquement.
- 4 angles du véhicule (3/4 avant droit, arrière droit, arrière gauche, avant gauche)
- Toit, pare-brise, jantes, pneus
- Compteur kilométrique et niveau de carburant
- Intérieur : sièges, tableau de bord, coffre
- Accessoires : double des clés, carte grise, kit sécurité
- Notez toute différence par rapport au départ
- Faites signer le [[réceptionnaire|Personne habilitée à prendre livraison du véhicule et à signer le procès-verbal d'arrivée.]] dans l'application

## Clôture
La mission passe en attente de validation par Ligneo, puis le dossier PDF est généré et transmis.
!! Une mission non clôturée dans l'application n'est pas rémunérée.
>> Prenez 2 minutes de plus pour relire le procès-verbal avec le client : cela évite 90 % des litiges.
$c$,
    last_updated = now()
WHERE title = 'Livraison et état des lieux d arrivée';