# Eden Institute — design conventions

Eden Institute is a clinical herbalism brand (the Eden Apothecary app + Pattern-of-Eden quiz + Materia Medica course). **Aesthetic: a vintage apothecary / Materia Medica feel — ancient herbal knowledge being unearthed.** Aim every screen at: aged-parchment surfaces, deep forest green and gold-leaf accents, serif display type, botanical line-art, and generous manuscript-like quiet space. Calm and authoritative, never pop-wellness, never bright SaaS. No emojis.

## Build with the real components
Compose the library's own components (they are fully styled and on-brand) rather than hand-rolling primitives. Buttons, cards, tiers, the quiz spectrum, dialogs, tables, botanical accents, etc. all ship ready. A few need context when used:
- Components with links (`PublicTierCard`, `TierComparison`) render `<a>`/router links — render them inside a router if your canvas needs navigation.
- `Tooltip` needs a `TooltipProvider` ancestor.

## Styling idiom — brand tokens, not arbitrary utilities
Designs receive the library's **static stylesheet**, so only utility classes the library already uses are guaranteed present. For your own layout glue, style with the brand **CSS variables** (always defined) via inline `style` or the brand utilities below — this is exactly how Eden's own components are written.

**Color tokens** (use as `hsl(var(--token))`):
- `--eden-forest`, `--eden-forest-light` — primary deep green (also `--primary`)
- `--eden-gold`, `--eden-gold-light` — gold-leaf accent (eyebrows, dividers, markers)
- `--eden-parchment`, `--eden-parchment-dark`, `--eden-cream` — aged-paper backgrounds
- `--eden-bark`, `--eden-bark-light` — ink / body text
- `--eden-sage` — muted botanical green
- Semantic: `--background`, `--foreground`, `--muted` / `--muted-foreground`, `--secondary`, `--border`

**Typography classes** (present in the stylesheet):
- `font-serif` — Playfair Display / Garamond display headings (titles, prices, herb names)
- `font-body` — Crimson/Garamond running text
- `font-accent` — small-caps eyebrow; pair with `tracking-[0.25em] uppercase` and gold color

**Button has signature Eden variants** (use these, not the plain defaults, for brand surfaces):
`variant="eden"` (filled forest), `"eden-outline"` (forest outline), `"eden-gold"` (gold), `"eden-light"` (parchment) — all serif, uppercase, letter-spaced.

## Where the truth lives
Read `_ds/<folder>/styles.css` (and its imports) for the full token + class set, and each component's `<Name>.prompt.md` / `<Name>.d.ts` for its API and usage. Prefer reading those over guessing.

## Idiomatic snippet
```tsx
// A Materia Medica section header on parchment
<section style={{ background: "hsl(var(--eden-parchment))", padding: "48px 24px" }}>
  <p className="font-accent" style={{ color: "hsl(var(--eden-gold))", letterSpacing: "0.3em", textTransform: "uppercase", fontSize: 11 }}>
    Materia Medica
  </p>
  <h2 className="font-serif" style={{ color: "hsl(var(--eden-bark))", fontSize: 34 }}>
    Chamomile
  </h2>
  <p className="font-body" style={{ color: "hsl(var(--eden-bark))" }}>
    A gentle nervine and carminative, taken as an evening infusion.
  </p>
  <Button variant="eden" size="lg">Open monograph</Button>
</section>
```
