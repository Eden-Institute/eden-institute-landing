// Shared "Shop Medicinal Herbs" CTA card. Rendered at the foot of every
// customer-facing email (nurture drip, quiz arcs, homeschool magnet + follow-ups,
// waitlist/beta/founders-club onboarding, and the Sprouts founders Email #1) so
// subscribers always have a one-tap path to buy herbs through our affiliate link.
//
// The icon is the exact mortar & pestle "Herbs Icon" from the Sprouts student
// notebooks (Canva asset MAGm1d7EJo0), recolored to the notebook green #4A7C59
// and hosted as a static asset at public/email/apothecary-icon.png. Self-contained
// colors (no per-file BRAND dependency) so it renders identically in every wrapper.
// Voice rule: no em dashes.

const SHOP_URL = 'https://edeninstitute.health/homeschool/herbs';
const ICON_URL = 'https://edeninstitute.health/email/apothecary-icon.png';

export function shopApothecaryCard(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0;"><tr><td style="padding-top:8px;">
<a href="${SHOP_URL}" target="_blank" style="text-decoration:none;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F0E8;border-left:3px solid #C5A44E;"><tr>
<td width="72" style="padding:16px 6px 16px 20px;vertical-align:middle;" valign="middle">
<img src="${ICON_URL}" width="46" height="46" alt="Mortar and pestle" style="display:block;border:0;outline:none;text-decoration:none;width:46px;height:46px;" />
</td>
<td style="padding:14px 20px 14px 6px;vertical-align:middle;" valign="middle">
<p style="font-family:Georgia,serif;font-size:17px;font-weight:bold;color:#2C3E2D;margin:0 0 4px 0;">Shop Medicinal Herbs</p>
<p style="font-family:Georgia,serif;font-size:14px;line-height:1.5;color:#3D3832;margin:0;">Organic, sustainably sourced herbs for every lesson and remedy, from growers we trust.</p>
</td>
</tr></table>
</a>
</td></tr></table>`;
}
