# Online Year thank-you page + order-page error lines (snapshot)

Copied VERBATIM, by script, from EdensTable_Digital_License_Plan.md "After checkout + order-page errors" on 2026-11-25
(plan file lines 189-210). Source of truth stays the plan file; this snapshot is what
src/test/onlineYearCopy.test.ts pins web/lib/onlineYearCopy.ts (OY_APPROVED_THANK_YOU, OY_APPROVED_ORDER_ERRORS) and
create-checkout's Online Year error lines against. Do not hand-edit.

**After checkout + order-page errors** (APPROVED by Camila 2026-11-25 12:21 PM CT, review page https://claude.ai/artifact/KmTbr6gswSDytGPRdwvRyx, all 3 "Use this one", no notes; NP found the gap in the OY2 QA: the Stripe success page /online-year/thank-you did not exist)

Thank-you page (`/online-year/thank-you`; Seedlings buyers see Seedlings (3-5) and "Open Seedlings"; names and end date from the order):
- Heading: Thank you! Your Online Year of Sprouts (K-2) is ready.
- [Child]'s year runs through [end date]. (With two or more children: [Child] and [Child]'s years run through [end date].)
- Button: Open Sprouts (to the Online Year sign-in page)
- Start with Week 1 in the Teacher's Guide; it lays out each day for you. When it's time for Notebook pages, tap Print, and [Child]'s name goes on every page.
- You'll sign in with the email you used at checkout. Each time you use a new device, we'll email you a code. It works on 3 devices with one child, plus one more for each sibling.
- We just sent you an email with all of this too.
- If anything isn't working, email hello@edeninstitute.health and we'll fix it.

Same page while the order is still being set up (only if the page opens before the order is recorded):
- Heading: Thank you! Your order went through.
- We're setting up your Online Year now. Your welcome email is on its way, and it has everything you need to get started.
- If it hasn't arrived in 10 minutes, check your spam folder or email hello@edeninstitute.health and we'll fix it.

Order page error lines (replace "Something went wrong. Please refresh the page and try again." for these cases):
- Name with numbers or symbols: Please type just your child's first name or nickname, using letters only.
- Same name twice: You typed the same name twice. Please give each child their own name or nickname.
- Email doesn't work: Please check your email address. It's how you'll sign in.
- More than 10 children: For a family this size, email hello@edeninstitute.health and we'll set it up for you.
- Checkout not set up yet: Checkout isn't quite ready. Please try again shortly, or email hello@edeninstitute.health.
