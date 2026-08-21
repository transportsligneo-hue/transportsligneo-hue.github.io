-- 1) Suivi d'envoi email sur les notifications admin
ALTER TABLE public.admin_notifications
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS admin_notifications_email_pending_idx
  ON public.admin_notifications (created_at)
  WHERE email_sent_at IS NULL;

-- 2) Réglage : destinataires des alertes
INSERT INTO public.app_settings (key, value)
VALUES ('admin_alert_emails', '{"enabled": true, "emails": ["transports.ligneo@gmail.com"]}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 3) Secret partagé pour le déclencheur planifié
INSERT INTO public.api_internal_config (key, value)
VALUES ('admin_alert_secret', encode(gen_random_bytes(24), 'hex'))
ON CONFLICT (key) DO NOTHING;

-- 4) Triggers de création de notification admin
CREATE OR REPLACE FUNCTION public.trg_admin_notify_new_demande()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.admin_notifications (type, titre, message, link, entity_type, entity_id, metadata)
  VALUES (
    'demande',
    'Nouvelle demande de convoyage',
    coalesce(NEW.prenom || ' ' || NEW.nom, NEW.email, 'Client') || ' — ' ||
      coalesce(NEW.depart, '?') || ' → ' || coalesce(NEW.arrivee, '?'),
    '/admin/demandes',
    'demande',
    NEW.id,
    jsonb_build_object(
      'client', coalesce(NEW.prenom || ' ' || NEW.nom, ''),
      'email', NEW.email, 'telephone', NEW.telephone,
      'depart', NEW.depart, 'arrivee', NEW.arrivee,
      'date', NEW.date_souhaitee
    )
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_admin_notify_new_demande ON public.demandes_convoyage;
CREATE TRIGGER trg_admin_notify_new_demande
AFTER INSERT ON public.demandes_convoyage
FOR EACH ROW EXECUTE FUNCTION public.trg_admin_notify_new_demande();

CREATE OR REPLACE FUNCTION public.trg_admin_notify_new_devis()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.admin_notifications (type, titre, message, link, entity_type, entity_id, metadata)
  VALUES (
    'devis',
    'Nouveau devis créé',
    coalesce(NEW.numero, '') || ' · ' || coalesce(NEW.prenom || ' ' || NEW.nom, NEW.email, 'Client') || ' — ' ||
      coalesce(NEW.depart, '?') || ' → ' || coalesce(NEW.arrivee, '?'),
    '/admin/devis',
    'devis',
    NEW.id,
    jsonb_build_object(
      'numero', NEW.numero,
      'client', coalesce(NEW.prenom || ' ' || NEW.nom, ''),
      'email', NEW.email, 'telephone', NEW.telephone,
      'depart', NEW.depart, 'arrivee', NEW.arrivee
    )
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_admin_notify_new_devis ON public.devis;
CREATE TRIGGER trg_admin_notify_new_devis
AFTER INSERT ON public.devis
FOR EACH ROW EXECUTE FUNCTION public.trg_admin_notify_new_devis();

CREATE OR REPLACE FUNCTION public.trg_admin_notify_new_contact()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.admin_notifications (type, titre, message, link, entity_type, entity_id, metadata)
  VALUES (
    'message',
    'Nouveau message de contact',
    coalesce(NEW.nom, NEW.email, 'Visiteur') || ' — ' || left(coalesce(NEW.message, ''), 160),
    '/admin/messages',
    'contact_message',
    NEW.id,
    jsonb_build_object('email', NEW.email, 'telephone', NEW.telephone)
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_admin_notify_new_contact ON public.contact_messages;
CREATE TRIGGER trg_admin_notify_new_contact
AFTER INSERT ON public.contact_messages
FOR EACH ROW EXECUTE FUNCTION public.trg_admin_notify_new_contact();

CREATE OR REPLACE FUNCTION public.trg_admin_notify_new_b2b_transport()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.admin_notifications (type, titre, message, link, entity_type, entity_id, metadata)
  VALUES (
    'b2b',
    'Nouvelle demande B2B',
    coalesce(NEW.numero, '') || ' — ' || coalesce(NEW.pickup_address, '?') || ' → ' || coalesce(NEW.dropoff_address, '?'),
    '/admin/b2b-dispatch',
    'b2b_transport_request',
    NEW.id,
    jsonb_build_object('numero', NEW.numero)
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_admin_notify_new_b2b_transport ON public.b2b_transport_requests;
CREATE TRIGGER trg_admin_notify_new_b2b_transport
AFTER INSERT ON public.b2b_transport_requests
FOR EACH ROW EXECUTE FUNCTION public.trg_admin_notify_new_b2b_transport();

CREATE OR REPLACE FUNCTION public.trg_admin_notify_new_fleet_lead()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.admin_notifications (type, titre, message, link, entity_type, entity_id, metadata)
  VALUES (
    'b2b',
    'Nouveau lead flotte',
    coalesce(NEW.company_name, NEW.contact_email, 'Prospect'),
    '/admin/b2b-leads',
    'b2b_fleet_lead',
    NEW.id,
    jsonb_build_object('email', NEW.contact_email)
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_admin_notify_new_fleet_lead ON public.b2b_fleet_leads;
CREATE TRIGGER trg_admin_notify_new_fleet_lead
AFTER INSERT ON public.b2b_fleet_leads
FOR EACH ROW EXECUTE FUNCTION public.trg_admin_notify_new_fleet_lead();

-- 5) Déclencheur planifié : envoi des alertes email
SELECT cron.unschedule('admin-alerts-dispatch')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'admin-alerts-dispatch');

SELECT cron.schedule(
  'admin-alerts-dispatch',
  '*/2 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://transportsligneo.lovable.app/api/public/admin-alerts-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-alert-secret', (SELECT value FROM public.api_internal_config WHERE key = 'admin_alert_secret')
    ),
    body := '{}'::jsonb
  );
  $cron$
);