CREATE TABLE public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('mission_client','mission_convoyeur','conseiller')),
  mission_id uuid NULL,
  mission_reference text NULL,
  client_user_id uuid NULL,
  convoyeur_user_id uuid NULL,
  visitor_name text NULL,
  visitor_email text NULL,
  visitor_token text NULL,
  source text NOT NULL DEFAULT 'client_connecte',
  status text NOT NULL DEFAULT 'ouverte' CHECK (status IN ('ouverte','en_attente','resolue')),
  vroomy_summary text NULL,
  subject text NULL,
  unread_admin integer NOT NULL DEFAULT 0,
  unread_participant integer NOT NULL DEFAULT 0,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_preview text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX chat_conv_mission_kind_uq ON public.chat_conversations(mission_id, kind) WHERE mission_id IS NOT NULL;
CREATE UNIQUE INDEX chat_conv_visitor_token_uq ON public.chat_conversations(visitor_token) WHERE visitor_token IS NOT NULL;
CREATE INDEX chat_conv_last_idx ON public.chat_conversations(last_message_at DESC);

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id uuid NULL,
  sender_type text NOT NULL DEFAULT 'client' CHECK (sender_type IN ('client','convoyeur','admin','systeme','visiteur')),
  body text NOT NULL DEFAULT '',
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz NULL
);
CREATE INDEX chat_msg_conv_idx ON public.chat_messages(conversation_id, created_at);

CREATE TABLE public.chat_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  advisor_available boolean NOT NULL DEFAULT true,
  offline_message text NOT NULL DEFAULT 'Nos conseillers sont absents pour le moment. Laissez votre message, nous vous répondons dès notre retour.',
  quick_replies jsonb NOT NULL DEFAULT '["Bonjour, je regarde votre demande tout de suite.","Votre convoyeur est en route.","Pouvez-vous nous envoyer une photo ?","Merci, c''est bien noté."]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.chat_settings(id) VALUES (true);

GRANT SELECT, INSERT, UPDATE ON public.chat_conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.chat_messages TO authenticated;
GRANT SELECT, UPDATE ON public.chat_settings TO authenticated;
GRANT SELECT ON public.chat_settings TO anon;
GRANT ALL ON public.chat_conversations, public.chat_messages, public.chat_settings TO service_role;

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_settings ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.chat_is_admin(_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_uid,'admin') OR public.has_role(_uid,'super_admin')
$$;

CREATE OR REPLACE FUNCTION public.is_mission_convoyeur(_uid uuid, _mission_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.attributions a
    JOIN public.trajets t ON t.id = a.trajet_id
    JOIN public.convoyeurs c ON c.id = a.convoyeur_id
    WHERE t.mission_id = _mission_id AND c.user_id = _uid
      AND coalesce(a.statut,'') NOT IN ('annulee','refusee')
  )
$$;

CREATE OR REPLACE FUNCTION public.chat_can_access(_conv uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_conversations c
    WHERE c.id = _conv AND auth.uid() IS NOT NULL AND (
      public.chat_is_admin(auth.uid())
      OR (c.kind = 'mission_client' AND c.mission_id IS NOT NULL AND public.is_mission_client(auth.uid(), c.mission_id))
      OR (c.kind = 'mission_convoyeur' AND c.mission_id IS NOT NULL AND public.is_mission_convoyeur(auth.uid(), c.mission_id))
      OR (c.kind = 'conseiller' AND c.client_user_id = auth.uid())
    )
  )
$$;

CREATE POLICY chat_conv_select ON public.chat_conversations FOR SELECT TO authenticated USING (public.chat_can_access(id));
CREATE POLICY chat_conv_admin_update ON public.chat_conversations FOR UPDATE TO authenticated USING (public.chat_is_admin(auth.uid())) WITH CHECK (public.chat_is_admin(auth.uid()));
CREATE POLICY chat_conv_insert_conseiller ON public.chat_conversations FOR INSERT TO authenticated
  WITH CHECK (kind = 'conseiller' AND client_user_id = auth.uid() AND mission_id IS NULL AND visitor_token IS NULL);

CREATE POLICY chat_msg_select ON public.chat_messages FOR SELECT TO authenticated USING (public.chat_can_access(conversation_id));
CREATE POLICY chat_msg_insert ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.chat_can_access(conversation_id));
CREATE POLICY chat_msg_update_read ON public.chat_messages FOR UPDATE TO authenticated
  USING (public.chat_can_access(conversation_id)) WITH CHECK (public.chat_can_access(conversation_id));

CREATE POLICY chat_settings_read ON public.chat_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY chat_settings_admin ON public.chat_settings FOR UPDATE TO authenticated USING (public.chat_is_admin(auth.uid())) WITH CHECK (public.chat_is_admin(auth.uid()));

-- Server-side sender typing: never trust the client
CREATE OR REPLACE FUNCTION public.chat_messages_before_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k text;
BEGIN
  SELECT kind INTO k FROM public.chat_conversations WHERE id = NEW.conversation_id;
  IF NEW.sender_id IS NULL THEN
    IF NEW.sender_type NOT IN ('visiteur','systeme') THEN NEW.sender_type := 'systeme'; END IF;
  ELSIF public.chat_is_admin(NEW.sender_id) THEN
    NEW.sender_type := 'admin';
  ELSIF k = 'mission_convoyeur' THEN
    NEW.sender_type := 'convoyeur';
  ELSE
    NEW.sender_type := 'client';
  END IF;
  NEW.body := left(coalesce(NEW.body,''), 4000);
  NEW.read_at := NULL;
  NEW.created_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER chat_messages_bi BEFORE INSERT ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public.chat_messages_before_insert();

CREATE OR REPLACE FUNCTION public.chat_messages_after_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.chat_conversations;
BEGIN
  SELECT * INTO c FROM public.chat_conversations WHERE id = NEW.conversation_id;
  UPDATE public.chat_conversations SET
    last_message_at = NEW.created_at,
    last_message_preview = left(CASE WHEN NEW.body = '' THEN 'Pièce jointe' ELSE NEW.body END, 140),
    unread_admin = CASE WHEN NEW.sender_type IN ('client','convoyeur','visiteur') THEN unread_admin + 1 ELSE unread_admin END,
    unread_participant = CASE WHEN NEW.sender_type IN ('admin','systeme') THEN unread_participant + 1 ELSE unread_participant END,
    status = CASE WHEN NEW.sender_type IN ('client','convoyeur','visiteur') AND status = 'resolue' THEN 'ouverte' ELSE status END
  WHERE id = NEW.conversation_id;
  IF NEW.sender_type IN ('client','convoyeur','visiteur') THEN
    INSERT INTO public.admin_notifications(type, titre, message, link, entity_type, entity_id, metadata)
    VALUES ('chat_message',
      CASE c.kind WHEN 'mission_client' THEN 'Message client' WHEN 'mission_convoyeur' THEN 'Message convoyeur' ELSE 'Message conseiller' END
        || coalesce(' · ' || c.mission_reference, ''),
      left(NEW.body, 160),
      CASE WHEN c.kind = 'conseiller' THEN '/admin/messagerie-conseiller' ELSE '/admin/messagerie' END,
      'chat_conversation', c.id, jsonb_build_object('kind', c.kind));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER chat_messages_ai AFTER INSERT ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public.chat_messages_after_insert();

-- Open (or fetch) the mission conversation the caller is allowed to use
CREATE OR REPLACE FUNCTION public.chat_open_mission(_mission_id uuid, _kind text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); cid uuid; ref text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _kind NOT IN ('mission_client','mission_convoyeur') THEN RAISE EXCEPTION 'invalid kind'; END IF;
  IF NOT public.chat_is_admin(uid) THEN
    IF _kind = 'mission_client' AND NOT public.is_mission_client(uid, _mission_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF _kind = 'mission_convoyeur' AND NOT public.is_mission_convoyeur(uid, _mission_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  END IF;
  SELECT id INTO cid FROM public.chat_conversations WHERE mission_id = _mission_id AND kind = _kind;
  IF cid IS NOT NULL THEN RETURN cid; END IF;
  SELECT numero INTO ref FROM public.missions WHERE id = _mission_id;
  INSERT INTO public.chat_conversations(kind, mission_id, mission_reference, source)
  VALUES (_kind, _mission_id, ref, CASE WHEN _kind='mission_convoyeur' THEN 'convoyeur' ELSE 'client_connecte' END)
  ON CONFLICT (mission_id, kind) WHERE mission_id IS NOT NULL DO UPDATE SET mission_reference = EXCLUDED.mission_reference
  RETURNING id INTO cid;
  RETURN cid;
END $$;

CREATE OR REPLACE FUNCTION public.chat_mark_read(_conv uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.chat_can_access(_conv) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF public.chat_is_admin(auth.uid()) THEN
    UPDATE public.chat_conversations SET unread_admin = 0 WHERE id = _conv;
    UPDATE public.chat_messages SET read_at = now() WHERE conversation_id = _conv AND read_at IS NULL AND sender_type IN ('client','convoyeur','visiteur');
  ELSE
    UPDATE public.chat_conversations SET unread_participant = 0 WHERE id = _conv;
    UPDATE public.chat_messages SET read_at = now() WHERE conversation_id = _conv AND read_at IS NULL AND sender_type IN ('admin','systeme');
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.chat_open_mission(uuid,text), public.chat_mark_read(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.chat_open_mission(uuid,text), public.chat_mark_read(uuid), public.chat_can_access(uuid), public.chat_is_admin(uuid), public.is_mission_convoyeur(uuid,uuid) TO authenticated;

ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.chat_conversations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;