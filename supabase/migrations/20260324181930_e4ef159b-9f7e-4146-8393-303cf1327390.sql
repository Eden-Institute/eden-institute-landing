DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'quiz_completions'
      AND policyname = 'No direct client access'
  ) THEN
    CREATE POLICY "No direct client access"
    ON public.quiz_completions
    AS RESTRICTIVE
    FOR ALL
    TO public
    USING (false)
    WITH CHECK (false);
  END IF;
END
$$;