// Content collections. Added 2026-09-25 for /learn, the article section.
//
// /learn/<slug> articles live in web/content/learn/*.md. An article is published
// only when its frontmatter says `draft: false`; drafts build nothing and are
// left out of the sitemap. Files starting with "_" (the template) are ignored.
//
// Copy rules for every article: no em dashes, no health claims, no kit, preorder
// or credit wording, and product facts only from what the live product pages say.
// Camila approves each article before its draft flag is flipped.
import { defineCollection, z } from "astro:content";

const learn = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    /** <title> tag. Falls back to title. */
    seoTitle: z.string().optional(),
    description: z.string().max(170),
    /** First published, YYYY-MM-DD. */
    published: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    /** Last real content change, YYYY-MM-DD. Never the build date. */
    updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    draft: z.boolean().default(true),
    /** Shipped as FAQPage JSON-LD and shown at the foot of the article. */
    faq: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
  }),
});

export const collections = { learn };
