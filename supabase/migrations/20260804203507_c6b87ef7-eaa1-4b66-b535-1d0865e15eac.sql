CREATE TABLE public.assistant_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token text NOT NULL,
  message_count integer NOT NULL DEFAULT 0,
  needs_human boolean NOT NULL DEFAULT false,
  contact_nom text,
  contact_telephone text,
  contact_email text,
  page_origine text,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.assistant_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.assistant_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX assistant_messages_conv_idx ON public.assistant_messages(conversation_id, created_at);
CREATE INDEX assistant_conversations_last_idx ON public.assistant_conversations(last_message_at DESC);

GRANT SELECT ON public.assistant_conversations TO authenticated;
GRANT SELECT ON public.assistant_messages TO authenticated;
GRANT ALL ON public.assistant_conversations TO service_role;
GRANT ALL ON public.assistant_messages TO service_role;

ALTER TABLE public.assistant_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read assistant conversations"
ON public.assistant_conversations FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can read assistant messages"
ON public.assistant_messages FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));