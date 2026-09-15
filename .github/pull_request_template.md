# Pull request

## Summary

<!-- One short paragraph: what this changes and why. -->

## What changed

- 

## Checks run

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `deno test` for `supabase/functions/_shared`
- [ ] `astro build`

## Edge Functions (only if `supabase/functions/` changed)

- [ ] Redeployed every function in the transitive import closure of the changed files
- [ ] Ran the stale sweep: `python "Biblical Herbalism/scripts/ef_stale_sweep.py" --repo <path to this repo>` and it exited 0

## Migrations (only if a migration is added)

- How it is applied:
- Where it is recorded:

## Screenshots

<!-- Required for visual changes. Before and after. -->

## Founder-facing copy changes

<!-- Paste every new or changed customer-facing string verbatim. -->
