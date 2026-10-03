DROP POLICY IF EXISTS "Clients upload own carte grise" ON storage.objects;
DROP POLICY IF EXISTS "Clients update own carte grise" ON storage.objects;
DROP POLICY IF EXISTS "Clients read own carte grise" ON storage.objects;
DROP POLICY IF EXISTS "Clients delete own carte grise" ON storage.objects;

CREATE POLICY "Clients upload own carte grise" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'cartes-grises' AND (auth.uid())::text = (storage.foldername(name))[1]
  AND ((storage.foldername(name))[2] = 'mes-documents'
    OR EXISTS (SELECT 1 FROM public.devis d WHERE d.id::text = (storage.foldername(objects.name))[2])));

CREATE POLICY "Clients update own carte grise" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'cartes-grises' AND (auth.uid())::text = (storage.foldername(name))[1]
  AND ((storage.foldername(name))[2] = 'mes-documents'
    OR EXISTS (SELECT 1 FROM public.devis d WHERE d.id::text = (storage.foldername(objects.name))[2] AND d.paid_at IS NULL)))
WITH CHECK (bucket_id = 'cartes-grises' AND (auth.uid())::text = (storage.foldername(name))[1]
  AND ((storage.foldername(name))[2] = 'mes-documents'
    OR EXISTS (SELECT 1 FROM public.devis d WHERE d.id::text = (storage.foldername(objects.name))[2] AND d.paid_at IS NULL)));

CREATE POLICY "Clients read own carte grise" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'cartes-grises' AND (auth.uid())::text = (storage.foldername(name))[1]
  AND ((storage.foldername(name))[2] = 'mes-documents'
    OR EXISTS (SELECT 1 FROM public.devis d WHERE d.id::text = (storage.foldername(objects.name))[2])));

CREATE POLICY "Clients delete own carte grise" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'cartes-grises' AND (auth.uid())::text = (storage.foldername(name))[1]
  AND EXISTS (SELECT 1 FROM public.devis d WHERE d.id::text = (storage.foldername(objects.name))[2] AND d.paid_at IS NULL));