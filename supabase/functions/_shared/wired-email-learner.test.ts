// W8b: learner emails 2-10 + July, built word for word from the approved copy (answer 35).
import { assert, assertEquals, assertStringIncludes, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildJulyEmail, buildLearnerEmail, DRIP_DAYS, em6BlueprintBuyers, firstSmallTaste, learnerCopy, prayerFor, waysToServe } from "./wired-email-learner.ts";

const base = {
  firstName: "Anna",
  child: { nickname: "Lily", topId: "storyteller", lowest3: ["organizer", "maker", "seeker"] },
  resultsToken: "tok.en",
  kids: 2,
  blueprintPageImageUrl: "https://edeninstitute.health/wired/email/blueprint-math-storyteller.png",
  match: { name: "Sonlight", reason: "Serves 2 of Lily's top 3: Storyteller and Ponderer", line: "A literature-rich, all-in-one program.", url: "https://www.sonlight.com/?ref=eden", isAffiliate: true, priority: "less prep for me" },
  bookWaitlistUrl: null,
};
const KEYS = ["em-2", "em-3", "em-4", "em-5", "em-6", "em-7", "em-8", "em-10"] as const;
const noBrackets = (s: string) => !/\[[^\]]*\]/.test(s.replace(/\{\{UNSUB_URL\}\}/g, ""));

Deno.test("every learner email 2-10 builds with no unfilled placeholder, no em dash, the learner footer", () => {
  for (const k of KEYS) {
    const m = buildLearnerEmail(k, base);
    assert(noBrackets(m.text), `${k}: ${m.text}`);
    assert(!m.html.includes("—") && !m.text.includes("—"), k);
    assertStringIncludes(m.html, "{{UNSUB_URL}}");
    assertStringIncludes(m.text, "You're getting this because you took the Fearfully & Wonderfully Wired quiz.");
    assertStringIncludes(m.html, "303 Holly Cir, Unit 3262, Clarksville, TN 37043");
    assert(m.subject.length > 0 && !m.subject.includes("["), k);
  }
});

Deno.test("subjects and the drip days are the approved ones", () => {
  assertEquals(buildLearnerEmail("em-2", base).subject, "What a Storyteller looks like at home");
  assertEquals(buildLearnerEmail("em-3", base).subject, "A quick hello from me");
  assertEquals(buildLearnerEmail("em-4", base).subject, "A plan built around Lily");
  assertEquals(buildLearnerEmail("em-5", base).subject, "Lily's growing edges");
  assertEquals(buildLearnerEmail("em-10", base).subject, "The last note in this series");
  assertEquals(DRIP_DAYS, { 2: 2, 3: 4, 4: 7, 5: 10, 6: 13, 7: 16, 8: 20, 9: 25, 10: 30 });
});

Deno.test("em-3 carries Camila's own sentence word for word", () => {
  const m = buildLearnerEmail("em-3", base);
  assertStringIncludes(m.text, "On the podcasts I have gone on where I have made the claim to start with the child, I often get asked \"how\" so I decided to build a tool that helps moms with the how.");
  for (const line of learnerCopy("em-3").filter((i) => i.t === "p").map((i) => i.s)) {
    if (line.startsWith("Hi ") || /^(When|Subject|Preview|Footer|Button):/.test(line)) continue;
    assertStringIncludes(m.text, line.replace("[Nickname]", "Lily"));
  }
});

Deno.test("em-2 pastes the approved write-up paragraphs; results button carries her token and the learner tags", () => {
  const m = buildLearnerEmail("em-2", base);
  assert(m.text.includes("Here's what that can look like at home:"));
  assertEquals(m.buttonUrls.length, 1);
  assertStringIncludes(m.buttonUrls[0], "https://edeninstitute.health/wired/results?t=tok.en");
  assertStringIncludes(m.html, "utm_content=email_2");
  assertStringIncludes(m.html, "utm_campaign=learner_quiz");
});

Deno.test("em-5: 3 lowest named lowest first, the first approved small taste for the lowest", () => {
  const m = buildLearnerEmail("em-5", base);
  assertStringIncludes(m.text, "Lily's growing edges right now: Organizer, Maker and Seeker.");
  assertStringIncludes(m.text, `One small thing to try this week: ${firstSmallTaste("organizer").replace(/\[Nickname\]/g, "Lily")}`);
  assertThrows(() => buildLearnerEmail("em-5", { ...base, child: { nickname: "Lily", topId: "storyteller" } }));
});

Deno.test("em-6: one-child families get the approved one-child first paragraph", () => {
  const one = buildLearnerEmail("em-6", { ...base, kids: 1 }).text;
  assertStringIncludes(one, "Ever notice that you and Lily are wired differently? You might love a plan while Lily loves to explore. Knowing both helps.");
  assert(!one.includes("If you're teaching more than one child"));
  assertStringIncludes(buildLearnerEmail("em-6", base).text, "If you're teaching more than one child");
});

Deno.test("em-6: a Blueprint buyer (this quiz year) gets the approved $28 line in place of the $47 sentence", () => {
  const swap = em6BlueprintBuyers();
  assertEquals(swap, { from: "It's $47 for up to 5 kids.", to: "You already have [Nickname]'s Blueprint, so the Family Map is $28 for you this school year." });
  // The Blueprint may be for another child: the line names that child.
  const bp = buildLearnerEmail("em-6", { ...base, blueprintNickname: "Ben" }).text;
  assertStringIncludes(bp, "how your kids' wirings work together. You already have Ben's Blueprint, so the Family Map is $28 for you this school year.");
  assert(!bp.includes("$47"));
  assertStringIncludes(bp, "Because it's a digital download, all sales are final.");
  // Everyone else keeps the $47 sentence, and so does a null nickname.
  for (const o of [base, { ...base, blueprintNickname: null }]) {
    const t = buildLearnerEmail("em-6", o).text;
    assertStringIncludes(t, "It's $47 for up to 5 kids.");
    assert(!t.includes("$28"));
  }
  // Works with the one-child first paragraph too.
  const one = buildLearnerEmail("em-6", { ...base, kids: 1, blueprintNickname: "Lily" }).text;
  assertStringIncludes(one, "Ever notice that you and Lily are wired differently?");
  assertStringIncludes(one, "You already have Lily's Blueprint, so the Family Map is $28 for you this school year.");
});

Deno.test("em-7: her priority, the match, the curriculum's own link with the commission label, no Eden tags", () => {
  const m = buildLearnerEmail("em-7", base);
  assertStringIncludes(m.text, "You told me what matters most to you right now: less prep for me.");
  assertStringIncludes(m.text, "Sonlight: Serves 2 of Lily's top 3: Storyteller and Ponderer. A literature-rich, all-in-one program.");
  assertEquals(m.buttonUrls, ["https://www.sonlight.com/?ref=eden"]);
  assertStringIncludes(m.html, "Eden earns a commission");
  assert(!m.html.includes("utm_campaign=learner_quiz"));
  assert(!buildLearnerEmail("em-7", { ...base, match: { ...base.match, isAffiliate: false } }).html.includes("Eden earns a commission"));
});

Deno.test("em-8: the 3 approved ways to serve and the approved prayer for the top wiring; 'an Organizer'", () => {
  const m = buildLearnerEmail("em-8", base);
  for (const w of waysToServe("storyteller")) assertStringIncludes(m.text, `- ${w.replace(/\[Nickname\]/g, "Lily")}`);
  assertStringIncludes(m.text, prayerFor("storyteller").replace(/\[Nickname\]/g, "Lily"));
  const org = buildLearnerEmail("em-8", { ...base, child: { ...base.child, topId: "organizer" } }).text;
  assertStringIncludes(org, "A few ways an Organizer can serve right now:");
});

Deno.test("em-4 shows the real Blueprint page image; em-10 drops the book line without a waitlist link", () => {
  assertStringIncludes(buildLearnerEmail("em-4", base).html, 'src="https://edeninstitute.health/wired/email/blueprint-math-storyteller.png"');
  assertThrows(() => buildLearnerEmail("em-4", { ...base, blueprintPageImageUrl: undefined }));
  const ten = buildLearnerEmail("em-10", base);
  assert(!ten.text.includes("Unschooled by Design"));
  assertStringIncludes(ten.buttonUrls[0], "https://edeninstitute.health/wired?");
  assertStringIncludes(buildLearnerEmail("em-10", { ...base, bookWaitlistUrl: "https://edeninstitute.health/book" }).text, "join the book waitlist: https://edeninstitute.health/book");
});

Deno.test("July: one email per family, one button per child, each child's next grade", () => {
  const kids = [
    { nickname: "Lily", topId: "storyteller", nextGrade: "3", retakeUrl: "https://edeninstitute.health/wired?r=a" },
    { nickname: "Sam", topId: "maker", nextGrade: "1", retakeUrl: "https://edeninstitute.health/wired?r=b" },
  ];
  const m = buildJulyEmail("em-july1", { ...base, children: kids });
  assertEquals(m.subject, "Time for Lily and Sam's yearly check-in");
  assertEquals(m.buttonUrls.length, 2);
  assertStringIncludes(m.text, "We'll assume Lily is moving up to grade 3.");
  assertStringIncludes(m.text, "We'll assume Sam is moving up to grade 1.");
  assertStringIncludes(m.html, "utm_content=july_1");
  const r = buildJulyEmail("em-july15", { ...base, children: [kids[0]] });
  assertEquals(r.subject, "Still time for Lily's check-in");
  assert(noBrackets(r.text));
});

Deno.test("em-2 subject reads 'an Organizer' (a/an fixed in the subject and preview too, as in the body)", () => {
  const m = buildLearnerEmail("em-2", { firstName: "Sarah", child: { nickname: "Sam", topId: "organizer" }, resultsToken: "t" });
  assertEquals(m.subject, "What an Organizer looks like at home");
  assertEquals(m.preview.includes(" a O"), false);
});
