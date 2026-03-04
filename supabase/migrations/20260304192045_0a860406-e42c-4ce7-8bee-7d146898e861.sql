CREATE TABLE public.quiz_completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  constitution_type TEXT NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  email_1_sent_at TIMESTAMP WITH TIME ZONE,
  email_2_sent_at TIMESTAMP WITH TIME ZONE,
  email_3_sent_at TIMESTAMP WITH TIME ZONE
);

-- No RLS needed - this table is only accessed by edge functions via service role
ALTER TABLE public.quiz_completions ENABLE ROW LEVEL SECURITY;

-- Index for the cron query
CREATE INDEX idx_quiz_completions_pending ON public.quiz_completions (completed_at)
WHERE email_1_sent_at IS NULL OR email_2_sent_at IS NULL OR email_3_sent_at IS NULL;