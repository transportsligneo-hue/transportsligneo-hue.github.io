CREATE TABLE public.chat_tool_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.assistant_conversations(id) ON DELETE CASCADE,
  session_token text,
  tool_name text NOT NULL,
  arguments jsonb NOT NULL DEFAULT '{}'::jsonb,
  success boolean NOT NULL DEFAULT false,
  error_message text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.chat_tool_calls TO authenticated;
GRANT ALL ON public.chat_tool_calls TO service_role;

ALTER TABLE public.chat_tool_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read chat tool calls"
  ON public.chat_tool_calls FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX idx_chat_tool_calls_created_at ON public.chat_tool_calls (created_at DESC);
CREATE INDEX idx_chat_tool_calls_conversation ON public.chat_tool_calls (conversation_id);