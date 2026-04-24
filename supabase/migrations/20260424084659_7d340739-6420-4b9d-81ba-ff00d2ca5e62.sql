DROP POLICY IF EXISTS "Anyone can create contact message" ON public.contact_messages;
CREATE POLICY "Anyone can create valid contact message"
ON public.contact_messages
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(trim(nom)) BETWEEN 1 AND 120
  AND length(trim(email)) BETWEEN 3 AND 254
  AND email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  AND length(trim(message)) BETWEEN 1 AND 5000
  AND length(trim(type_demande)) BETWEEN 1 AND 80
  AND length(trim(profil)) BETWEEN 1 AND 80
);

DROP POLICY IF EXISTS "Anyone can create demande" ON public.demandes_convoyage;
CREATE POLICY "Anyone can create valid demande"
ON public.demandes_convoyage
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(trim(nom)) BETWEEN 1 AND 120
  AND length(trim(prenom)) BETWEEN 1 AND 120
  AND length(trim(email)) BETWEEN 3 AND 254
  AND email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  AND length(trim(depart)) BETWEEN 1 AND 255
  AND length(trim(arrivee)) BETWEEN 1 AND 255
);

DROP POLICY IF EXISTS "Anyone can create devis" ON public.devis;
CREATE POLICY "Anyone can create valid devis"
ON public.devis
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(trim(nom)) BETWEEN 1 AND 120
  AND length(trim(prenom)) BETWEEN 1 AND 120
  AND length(trim(email)) BETWEEN 3 AND 254
  AND email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  AND length(trim(depart)) BETWEEN 1 AND 255
  AND length(trim(arrivee)) BETWEEN 1 AND 255
  AND prix_estime >= 0
);