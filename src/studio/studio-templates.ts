// Starter templates (Ad Studio Phase 8).
//
// Three campaign shapes Camila already runs repeatedly. A template pre-fills
// the entry screen and seeds the working state so a new project opens with a
// structure rather than a blank canvas.
//
// DELIBERATE: templates carry STRUCTURE and PROMPTS, not finished marketing
// claims. Every text field is scaffolding written to be replaced, and the
// bracketed prompts make that obvious at a glance. Shipping invented copy as a
// default is how an unreviewed claim ends up in a paid ad, and the copy engine
// already exists for writing the real thing.
//
// Per the spec's sequencing note these three are a starting set, to be expanded
// once real ad cycles show which patterns actually recur.

import type { StudioStateBlob } from "./studio-types";

export interface StudioTemplate {
  id: string;
  name: string;
  when: string;
  product: string;
  adType: string;
  campaignTag: string;
  /** Seeds the core's working state. Everything here stays fully editable. */
  state: StudioStateBlob;
}

export const STUDIO_TEMPLATES: StudioTemplate[] = [
  {
    id: "preorder",
    name: "Preorder announcement",
    when: "A dated window is open and the ask is to buy now.",
    product: "kit",
    adType: "feed",
    campaignTag: "general",
    state: {
      campaign: { product: "kit", objective: "sales", audience: "homeschool", angle: "preorder" },
      builder: {
        tpl: "label",
        hook: "[The offer, in five words]",
        sub: "[What they get, and by when]",
        cta: "Preorder Now",
        domain: "edeninstitute.health/homeschool",
      },
      layers: [
        { id: "T1", text: "[Headline]", x: 0.5, y: 0.18, size: 78,
          font: "display", color: "forest", align: "center", weight: 700, shadow: false },
        { id: "T2", text: "[Dated detail: opens, closes, or how many]", x: 0.5, y: 0.86, size: 34,
          font: "serif", color: "walnut", align: "center", weight: 400, shadow: false },
      ],
      caption: "[Open with the reason this matters now.]\n\n[What it is, in one sentence.]\n\n[The date or the limit, stated plainly.]",
    },
  },
  {
    id: "testimonial",
    name: "Testimonial",
    when: "A real family's words are the argument.",
    product: "kit",
    adType: "feed",
    campaignTag: "general",
    state: {
      campaign: { product: "kit", objective: "traffic", audience: "homeschool", angle: "children" },
      builder: {
        tpl: "photo",
        hook: "[Their words, trimmed to one line]",
        sub: "[First name, and what makes them credible]",
        cta: "Learn More",
        domain: "edeninstitute.health/homeschool",
      },
      layers: [
        { id: "T1", text: "“[The quote, in their voice, not yours]”", x: 0.5, y: 0.62, size: 56,
          font: "serif", color: "linen", align: "center", weight: 400, shadow: true },
        { id: "T2", text: "[Name, and their context]", x: 0.5, y: 0.80, size: 30,
          font: "display", color: "amber", align: "center", weight: 700, shadow: true },
      ],
      caption: "[The quote again, in full.]\n\n[One line of context: who they are, how long they have used it.]\n\n[What a reader should do next.]",
    },
  },
  {
    id: "reveal",
    name: "Curriculum reveal",
    when: "Showing what is actually inside the box.",
    product: "kit",
    adType: "carousel",
    campaignTag: "general",
    state: {
      campaign: { product: "kit", objective: "awareness", audience: "homeschool", angle: "openandgo" },
      builder: {
        tpl: "forest",
        hook: "[What it is, plainly]",
        sub: "[The one detail that surprises people]",
        cta: "Learn More",
        domain: "edeninstitute.health/homeschool",
      },
      layers: [
        { id: "T1", text: "[Component name]", x: 0.5, y: 0.14, size: 72,
          font: "display", color: "amber", align: "center", weight: 700, shadow: false },
        { id: "T2", text: "[What a parent does with it]", x: 0.5, y: 0.88, size: 32,
          font: "serif", color: "linen", align: "center", weight: 400, shadow: true },
      ],
      caption: "[Name the component.]\n\n[What it contains, concretely.]\n\n[Why it earns its place in the week.]",
    },
  },
];

export function templateById(id: string): StudioTemplate | undefined {
  return STUDIO_TEMPLATES.find((t) => t.id === id);
}
