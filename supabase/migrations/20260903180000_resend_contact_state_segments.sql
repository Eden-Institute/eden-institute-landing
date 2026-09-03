-- Record which Resend segments each contact was last placed in.
--
-- Resend segments are static membership groups (no filter builder, and the
-- Segments API takes a name only), so contact-properties-sync maintains the
-- membership itself from SEGMENT_RULES in _shared/resend-contacts.ts. This
-- column is what it diffs against; it holds segment NAMES, not ids, so a
-- segment recreated under the same name keeps working.

alter table public.resend_contact_state
  add column if not exists segments text[] not null default '{}';

comment on column public.resend_contact_state.segments is
  'Resend segment names this contact was last added to by contact-properties-sync (SEGMENT_RULES).';
