
-- 1) Storage: deny all direct client access to the private 'constitution-guides' bucket.
-- Service-role (edge functions) bypasses RLS, so server-side reads/writes still work.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Deny client access to constitution-guides'
  ) THEN
    CREATE POLICY "Deny client access to constitution-guides"
    ON storage.objects
    AS RESTRICTIVE
    FOR ALL
    TO public
    USING (bucket_id <> 'constitution-guides')
    WITH CHECK (bucket_id <> 'constitution-guides');
  END IF;
END $$;

-- 2) quiz_completions: convert RESTRICTIVE false policy to a clearer PERMISSIVE deny-all.
-- Semantically identical (no permissive policies => no client access), but removes the linter warning.
DROP POLICY IF EXISTS "No direct client access" ON public.quiz_completions;
CREATE POLICY "No direct client access"
ON public.quiz_completions
AS PERMISSIVE
FOR ALL
TO public
USING (false)
WITH CHECK (false);
