-- Partner / collaborator / co-op / investor inquiries captured from the
-- public marketing site (homepage "Get Involved" + /homeschool group licensing).
-- Source of truth for the capture-then-book flow; submit-partner-inquiry EF
-- writes here (service role) and mirrors to hello@. RLS-walled, service-role
-- only, mirroring feedback_submissions (Lock #15 pattern).

CREATE TABLE IF NOT EXISTS public.partner_inquiries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  inquiry_type  text NOT NULL,            -- brand | creator | venture | investor | coop | pod | ministry | program
  source_page   text,                     -- home | homeschool
  name          text NOT NULL,
  email         text NOT NULL,
  org_name      text,                      -- business / show / organization name
  website       text,                      -- website, social, or LinkedIn
  audience_size text,                      -- creators: audience/list size (free text)
  group_size    integer,                   -- co-ops: number of children
  message       text,
  status        text NOT NULL DEFAULT 'new', -- new | contacted | approved | declined | booked
  context       jsonb NOT NULL DEFAULT '{}'::jsonb,
  auth_user_id  uuid
);

COMMENT ON TABLE public.partner_inquiries IS
  'Partner/collaborator/co-op/investor inquiries from the public site. Written by submit-partner-inquiry EF (service role), mirrored to hello@. RLS service-role only. status drives investor capture-then-approve.';

ALTER TABLE public.partner_inquiries ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS partner_inquiries_created_at_idx
  ON public.partner_inquiries (created_at DESC);
CREATE INDEX IF NOT EXISTS partner_inquiries_type_idx
  ON public.partner_inquiries (inquiry_type);
CREATE INDEX IF NOT EXISTS partner_inquiries_status_idx
  ON public.partner_inquiries (status);
