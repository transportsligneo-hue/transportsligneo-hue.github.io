
-- Allow newly registered users to insert their own convoyeur record
CREATE POLICY "Users can insert own convoyeur record"
ON public.convoyeurs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow newly registered users to insert their own role
CREATE POLICY "Users can insert own role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
