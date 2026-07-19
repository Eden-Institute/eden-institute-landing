// Starter templates (Ad Studio Phase 8).
//
// Three campaign shapes Camila already runs repeatedly. A template pre-fills
// the entry screen and seeds the flow's answers so a new campaign opens part
// way through the brief rather than on a blank first question.
//
// DELIBERATE: templates carry STRUCTURE and PROMPTS, not finished marketing
// claims. Every text field is scaffolding written to be replaced, and the
// bracketed prompts make that obvious at a glance. Shipping invented copy as a
// default is how an unreviewed claim ends up in a paid ad, and the copy engine
// already exists for writing the real thing.
//
// The seeds are FlowAnswers. They used to be the vanilla core's working blob,
// which the flow does not read, so choosing a template quietly prefilled
// nothing beyond the product and ad type.
//
// Per the spec's sequencing note these three are a starting set, to be expanded
// once real ad cycles show which patterns actually recur.

import type { FlowAnswers } from "./flow-graph";

export interface StudioTemplate {
  id: string;
  name: string;
  when: string;
  product: string;
  adType: string;
  campaignTag: string;
  /** Seeds the flow's answers. Everything here stays fully editable, and any
   *  question a template does not answer is still asked. */
  answers: FlowAnswers;
}

export const STUDIO_TEMPLATES: StudioTemplate[] = [
  {
    id: "preorder",
    name: "Preorder announcement",
    when: "A dated window is open and the ask is to buy now.",
    product: "kit",
    adType: "feed",
    campaignTag: "general",
    answers: {
      product: "kit", objective: "sales", audience: "homeschool", angle: "preorder",
      adType: "portrait", template: "label", treatment: "static", anchor: "bc",
      overlay: {
        hook: "[The offer, in five words]",
        sub: "[What they get, and by when]",
        cta: "Preorder Now",
      },
      caption: "[Open with the reason this matters now.]\n\n"
        + "[What it is, in one sentence.]\n\n"
        + "[The date or the limit, stated plainly.]",
    },
  },
  {
    id: "testimonial",
    name: "Testimonial",
    when: "A real family's words are the argument.",
    product: "kit",
    adType: "feed",
    campaignTag: "general",
    answers: {
      product: "kit", objective: "traffic", audience: "homeschool", angle: "children",
      adType: "portrait", template: "photo", treatment: "static", anchor: "bc",
      overlay: {
        hook: "[Their words, trimmed to one line]",
        sub: "[First name, and what makes them credible]",
        cta: "Learn More",
      },
      caption: "[The quote again, in full.]\n\n"
        + "[One line of context: who they are, how long they have used it.]\n\n"
        + "[What a reader should do next.]",
    },
  },
  {
    id: "reveal",
    name: "Curriculum reveal",
    when: "Showing what is actually inside the box.",
    product: "kit",
    adType: "carousel",
    campaignTag: "general",
    answers: {
      product: "kit", objective: "awareness", audience: "homeschool", angle: "openandgo",
      adType: "carousel", template: "forest", treatment: "static", anchor: "tc",
      overlay: {
        hook: "[What it is, plainly]",
        sub: "[The one detail that surprises people]",
        cta: "Learn More",
      },
      caption: "[Name the component.]\n\n"
        + "[What it contains, concretely.]\n\n"
        + "[Why it earns its place in the week.]",
    },
  },
];

export function templateById(id: string): StudioTemplate | undefined {
  return STUDIO_TEMPLATES.find((t) => t.id === id);
}

/** What a template writes into a new project's `state` column, in the shape
 *  the flow actually reads. */
export function templateState(id: string | undefined): { flow: FlowAnswers } | undefined {
  const t = id ? templateById(id) : undefined;
  return t ? { flow: t.answers } : undefined;
}
