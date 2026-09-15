// supabase/functions/_shared/send-confirm.ts
//
// Type-to-confirm for a real list send (founder decision 2026-09-15). A list
// blast only proceeds when the request repeats the campaign name that preview
// returned, so a send cannot go out by re-running an old command, or a copy of
// last week's curl, against a function that has since been edited to a new
// campaign. Exact match after trimming surrounding whitespace; case matters,
// because the campaign key is the idempotency key and is compared exactly.

export type ConfirmCheck = { ok: true } | { ok: false; error: string };

export function checkCampaignConfirm(provided: unknown, campaign: string): ConfirmCheck {
  if (provided === undefined || provided === null || provided === '') {
    return {
      ok: false,
      error:
        `confirm_campaign is required for a real send. Nothing was sent. Run preview first and pass its campaign value exactly: "${campaign}".`,
    };
  }
  if (typeof provided !== 'string') {
    return { ok: false, error: 'confirm_campaign must be a string (the campaign name preview returned). Nothing was sent.' };
  }
  if (provided.trim() !== campaign) {
    return {
      ok: false,
      error: `confirm_campaign "${provided.trim().slice(0, 120)}" does not match this function's campaign "${campaign}". ` +
        'Nothing was sent. Run preview again and check this is the email you mean to send.',
    };
  }
  return { ok: true };
}
