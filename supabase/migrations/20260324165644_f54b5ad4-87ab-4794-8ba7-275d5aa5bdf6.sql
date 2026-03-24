ALTER TABLE public.quiz_completions 
ADD COLUMN IF NOT EXISTS email_4_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS email_5_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS purchased_course boolean DEFAULT false;