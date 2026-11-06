/**
 * No Deep-Dive Guide offers a consultation (2026-11-06).
 *
 * Every guide used to close with a "1:1 Constitutional Consultation, coming soon" section
 * promising "a personalized herbal protocol, your specific herbs, your specific doses".
 * Camila is not an herbalist and does not practice, so no guide may offer one. It survived
 * the September redesign (#459) and the course removal (#630), so this locks it out of both
 * the guide data (which the PDF renders from) and the /guide web page.
 */

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import GuideTemplate from "@/components/guide/GuideTemplate";
import { GUIDES_BY_SLUG } from "../../supabase/functions/_shared/guide/registry";

// "1:1" only when it names a session, so Scripture references (Colossians 1:17) never trip it.
const OFFER = /consultation|\b1:1 (constitutional|consult|session)|one-on-one|personali[sz]ed (herbal )?protocol|specific doses/i;
const guides = Object.entries(GUIDES_BY_SLUG);

describe("Deep-Dive Guides never offer a consultation", () => {
  it("covers all 8 patterns", () => {
    expect(guides).toHaveLength(8);
  });

  it.each(guides)("%s guide data carries no consultation offer", (_slug, guide) => {
    expect(JSON.stringify(guide)).not.toMatch(OFFER);
    expect(guide).not.toHaveProperty("coachingCTA");
  });

  it.each(guides)("%s /guide page renders no consultation offer", (_slug, guide) => {
    const { container, unmount } = render(<GuideTemplate guide={guide} />);
    const text = container.textContent ?? "";
    expect(text).toContain("Your Next Step");
    expect(text).toContain("Back to Eden");
    expect(text).not.toMatch(OFFER);
    unmount();
  });
});
