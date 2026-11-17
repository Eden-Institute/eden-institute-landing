// Click-to-open rate for the founder dashboard's Emails tab (2026-11-17, Lane 2 area 10 D3).
// People who clicked / people who opened. It used total clicks / total opens, so one reader clicking
// three links counted three times and the rate could pass 100%. founder_email_engagement already
// returns the unique counts for exactly this.
export function ctr(uniqueClicks: number, uniqueOpens: number): string {
  return uniqueOpens > 0 ? `${((uniqueClicks / uniqueOpens) * 100).toFixed(0)}%` : "—";
}
