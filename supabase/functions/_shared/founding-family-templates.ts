// supabase/functions/_shared/founding-family-templates.ts
//
// FOUNDING FAMILY CHECK-INS: short personal notes from Camila to every Starter Unit and
// printed-set buyer. Rows live in public.founding_family_queue (migration 20261008230000),
// drained by nurture-emails. Founder spec 2026-10-08; the copy is the founder-approved text in
// Biblical Herbalism/Eden's Table (Homeschool Curriculum)/Projects/Email Journeys and Nurture/
// Founding_Family_Sequences_2026-10-08.docx. Change the wording THERE first, then here.
//
// Deliberately plain: no banner, no button, no newsletter chrome. These are meant to read like
// an email Camila typed, because the whole point is that families write back. Replies do NOT
// stop the sequence (founder 2026-10-08); the scan lists them for Camila to answer personally.
//
// Voice rules: no em dashes, answer first, short. The Founding 50 group paragraph is included
// only while founding_family_settings.group_invite_open is true (off once 50 families join).

export type FoundingFamilyStep = 'd1' | 'd2' | 'd3' | 'd4' | 'd5' | 'p1' | 'p2' | 'p3' | 'p4' | 'p5';

export interface FoundingFamilyInput {
  firstName: string | null;
  band: string;            // 'Sprouts' | 'Seedlings' | 'Sprouts and Seedlings'
  groupInviteOpen: boolean;
  /** Bought before the sequence existed (backfilled 2026-10-08): wording must not assume "next day". */
  early?: boolean;
  /** Month they bought, e.g. "September" (early cohort wording). */
  startedMonth?: string;
}

const TEXT = '#3D3832';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function p(text: string): string {
  return `<p style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${TEXT};margin:0 0 16px 0;">${text}</p>`;
}

function wrap(body: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:24px 16px;background:#FFFFFF;">`
    + `<div style="max-width:560px;margin:0 auto;">${body}</div></body></html>`;
}

function hi(firstName: string | null): string {
  return p(`Hi ${esc(firstName || 'friend')},`);
}

const SIGN = p('In Him,<br>Camila');

const GROUP_INVITE = p(
  'I also have a private Facebook group just for our founding families, The Founding 50 · Eden&rsquo;s Table. '
  + 'In there you see new pages before anyone else does, you tell me the truth about them (kind, but honest), '
  + 'and we have Coffee and Curriculum, a live chat with me. Bring your mug! To join, go to '
  + '<a href="https://www.facebook.com/groups/foundingfifty" style="color:#2C3E2D;">facebook.com/groups/foundingfifty</a>. '
  + 'Facebook will ask three quick questions, and I will let you in myself.',
);

const CHECK_IN_ASK = 'Even one line back helps me so much.';

export function buildFoundingFamilyEmail(
  step: FoundingFamilyStep,
  input: FoundingFamilyInput,
): { subject: string; html: string } | null {
  const first = input.firstName;
  const band = esc(input.band);
  const subjName = first ? `, ${first}` : '';
  const invite = input.groupInviteOpen ? GROUP_INVITE : '';
  const early = input.early === true;
  const when = input.startedMonth ? ` back in ${esc(input.startedMonth)}` : '';

  switch (step) {
    case 'd1':
      return {
        subject: `Thank you${subjName}`,
        html: wrap(
          hi(first)
          + (early
            ? p(`I realized I never properly thanked you for starting the first nine weeks of ${band}${when}! You were one of the very first families to say yes, and that helped us launch Eden&rsquo;s Table more than you know. I truly appreciate you.`)
              + p('You are one of our founding families, so I would love to hear how it has been landing around your table with your littles. Expect a few short emails from me over the next few months, just to check in. I want to hear it all. The good, the bad and the ugly.')
            : p(`Thank you so much for starting the first nine weeks of ${band}! Every family who says yes this early is helping us launch Eden&rsquo;s Table, and I truly appreciate you.`)
              + p('You are one of our founding families, so I would love to hear how this is landing around your table with your littles. Expect a few short emails from me over the next few months, just to check in. I want to hear it all. The good, the bad and the ugly.'))
          + invite
          + p('You can reply to this email anytime. It comes straight to me.')
          + SIGN,
        ),
      };
    case 'd2':
      return {
        subject: 'How is it going at your table?',
        html: wrap(
          hi(first)
          + (early
            ? p(`You are probably well into your nine weeks by now, or life happened and you are somewhere in the middle. Both are completely normal!! How is ${band} going at your house?`)
            : p(`It has been about two weeks. How is ${band} going at your house?`))
          + p(`I would love to know which day your kids look forward to, and if anything has been a struggle. ${CHECK_IN_ASK}`)
          + SIGN,
        ),
      };
    case 'd3':
      return {
        subject: `Checking in${subjName}`,
        html: wrap(
          hi(first)
          + (early
            ? p('Your nine weeks have probably wrapped up by now, or life happened and you are still working through them. Both are completely normal!!')
              + p('How did it go? Is there a plant or a moment your kids still talk about? And honestly, is there anything you would change?')
            : p('You are probably near the end of your nine weeks by now, or life happened and you are somewhere in the middle. Both are completely normal!!')
              + p('How has it been? Is there a plant or a moment your kids still talk about? And honestly, is there anything you would change?'))
          + SIGN,
        ),
      };
    case 'd4':
      return {
        subject: 'Thinking of you today',
        html: wrap(
          hi(first)
          + p('I was thinking about our founding families today and wanted to check on you. How are your littles? Do they still stop and notice plants when you are out?')
          + p('Whatever school looks like at your house right now, I would love to hear how it is going.')
          + SIGN,
        ),
      };
    case 'd5':
      return {
        subject: 'Six months already',
        html: wrap(
          hi(first)
          + p(`It has been ${early ? 'a little over' : 'about'} six months since you started Eden&rsquo;s Table with us. Thank you for being one of the very first.`)
          + p('I would still love to hear how it is going, good, bad or ugly. And if it has been a blessing to your family, would you tell one friend about it? That is truly how this grows.')
          + SIGN,
        ),
      };
    case 'p1':
      return {
        subject: `Thank you${subjName}`,
        html: wrap(
          hi(first)
          + (early
            ? p(`I realized I never properly thanked you for ordering the printed ${band} year${when}! You were one of the very first families to get the books in hand, and that helped us launch Eden&rsquo;s Table more than you know. I truly appreciate you.`)
              + p('You are one of our founding families, so I would love to hear how this is landing around your table with your littles. Expect a few short emails from me over the next few months, just to check in. I want to hear it all. The good, the bad and the ugly.')
            : p(`Thank you so much for ordering the printed ${band} year! Every family who says yes this early is helping us launch Eden&rsquo;s Table, and I truly appreciate you. Your books are being printed just for you, and I will email you the day they ship.`)
              + p('You are one of our founding families, so I would love to hear how this lands around your table with your littles once the books arrive. Expect a few short emails from me over the next few months, just to check in. I want to hear it all. The good, the bad and the ugly.'))
          + invite
          + p('You can reply to this email anytime. It comes straight to me.')
          + SIGN,
        ),
      };
    case 'p2':
      return {
        subject: 'How was Week 1?',
        html: wrap(
          hi(first)
          + p(early
            ? 'Your books have been at your house a few weeks now. Have you started Week 1?'
            : 'Your books have been at your house about two weeks now. Have you started Week 1?')
          + p(`I would love to know how it went, which day your kids liked best, and if anything was confusing. ${CHECK_IN_ASK}`)
          + SIGN,
        ),
      };
    case 'p3':
      return {
        subject: `Checking in${subjName}`,
        html: wrap(
          hi(first)
          + p(`You are a couple of months into ${band} now, or life happened and you are a little behind. Both are completely normal!!`)
          + p('How has it been? Is there a plant or a moment your kids still talk about? And honestly, is there anything you would change?')
          + SIGN,
        ),
      };
    case 'p4':
      return {
        subject: 'Thinking of you today',
        html: wrap(
          hi(first)
          + p('I was thinking about our founding families today and wanted to check on you. How are your littles? Do they still stop and notice plants when you are out?')
          + p('I would love to hear where you are in the year and how it is going.')
          + SIGN,
        ),
      };
    case 'p5':
      return {
        subject: 'Six months already',
        html: wrap(
          hi(first)
          + p(`It has been about six months since your ${band} books arrived. Thank you for being one of the very first families to use them.`)
          + p('I would still love to hear how it is going, good, bad or ugly. And if it has been a blessing to your family, would you tell one friend about it? That is truly how this grows.')
          + SIGN,
        ),
      };
    default:
      return null;
  }
}

// Notes added to the existing shipped and delivered emails (order-messages.ts), printed sets only.
export const SHIPPED_NOTE =
  'Okay, I am a little giddy. Your books are really on their way, and I cannot wait for you to open that box. If you take a picture when it lands, I would love to see it!';
export const DELIVERED_NOTE =
  'This is my favorite part!! Somewhere in that box is the very first plant your kids are going to meet. Open the Teacher&rsquo;s Guide to Week 1 and read it together at the table. That is the whole method.';
