
-- 1. TABLES
CREATE TABLE public.modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_index integer NOT NULL,
  title text NOT NULL,
  tag text,
  duration_minutes integer NOT NULL DEFAULT 20,
  objectives jsonb NOT NULL DEFAULT '[]'::jsonb,
  content text NOT NULL DEFAULT '',
  video_url text,
  resource_url text,
  resource_label text,
  checklist_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  case_study jsonb NOT NULL DEFAULT '{}'::jsonb,
  quiz_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  last_updated timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX modules_order_idx ON public.modules(order_index);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.modules TO authenticated;
GRANT ALL ON public.modules TO service_role;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "modules_admin_all" ON public.modules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TABLE public.module_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  module_id uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  checklist_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  case_study_answer integer,
  quiz_score integer,
  attempts_count integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, module_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.module_progress TO authenticated;
GRANT ALL ON public.module_progress TO service_role;
ALTER TABLE public.module_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mp_own_all" ON public.module_progress FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "mp_admin_all" ON public.module_progress FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TABLE public.module_content_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  module_title text,
  changed_by uuid,
  changed_by_email text,
  changed_at timestamptz NOT NULL DEFAULT now(),
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb
);
GRANT SELECT ON public.module_content_versions TO authenticated;
GRANT ALL ON public.module_content_versions TO service_role;
ALTER TABLE public.module_content_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mcv_admin_read" ON public.module_content_versions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_module_visited uuid,
  ADD COLUMN IF NOT EXISTS training_started_at timestamptz;

-- 2. TRIGGERS
CREATE OR REPLACE FUNCTION public.modules_touch_version()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  NEW.last_updated := now();
  NEW.updated_by := auth.uid();
  INSERT INTO public.module_content_versions (module_id, module_title, changed_by, changed_by_email, snapshot)
  VALUES (OLD.id, OLD.title, auth.uid(), (SELECT email FROM public.profiles WHERE id = auth.uid()),
    jsonb_build_object('title', OLD.title, 'tag', OLD.tag, 'duration_minutes', OLD.duration_minutes,
      'objectives', OLD.objectives, 'content', OLD.content, 'video_url', OLD.video_url,
      'resource_url', OLD.resource_url, 'checklist_items', OLD.checklist_items,
      'case_study', OLD.case_study, 'quiz_questions', OLD.quiz_questions));
  RETURN NEW;
END; $fn$;
CREATE TRIGGER modules_touch_version_trg BEFORE UPDATE ON public.modules
FOR EACH ROW EXECUTE FUNCTION public.modules_touch_version();

CREATE OR REPLACE FUNCTION public.module_progress_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $fn$;
CREATE TRIGGER module_progress_touch_trg BEFORE UPDATE ON public.module_progress
FOR EACH ROW EXECUTE FUNCTION public.module_progress_touch();

-- 3. RPCs convoyeur (contenu sans réponses de quiz)
CREATE OR REPLACE FUNCTION public.get_training_modules()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT COALESCE(jsonb_agg(x ORDER BY (x->>'order_index')::int), '[]'::jsonb) FROM (
    SELECT jsonb_build_object(
      'id', m.id, 'order_index', m.order_index, 'title', m.title, 'tag', m.tag,
      'duration_minutes', m.duration_minutes, 'objectives', m.objectives, 'content', m.content,
      'video_url', m.video_url, 'resource_url', m.resource_url, 'resource_label', m.resource_label,
      'checklist_items', m.checklist_items, 'last_updated', m.last_updated,
      'case_study', jsonb_build_object(
        'scenario', m.case_study->'scenario',
        'choices', COALESCE((SELECT jsonb_agg(jsonb_build_object('label', c->>'label')) FROM jsonb_array_elements(COALESCE(m.case_study->'choices','[]'::jsonb)) c), '[]'::jsonb)
      ),
      'quiz_questions', COALESCE((SELECT jsonb_agg(jsonb_build_object('question', q->>'question','choices', q->'choices'))
        FROM jsonb_array_elements(COALESCE(m.quiz_questions,'[]'::jsonb)) q), '[]'::jsonb)
    ) AS x
    FROM public.modules m WHERE m.is_active = true
  ) s;
$fn$;
REVOKE ALL ON FUNCTION public.get_training_modules() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_training_modules() TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_module_quiz(_module_id uuid, _answers jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE q jsonb; i int := 0; correct int := 0; total int := 0; score int; res jsonb := '[]'::jsonb; uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  FOR q IN SELECT jsonb_array_elements(quiz_questions) FROM public.modules WHERE id = _module_id LOOP
    total := total + 1;
    IF (_answers->>i)::int IS NOT DISTINCT FROM (q->>'answer')::int THEN correct := correct + 1; END IF;
    res := res || jsonb_build_object('index', i,
      'correct', (_answers->>i)::int IS NOT DISTINCT FROM (q->>'answer')::int,
      'answer', (q->>'answer')::int, 'explanation', q->>'explanation');
    i := i + 1;
  END LOOP;
  score := CASE WHEN total = 0 THEN 100 ELSE round(correct::numeric * 100 / total) END;
  INSERT INTO public.module_progress (user_id, module_id, quiz_score, attempts_count)
  VALUES (uid, _module_id, score, 1)
  ON CONFLICT (user_id, module_id) DO UPDATE
    SET quiz_score = GREATEST(COALESCE(public.module_progress.quiz_score,0), score),
        attempts_count = public.module_progress.attempts_count + 1,
        updated_at = now();
  RETURN jsonb_build_object('score', score, 'passed', score >= 80, 'results', res);
END; $fn$;
REVOKE ALL ON FUNCTION public.submit_module_quiz(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_module_quiz(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_case_study(_module_id uuid, _choice integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE c jsonb; uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT (case_study->'choices'->_choice) INTO c FROM public.modules WHERE id = _module_id;
  INSERT INTO public.module_progress (user_id, module_id, case_study_answer)
  VALUES (uid, _module_id, _choice)
  ON CONFLICT (user_id, module_id) DO UPDATE SET case_study_answer = _choice, updated_at = now();
  RETURN jsonb_build_object('correct', COALESCE((c->>'correct')::boolean,false), 'feedback', c->>'feedback');
END; $fn$;
REVOKE ALL ON FUNCTION public.submit_case_study(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_case_study(uuid, integer) TO authenticated;

-- 4. Statut de formation basé sur les nouveaux modules
CREATE OR REPLACE FUNCTION public.refresh_convoyeur_training_status(_convoyeur_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE total_required int; total_done int; uid uuid; fully boolean;
BEGIN
  SELECT user_id INTO uid FROM public.convoyeurs WHERE id = _convoyeur_id;
  SELECT count(*) INTO total_required FROM public.modules WHERE is_active = true;
  SELECT count(*) INTO total_done FROM public.module_progress mp
    JOIN public.modules m ON m.id = mp.module_id AND m.is_active = true
    WHERE mp.user_id = uid AND mp.completed = true;
  fully := total_required > 0 AND total_done >= total_required;
  UPDATE public.convoyeurs SET
    training_status = CASE WHEN fully THEN 'completed' WHEN total_done > 0 THEN 'in_progress' ELSE 'not_started' END,
    has_completed_training = fully,
    training_completed_at = CASE WHEN fully THEN COALESCE(training_completed_at, now()) ELSE NULL END
  WHERE id = _convoyeur_id;
END; $fn$;

CREATE OR REPLACE FUNCTION public.module_progress_sync_convoyeur()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE cid uuid;
BEGIN
  SELECT id INTO cid FROM public.convoyeurs WHERE user_id = NEW.user_id;
  IF cid IS NOT NULL THEN PERFORM public.refresh_convoyeur_training_status(cid); END IF;
  RETURN NEW;
END; $fn$;
CREATE TRIGGER module_progress_sync_trg AFTER INSERT OR UPDATE ON public.module_progress
FOR EACH ROW EXECUTE FUNCTION public.module_progress_sync_convoyeur();

-- 5. Dépréciation de l'ancien schéma
COMMENT ON TABLE public.formation_modules IS 'DEPRECATED (2026-08) - remplacé par public.modules';
COMMENT ON TABLE public.formation_progress IS 'DEPRECATED (2026-08) - remplacé par public.module_progress';
COMMENT ON TABLE public.formation_quiz_attempts IS 'DEPRECATED (2026-08) - historique conservé';
COMMENT ON TABLE public.formation_exams IS 'DEPRECATED (2026-08) - plus d examen final';
COMMENT ON TABLE public.formation_exam_attempts IS 'DEPRECATED (2026-08) - historique conservé';

-- 6. SEED DES 8 MODULES
INSERT INTO public.modules (order_index, title, tag, duration_minutes, objectives, content, checklist_items, case_study, quiz_questions) VALUES
(1, 'Bienvenue chez Transports Ligneo', 'Intégration', 15,
 $j$["Comprendre le rôle du convoyeur dans la chaîne Ligneo","Identifier les interlocuteurs et les canaux de contact","Connaître les engagements de qualité attendus","Savoir où trouver ses missions et ses documents"]$j$::jsonb,
 $t$## Qui sommes-nous
Transports Ligneo organise le [[convoyage|Déplacement d un véhicule par la route, conduit par un professionnel, entre un point de départ et un point d arrivée.]] de véhicules pour des concessions, loueurs, flottes d entreprise et particuliers.
Vous intervenez en tant que professionnel indépendant missionné par Ligneo : vous représentez la marque auprès du client final.

## Votre rôle
- Prendre en charge le véhicule dans les délais convenus
- Réaliser un [[état des lieux|Constat contradictoire de l état du véhicule, appuyé par des photos, réalisé au départ et à l arrivée.]] complet au départ et à l arrivée
- Conduire avec prudence et respecter le code de la route
- Livrer, faire signer le client et clôturer la mission dans l application

## Vos interlocuteurs
- L exploitation Ligneo : attribution, modification et suivi des missions
- Le support : incidents, litiges, questions administratives
!! Toute communication avec le client doit rester factuelle et courtoise : vous engagez l image de Ligneo.
>> Enregistrez le numéro de l exploitation dans vos contacts avant votre première mission.$t$,
 $j$["J ai lu la présentation du réseau Ligneo","J ai enregistré le contact de l exploitation","Je sais où consulter le catalogue de missions","Je sais où retrouver mes documents"]$j$::jsonb,
 $j${"scenario":"Le client vous demande, à la livraison, une remise commerciale sur le prix du transport. Que faites-vous ?","choices":[{"label":"Vous accordez une remise pour éviter le conflit","correct":false,"feedback":"Le convoyeur ne négocie jamais le prix : cela relève exclusivement de Ligneo."},{"label":"Vous expliquez que la tarification relève de Ligneo et invitez le client à contacter l exploitation","correct":true,"feedback":"Exact. Vous restez courtois, factuel, et vous renvoyez la question commerciale à Ligneo."},{"label":"Vous refusez de livrer tant que le point n est pas réglé","correct":false,"feedback":"Non : la mission doit être menée à son terme, le sujet commercial se traite en parallèle."}]}$j$::jsonb,
 $j$[{"question":"Quel est le rôle principal du convoyeur Ligneo ?","choices":["Vendre des véhicules","Convoyer le véhicule et documenter son état","Assurer le véhicule","Facturer le client final"],"answer":1,"explanation":"Le convoyeur conduit le véhicule et documente son état au départ et à l arrivée."},{"question":"Qui fixe le prix d une mission ?","choices":["Le convoyeur","Le client","Transports Ligneo","Le concessionnaire"],"answer":2,"explanation":"La tarification est fixée par Ligneo."},{"question":"Combien d états des lieux par mission simple ?","choices":["Un seul","Deux : départ et arrivée","Trois","Aucun"],"answer":1,"explanation":"Un au départ et un à l arrivée."},{"question":"Quel comportement adopter face au client ?","choices":["Commercial et négociateur","Factuel et courtois","Distant","Informel"],"answer":1,"explanation":"Factuel et courtois : vous représentez Ligneo."},{"question":"Où trouvez-vous vos missions ?","choices":["Par SMS uniquement","Dans le catalogue de l application Ligneo","Sur un groupe public","Par courrier"],"answer":1,"explanation":"Le catalogue de l application centralise les missions disponibles."}]$j$::jsonb),
(2, 'Conformité documentaire', 'Obligatoire', 20,
 $j$["Connaître les documents exigés par Ligneo","Comprendre le rôle de la RC Pro","Maintenir ses documents à jour et valides","Éviter le blocage de compte pour non-conformité"]$j$::jsonb,
 $t$## Les documents exigés
Vous exercez déjà sous votre propre statut. Ligneo ne vous accompagne pas dans la création d entreprise : la formation couvre uniquement la conformité documentaire attendue.
- [[RC Pro|Responsabilité Civile Professionnelle : assurance couvrant les dommages causés dans le cadre de votre activité professionnelle.]] en cours de validité
- Pièce d identité recto/verso lisible
- Permis de conduire valide (recto/verso)

## Validité et mise à jour
Chaque document a une date d échéance suivie par l application. Vous recevez une alerte avant expiration.
!! Un document expiré suspend automatiquement l accès au catalogue de missions.
>> Déposez le renouvellement dès réception, sans attendre l alerte.

## Qualité des dépôts
Photographiez à plat, sans reflet, les quatre coins visibles. Le scanner intégré redresse automatiquement le document.$t$,
 $j$["Ma RC Pro est déposée et valide","Ma pièce d identité est déposée recto/verso","Mon permis est déposé et lisible","J ai vérifié les dates d échéance","J ai activé les notifications d expiration"]$j$::jsonb,
 $j${"scenario":"Votre RC Pro expire dans 5 jours et vous avez une mission planifiée la semaine prochaine. Que faites-vous ?","choices":[{"label":"Vous attendez l expiration pour voir si le compte est bloqué","correct":false,"feedback":"Non : l accès aux missions sera suspendu et la mission risque d être réattribuée."},{"label":"Vous déposez dès maintenant l attestation renouvelée dans votre espace documents","correct":true,"feedback":"Exact. Anticiper évite toute rupture de conformité."},{"label":"Vous prévenez seulement le client","correct":false,"feedback":"Le client n est pas concerné : c est un sujet Ligneo / conformité."}]}$j$::jsonb,
 $j$[{"question":"Que couvre la RC Pro ?","choices":["Les dommages causés dans le cadre professionnel","Votre santé","Le véhicule convoyé uniquement","Vos frais de carburant"],"answer":0,"explanation":"Elle couvre votre responsabilité professionnelle."},{"question":"Que se passe-t-il si un document expire ?","choices":["Rien","L accès au catalogue est suspendu","Une amende","Le compte est supprimé"],"answer":1,"explanation":"L accès aux missions est suspendu jusqu à régularisation."},{"question":"Ligneo accompagne-t-il la création d entreprise ?","choices":["Oui, avec l INPI","Non, le statut est un prérequis","Uniquement pour les auto-entrepreneurs","Sur demande"],"answer":1,"explanation":"Vous disposez déjà de votre statut : Ligneo ne traite que la conformité documentaire."},{"question":"Quels documents sont obligatoires ?","choices":["RC Pro, pièce d identité, permis","Kbis uniquement","Carte grise","Attestation fiscale"],"answer":0,"explanation":"RC Pro, pièce d identité et permis de conduire."},{"question":"Comment photographier un document ?","choices":["En biais","À plat, sans reflet, coins visibles","De loin","En noir et blanc"],"answer":1,"explanation":"À plat, sans reflet, les quatre coins visibles."}]$j$::jsonb),
(3, 'Préparer une mission', 'Terrain', 20,
 $j$["Lire et comprendre un ordre de mission","Préparer son itinéraire et ses horaires","Anticiper le matériel nécessaire","Confirmer les contacts départ et arrivée"]$j$::jsonb,
 $t$## Lire l ordre de mission
L [[ordre de mission|Fiche récapitulative de la mission : véhicule, adresses, créneaux, contacts et consignes particulières.]] contient le véhicule, les adresses, les créneaux et les consignes.
Vérifiez avant d accepter : distance, créneau, contraintes d accès, type de véhicule.

## Préparer le trajet
- Calculez l itinéraire et prévoyez une marge de 30 minutes
- Vérifiez les restrictions de circulation et les péages
- Prévoyez votre trajet d approche et de retour

## Matériel indispensable
Téléphone chargé, batterie externe, gilet, plaque W si applicable, dossier de mission accessible hors ligne.
!! N acceptez jamais une mission dont vous ne pouvez pas tenir le créneau.
>> Appelez le contact de départ la veille pour confirmer l heure et l accès.$t$,
 $j$["J ai lu l ordre de mission en entier","J ai vérifié le créneau et l itinéraire","J ai confirmé le contact de départ","Mon téléphone et ma batterie externe sont prêts","J ai téléchargé la mission pour le mode hors ligne"]$j$::jsonb,
 $j${"scenario":"À J-1, le contact de départ ne répond pas et l adresse semble être un parking fermé. Que faites-vous ?","choices":[{"label":"Vous vous présentez le lendemain et improvisez sur place","correct":false,"feedback":"Risque d attente et de mission perdue : l information doit être sécurisée avant."},{"label":"Vous prévenez l exploitation Ligneo pour obtenir un contact ou une consigne d accès","correct":true,"feedback":"Exact. L exploitation dispose des coordonnées du donneur d ordre."},{"label":"Vous annulez la mission","correct":false,"feedback":"Trop tôt : la situation est en général résolue par un simple appel à l exploitation."}]}$j$::jsonb,
 $j$[{"question":"Quelle marge horaire prévoir ?","choices":["Aucune","Environ 30 minutes","3 heures","1 jour"],"answer":1,"explanation":"Une marge de 30 minutes absorbe les aléas courants."},{"question":"Que faire si le contact départ est injoignable ?","choices":["Annuler","Prévenir l exploitation Ligneo","Se présenter sans prévenir","Attendre une semaine"],"answer":1,"explanation":"L exploitation dispose des coordonnées du donneur d ordre."},{"question":"Que contient l ordre de mission ?","choices":["Le véhicule, les adresses, les créneaux, les consignes","Uniquement le prix","Le nom du convoyeur","La facture"],"answer":0,"explanation":"C est la fiche récapitulative complète de la mission."},{"question":"Peut-on accepter une mission dont le créneau est intenable ?","choices":["Oui","Non","Si le client accepte","Le week-end"],"answer":1,"explanation":"Non : cela dégrade la promesse client."},{"question":"Quel matériel est indispensable ?","choices":["Téléphone chargé et batterie externe","Un ordinateur","Un appareil photo reflex","Une imprimante"],"answer":0,"explanation":"L application est le support de la mission."}]$j$::jsonb),
(4, 'État des lieux au départ', 'Terrain', 25,
 $j$["Réaliser un état des lieux exhaustif","Photographier selon le protocole Ligneo","Décrire correctement une anomalie","Sécuriser la signature du remettant"]$j$::jsonb,
 $t$## Le protocole photo
Un état des lieux départ mal fait vous expose personnellement en cas de [[litige|Contestation d un dommage constaté à l arrivée, arbitrée à partir des photos et du procès-verbal.]].
- 4 angles du véhicule (3/4 avant droit, arrière droit, arrière gauche, avant gauche)
- Toit, pare-brise, jantes, pneus
- Compteur kilométrique et niveau de carburant
- Intérieur : sièges, tableau de bord, coffre
- Accessoires : double des clés, carte grise, kit sécurité

## Décrire une anomalie
Type (rayure, impact, enfoncement), localisation précise, taille estimée, photo rapprochée + photo d ensemble.
!! Pas de photo = pas de preuve. Une anomalie non documentée au départ vous sera imputée à l arrivée.
>> Par temps de pluie ou de nuit, signalez-le dans les commentaires et multipliez les photos rapprochées.

## Signature
Le remettant signe l état des lieux dans l application. En son absence, notez-le et prévenez l exploitation.$t$,
 $j$["J ai pris les 4 angles du véhicule","J ai photographié le compteur et le carburant","J ai photographié l intérieur et le coffre","J ai documenté chaque anomalie","J ai fait signer le remettant"]$j$::jsonb,
 $j${"scenario":"Vous découvrez une rayure de 20 cm sur la portière arrière droite, non mentionnée sur la fiche du client. Que faites-vous ?","choices":[{"label":"Vous partez sans rien signaler pour ne pas retarder la mission","correct":false,"feedback":"La rayure vous sera imputée à l arrivée."},{"label":"Vous la photographiez de près et de loin, la décrivez dans l état des lieux et la faites valider au remettant","correct":true,"feedback":"Exact. Documenter et faire valider est la seule protection efficace."},{"label":"Vous la signalez uniquement par téléphone","correct":false,"feedback":"Un appel ne laisse pas de trace exploitable en cas de litige."}]}$j$::jsonb,
 $j$[{"question":"Combien d angles minimum photographier ?","choices":["2","4","6","1"],"answer":1,"explanation":"Les 4 angles à 3/4 permettent de couvrir toute la carrosserie."},{"question":"Une anomalie non photographiée au départ...","choices":["N a aucune conséquence","Peut vous être imputée à l arrivée","Est couverte par le client","Est ignorée"],"answer":1,"explanation":"Sans preuve au départ, le dommage est réputé survenu pendant le convoyage."},{"question":"Que faut-il photographier en plus de la carrosserie ?","choices":["Compteur et niveau de carburant","La plaque uniquement","Le garage","Rien"],"answer":0,"explanation":"Kilométrage et carburant conditionnent la restitution."},{"question":"Comment décrire une anomalie ?","choices":["Type, localisation, taille, photos","Uniquement une croix","Par oral","Avec un dessin"],"answer":0,"explanation":"Une description structurée + photos rapprochée et d ensemble."},{"question":"Si le remettant est absent ?","choices":["On annule","On le note et on prévient l exploitation","On signe à sa place","On saute l état des lieux"],"answer":1,"explanation":"Ne jamais signer à la place d un tiers : on documente et on alerte."}]$j$::jsonb),
(5, 'Conduite et sécurité en convoyage', 'Sécurité', 25,
 $j$["Adopter une conduite responsable en véhicule confié","Gérer pauses, carburant et péages","Respecter les règles propres au véhicule convoyé","Réagir correctement en cas de contrôle"]$j$::jsonb,
 $t$## Conduite d un véhicule confié
Vous conduisez un bien qui ne vous appartient pas : anticipation, souplesse, respect strict des limitations.
- Pas de conduite sportive, pas d accélérations inutiles
- Pause obligatoire toutes les 2 heures
- Interdiction absolue d alcool, de stupéfiants et de téléphone en main
- Aucun passager non autorisé, aucun transport de marchandise personnelle

## Carburant, péages, [[plaque W|Plaque W garage : plaque professionnelle permettant de circuler avec un véhicule non immatriculé au nom du conducteur.]]
Conservez tous les justificatifs : ils conditionnent le remboursement des frais.
!! Toute infraction (excès de vitesse, stationnement) reste à la charge du convoyeur.
>> Photographiez chaque ticket dès le paiement : le scanner de l application les archive automatiquement.

## En cas de contrôle
Présentez la carte grise, votre permis, l ordre de mission et, le cas échéant, l autorisation de circulation.$t$,
 $j$["Je respecte la pause toutes les 2 heures","Je conserve tous mes justificatifs","Je n emporte aucun passager non autorisé","Je connais les documents à présenter en contrôle","Je n utilise pas mon téléphone en main"]$j$::jsonb,
 $j${"scenario":"Vous êtes en retard sur votre créneau de livraison de 40 minutes. Que faites-vous ?","choices":[{"label":"Vous accélérez pour rattraper le temps perdu","correct":false,"feedback":"Jamais : le risque et les amendes sont à votre charge, et le véhicule est sous votre responsabilité."},{"label":"Vous prévenez l exploitation et le contact d arrivée, et vous maintenez une conduite normale","correct":true,"feedback":"Exact. Un retard annoncé est accepté ; un accident ne l est pas."},{"label":"Vous ne dites rien et arrivez quand vous pouvez","correct":false,"feedback":"Le manque d information dégrade fortement la satisfaction client."}]}$j$::jsonb,
 $j$[{"question":"Fréquence des pauses ?","choices":["Toutes les 2 heures","Toutes les 6 heures","Jamais","Une par jour"],"answer":0,"explanation":"Une pause toutes les 2 heures."},{"question":"Qui paie une amende pour excès de vitesse ?","choices":["Ligneo","Le client","Le convoyeur","L assurance"],"answer":2,"explanation":"Les infractions restent à la charge du convoyeur."},{"question":"Peut-on prendre un passager ?","choices":["Oui","Non, sauf autorisation","Si c est un collègue","La nuit"],"answer":1,"explanation":"Aucun passager non autorisé."},{"question":"Que faire en cas de retard ?","choices":["Accélérer","Prévenir l exploitation et le contact d arrivée","Ne rien dire","Annuler"],"answer":1,"explanation":"Informer immédiatement."},{"question":"Que présenter lors d un contrôle ?","choices":["Carte grise, permis, ordre de mission","Uniquement le permis","Votre RIB","Rien"],"answer":0,"explanation":"Carte grise, permis, ordre de mission et autorisation éventuelle."}]$j$::jsonb),
(6, 'Incidents, pannes et litiges', 'Sécurité', 25,
 $j$["Réagir dans le bon ordre en cas d incident","Déclarer un incident dans l application","Constituer un dossier de preuve","Distinguer panne, accident et litige"]$j$::jsonb,
 $t$## Les 4 réflexes
1. Sécuriser : gilet, triangle, mise en sécurité des personnes
2. Alerter : secours si nécessaire, puis l exploitation Ligneo
3. Documenter : photos, [[constat amiable|Document contradictoire rempli avec l autre conducteur en cas d accident matériel.]] si tiers impliqué
4. Déclarer : incident créé dans l application avec photos et description

## Panne mécanique
Ne tentez aucune réparation. Contactez l exploitation qui déclenche l assistance du donneur d ordre.
!! Ne quittez jamais le véhicule sans accord de l exploitation.

## Litige à l arrivée
Le client conteste un dommage : restez factuel, montrez les photos de l état des lieux départ, ne reconnaissez aucune responsabilité sur place et laissez Ligneo instruire le dossier.
>> Un incident déclaré dans l heure est traité beaucoup plus favorablement qu un incident découvert par le client.$t$,
 $j$["Je connais les 4 réflexes","Je sais créer un incident dans l application","Je sais que je ne dois pas réparer moi-même","Je sais quoi répondre en cas de contestation client","J ai le numéro de l exploitation en favori"]$j$::jsonb,
 $j${"scenario":"Un voyant moteur s allume sur autoroute et le véhicule perd de la puissance. Que faites-vous ?","choices":[{"label":"Vous continuez jusqu à destination","correct":false,"feedback":"Risque d aggravation majeure du dommage et de danger."},{"label":"Vous vous arrêtez en sécurité, vous sécurisez, puis vous appelez l exploitation","correct":true,"feedback":"Exact : sécuriser, alerter, documenter, déclarer."},{"label":"Vous ouvrez le capot et tentez un diagnostic","correct":false,"feedback":"Aucune intervention mécanique n est autorisée."}]}$j$::jsonb,
 $j$[{"question":"Quel est le premier réflexe ?","choices":["Photographier","Sécuriser","Appeler le client","Repartir"],"answer":1,"explanation":"La sécurité des personnes d abord."},{"question":"Peut-on réparer soi-même ?","choices":["Oui","Non","Si on sait faire","Sur accord du client"],"answer":1,"explanation":"Aucune intervention mécanique."},{"question":"Un tiers est impliqué dans un accident matériel :","choices":["On remplit un constat amiable","On échange un numéro","On ne fait rien","On appelle la police systématiquement"],"answer":0,"explanation":"Le constat amiable est indispensable."},{"question":"Le client conteste un dommage à l arrivée :","choices":["Vous reconnaissez la responsabilité","Vous restez factuel et laissez Ligneo instruire","Vous payez","Vous partez sans rien dire"],"answer":1,"explanation":"Ne jamais reconnaître de responsabilité sur place."},{"question":"Dans quel délai déclarer un incident ?","choices":["Dans l heure","Sous 7 jours","À la fin du mois","Jamais"],"answer":0,"explanation":"Le plus tôt possible, idéalement dans l heure."}]$j$::jsonb),
(7, 'Livraison et état des lieux d arrivée', 'Terrain', 20,
 $j$["Réaliser l état des lieux d arrivée dans les règles","Obtenir une signature client valide","Comparer départ et arrivée","Clôturer proprement la mission"]$j$::jsonb,
 $t$## Avant de présenter le véhicule
Vérifiez la propreté, retirez vos effets personnels, contrôlez la présence des clés et des documents.

## L état des lieux d arrivée
Reprenez exactement le même protocole photo qu au départ : les deux séries seront comparées automatiquement.
- 4 angles, intérieur, compteur, carburant
- Notez toute différence par rapport au départ
- Faites signer le [[réceptionnaire|Personne habilitée à prendre livraison du véhicule et à signer le procès-verbal d arrivée.]] dans l application

## Clôture
La mission passe en attente de validation par Ligneo, puis le dossier PDF est généré et transmis.
!! Une mission non clôturée dans l application n est pas rémunérée.
>> Prenez 2 minutes de plus pour relire le procès-verbal avec le client : cela évite 90 % des litiges.$t$,
 $j$["J ai repris le protocole photo complet","J ai comparé avec l état des lieux départ","J ai fait signer le réceptionnaire","J ai remis les clés et les documents","J ai clôturé la mission dans l application"]$j$::jsonb,
 $j${"scenario":"Le réceptionnaire est pressé et refuse de signer, en vous disant de partir. Que faites-vous ?","choices":[{"label":"Vous partez sans signature","correct":false,"feedback":"Sans signature, la livraison est difficilement opposable en cas de litige."},{"label":"Vous expliquez que la signature protège les deux parties, et si le refus persiste vous le mentionnez et prévenez l exploitation","correct":true,"feedback":"Exact : on documente le refus et on alerte immédiatement."},{"label":"Vous signez à sa place","correct":false,"feedback":"Interdit : c est un faux."}]}$j$::jsonb,
 $j$[{"question":"Le protocole photo d arrivée est :","choices":["Allégé","Identique à celui du départ","Facultatif","Limité au compteur"],"answer":1,"explanation":"Identique, pour permettre la comparaison."},{"question":"Une mission non clôturée dans l application :","choices":["Est payée quand même","N est pas rémunérée","Est clôturée automatiquement","Est annulée"],"answer":1,"explanation":"La clôture conditionne la facturation."},{"question":"Le client refuse de signer :","choices":["On signe à sa place","On mentionne le refus et on alerte l exploitation","On repart avec le véhicule","On insiste 1 heure"],"answer":1,"explanation":"Documenter le refus et alerter."},{"question":"Que faire avant de présenter le véhicule ?","choices":["Vérifier propreté, clés et documents","Rien","Le laver obligatoirement","Faire le plein"],"answer":0,"explanation":"Contrôle rapide de présentation et des accessoires."},{"question":"Que devient le dossier de mission ?","choices":["Il est supprimé","Un PDF est généré après validation Ligneo","Il reste local","Il est envoyé au convoyeur seulement"],"answer":1,"explanation":"Le dossier PDF est généré puis transmis."}]$j$::jsonb),
(8, 'Application Ligneo, facturation et qualité', 'Intégration', 20,
 $j$["Maîtriser les écrans clés de l application","Comprendre le circuit de facturation","Connaître les indicateurs de qualité suivis","Savoir travailler en mode hors ligne"]$j$::jsonb,
 $t$## L application au quotidien
Catalogue, missions en cours, états des lieux, documents, finances. Toutes vos actions sont enregistrées, y compris hors réseau grâce à la [[file hors ligne|Mécanisme qui enregistre vos actions localement quand le réseau est absent et les envoie automatiquement dès le retour de la connexion.]].

## Facturation
- La mission validée alimente automatiquement votre espace Finances
- Les frais justifiés (carburant, péage, transport d approche) sont remboursés sur pièce
- Le récapitulatif mensuel est disponible en PDF

## Qualité de service
Indicateurs suivis : ponctualité, complétude des états des lieux, délai de clôture, incidents déclarés à temps, retours clients.
!! Trois états des lieux incomplets consécutifs entraînent un entretien avec l exploitation.
>> Clôturez vos missions le jour même : c est le principal levier de rapidité de paiement.$t$,
 $j$["Je sais retrouver mes missions et mes documents","Je sais consulter mon espace Finances","Je conserve mes justificatifs de frais","Je sais que l application fonctionne hors ligne","Je clôture mes missions le jour même"]$j$::jsonb,
 $j${"scenario":"Vous terminez une livraison dans un sous-sol sans réseau. Comment procédez-vous ?","choices":[{"label":"Vous attendez d avoir du réseau pour recommencer l état des lieux","correct":false,"feedback":"Inutile : l application enregistre localement."},{"label":"Vous réalisez normalement l état des lieux : l application enregistre et synchronise au retour du réseau","correct":true,"feedback":"Exact. La file hors ligne envoie automatiquement dès la reconnexion."},{"label":"Vous notez tout sur papier","correct":false,"feedback":"Le papier n alimente pas le dossier numérique."}]}$j$::jsonb,
 $j$[{"question":"Que se passe-t-il sans réseau ?","choices":["Tout est perdu","Les actions sont enregistrées puis synchronisées","L application se ferme","Il faut tout refaire"],"answer":1,"explanation":"La file hors ligne synchronise automatiquement."},{"question":"Comment sont remboursés les frais ?","choices":["Forfaitairement","Sur justificatif","Jamais","Par le client"],"answer":1,"explanation":"Sur présentation des justificatifs."},{"question":"Quel est le principal levier de paiement rapide ?","choices":["Clôturer la mission le jour même","Appeler la comptabilité","Rouler plus vite","Refuser les missions longues"],"answer":0,"explanation":"La clôture déclenche la chaîne de facturation."},{"question":"Quels indicateurs qualité sont suivis ?","choices":["Ponctualité, complétude des EDL, délai de clôture","Le nombre de kilomètres uniquement","Rien","La vitesse moyenne"],"answer":0,"explanation":"Ce sont les principaux indicateurs de qualité."},{"question":"Où consulter votre récapitulatif mensuel ?","choices":["Espace Finances","Catalogue","Profil client","Par courrier"],"answer":0,"explanation":"Dans l espace Finances, en PDF."}]$j$::jsonb);
