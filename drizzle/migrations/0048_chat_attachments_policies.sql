CREATE POLICY "chat attachments read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-attachments' AND public.chat_can_access(((storage.foldername(name))[1])::uuid));
CREATE POLICY "chat attachments upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments' AND public.chat_can_access(((storage.foldername(name))[1])::uuid));