ALTER TABLE public.payment_links DROP CONSTRAINT IF EXISTS payment_links_mission_id_fkey;
ALTER TABLE public.payment_links
  ADD CONSTRAINT payment_links_mission_id_fkey
  FOREIGN KEY (mission_id) REFERENCES public.attributions(id) ON DELETE SET NULL;

ALTER TABLE public.payment_link_attachments DROP CONSTRAINT IF EXISTS payment_link_attachments_mission_id_fkey;
ALTER TABLE public.payment_link_attachments
  ADD CONSTRAINT payment_link_attachments_mission_id_fkey
  FOREIGN KEY (mission_id) REFERENCES public.attributions(id) ON DELETE SET NULL;