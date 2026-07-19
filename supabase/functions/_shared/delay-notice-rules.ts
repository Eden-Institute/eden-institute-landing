// The one rule in the delay-notice flow that must not be got wrong.
//
// 16 CFR 435.2(b) treats silence differently depending on the notice:
//
//   435.2(b)(1)(ii)  slip of 30 days or LESS, with a definite revised date
//                    -> silence is CONSENT. An opt-out notice is correct.
//
//   435.2(b)(1)(iii) slip of MORE than 30 days, or no definite date at all
//                    -> silence is CANCELLATION. Opt-in required, and every buyer
//                       who does not affirmatively reply must be refunded.
//
//   435.2(b)(2)      ANY second or subsequent notice for the same order
//                    -> opt-in ALWAYS, regardless of how small the new slip is.
//
// Sending an opt-out notice where the rule demands opt-in is itself a violation, and
// it is the failure mode with real money attached: it would leave orders standing that
// should have been cancelled and refunded. So every uncertain branch below resolves to
// TRUE. Over-asking for consent costs a click; under-asking costs compliance.
//
// Extracted from the edge function purely so it can be tested.

export interface OptInInput {
  /** The new date being promised, ISO yyyy-mm-dd. Null means we cannot give one. */
  revisedShipDate: string | null;
  /** The date currently promised to the buyer, ISO yyyy-mm-dd. */
  currentShipsOn: string | null;
  /** How many delay notices this order has already received. */
  priorNoticeCount: number;
}

export function requiresOptIn(input: OptInInput): boolean {
  const { revisedShipDate, currentShipsOn, priorNoticeCount } = input;

  // 435.2(b)(2): a second notice can never rely on silence.
  if (priorNoticeCount > 0) return true;

  // 435.2(b)(1)(i)+(iii): no definite revised date means opt-in.
  if (!revisedShipDate) return true;

  // Nothing to measure the slip against. Treat as indefinite rather than guess.
  if (!currentShipsOn) return true;

  const revised = Date.parse(`${revisedShipDate}T00:00:00Z`);
  const current = Date.parse(`${currentShipsOn}T00:00:00Z`);
  if (Number.isNaN(revised) || Number.isNaN(current)) return true;

  const slipDays = (revised - current) / 86_400_000;

  // Exactly 30 is "thirty (30) days or less", so it stays opt-out. Anything beyond
  // that, including a revised date that is somehow EARLIER (which would mean the
  // inputs are wrong), resolves to opt-in.
  if (slipDays < 0) return true;
  return slipDays > 30;
}
