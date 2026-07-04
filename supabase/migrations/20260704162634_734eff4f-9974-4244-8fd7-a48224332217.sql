
-- 1. Add columns to user_notifications
ALTER TABLE public.user_notifications
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'systeme',
  ADD COLUMN IF NOT EXISTS deep_link text,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS dedup_key text,
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS entity_id uuid;

CREATE INDEX IF NOT EXISTS idx_user_notifications_dedup
  ON public.user_notifications(user_id, dedup_key, created_at DESC)
  WHERE dedup_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_notifications_category
  ON public.user_notifications(user_id, category, created_at DESC);

-- 2. notification_preferences table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('push','email','in_app')),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category, channel)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own prefs" ON public.notification_preferences
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user writes own prefs" ON public.notification_preferences
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "user updates own prefs" ON public.notification_preferences
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "user deletes own prefs" ON public.notification_preferences
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER trg_notif_prefs_updated
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. RPC create_user_notification (security definer, dedup 5 min)
CREATE OR REPLACE FUNCTION public.create_user_notification(
  _user_id uuid,
  _type text,
  _titre text,
  _message text DEFAULT NULL,
  _link text DEFAULT NULL,
  _category text DEFAULT 'systeme',
  _priority text DEFAULT 'normal',
  _dedup_key text DEFAULT NULL,
  _entity_type text DEFAULT NULL,
  _entity_id uuid DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_existing uuid;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'user_id required'; END IF;
  IF _titre IS NULL OR length(trim(_titre)) = 0 OR length(_titre) > 300 THEN
    RAISE EXCEPTION 'Invalid title';
  END IF;
  IF _message IS NOT NULL AND length(_message) > 2000 THEN
    RAISE EXCEPTION 'Message too long';
  END IF;
  IF _link IS NOT NULL AND length(_link) > 500 THEN
    RAISE EXCEPTION 'Link too long';
  END IF;
  IF _category NOT IN ('mission','paiement','document','message','systeme','compte') THEN
    _category := 'systeme';
  END IF;
  IF _priority NOT IN ('low','normal','high','urgent') THEN
    _priority := 'normal';
  END IF;

  IF _dedup_key IS NOT NULL THEN
    SELECT id INTO v_existing
    FROM public.user_notifications
    WHERE user_id = _user_id
      AND dedup_key = _dedup_key
      AND created_at > now() - INTERVAL '5 minutes'
    LIMIT 1;
    IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
  END IF;

  INSERT INTO public.user_notifications
    (user_id, type, titre, message, link, deep_link, category, priority, dedup_key,
     entity_type, entity_id, metadata)
  VALUES
    (_user_id, _type, trim(_titre), _message, _link, _link, _category, _priority, _dedup_key,
     _entity_type, _entity_id, coalesce(_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_user_notification(uuid,text,text,text,text,text,text,text,text,uuid,jsonb) TO authenticated, service_role;

-- 4. Realtime
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
