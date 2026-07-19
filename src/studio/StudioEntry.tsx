// Screen I of the studio wizard: open a campaign project.
//
// The spec asked for platform + ad type + campaign tag; the shipped studio
// asked "which product". Both matter and they answer different questions, so
// this screen merges all four. Product drives the AI copy brief (the engine is
// good precisely because it knows the product), while platform, ad type, and
// campaign tag drive canvas sizing, the Meta handoff, and the Phase 8 archive.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AD_TYPES, CAMPAIGN_TAGS, PLATFORMS, PRODUCT_CHOICES,
} from "./studio-types";
import type { NewStudioProject } from "./studio-db";
import { STUDIO_TEMPLATES, templateById, templateState } from "./studio-templates";

interface Props {
  onCreate: (input: NewStudioProject) => void;
  onCancel: () => void;
  busy?: boolean;
  error?: string | null;
}

export default function StudioEntry({ onCreate, onCancel, busy, error }: Props) {
  const [title, setTitle] = useState("");
  const [product, setProduct] = useState<string>(PRODUCT_CHOICES[0].id);
  const [platforms, setPlatforms] = useState<string[]>(["instagram", "facebook"]);
  const [adType, setAdType] = useState<string>("feed");
  const [tag, setTag] = useState<string>("general");
  const [templateId, setTemplateId] = useState<string | null>(null);

  /** Picking a template moves the form to match it, so what she sees below is
   *  what she will get. Every field stays editable afterwards. */
  function applyTemplate(id: string) {
    const t = templateById(id);
    if (!t) return;
    setTemplateId(id);
    setProduct(t.product);
    setAdType(t.adType);
    setTag(t.campaignTag);
    if (!title.trim()) setTitle(t.name);
  }

  function togglePlatform(id: string) {
    setPlatforms((cur) =>
      cur.includes(id) ? cur.filter((p) => p !== id) : [...cur, id],
    );
  }

  // At least one platform is a database constraint, so guard it here rather
  // than letting the insert fail with a constraint error.
  const canSubmit = platforms.length > 0 && !busy;

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <p
        className="font-accent text-xs tracking-[0.3em] uppercase mb-2"
        style={{ color: "hsl(var(--eden-gold))" }}
      >
        Step I · Choose
      </p>
      <h1
        className="font-serif text-3xl font-bold mb-2"
        style={{ color: "hsl(var(--eden-bark))" }}
      >
        Start a campaign
      </h1>
      <p className="font-body text-muted-foreground mb-8">
        Four answers open the workroom. You can change any of them later.
      </p>

      <div className="space-y-8">
        <section>
          <Label className="font-accent text-xs tracking-[0.2em] uppercase">
            Start from a template (optional)
          </Label>
          <div className="grid sm:grid-cols-3 gap-2 mt-3">
            {STUDIO_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => applyTemplate(t.id)}
                className={`text-left rounded-md border px-4 py-3 transition ${
                  templateId === t.id
                    ? "border-[hsl(var(--eden-gold))] bg-[hsl(var(--eden-gold))]/10"
                    : "border-border hover:border-muted-foreground"
                }`}
              >
                <span className="block font-serif text-sm font-semibold">{t.name}</span>
                <span className="block font-body text-xs text-muted-foreground mt-0.5">
                  {t.when}
                </span>
              </button>
            ))}
          </div>
          <p className="font-body text-xs text-muted-foreground mt-2">
            {templateId
              ? "Template applied. It fills in structure and prompts, never finished copy, and everything stays editable."
              : "Templates set the layout and prompt you for the words. Skip this to start blank."}
            {templateId && (
              <button
                type="button"
                className="ml-2 underline hover:text-foreground"
                onClick={() => setTemplateId(null)}
              >
                Start blank instead
              </button>
            )}
          </p>
        </section>

        <section>
          <Label className="font-accent text-xs tracking-[0.2em] uppercase">
            What are you selling?
          </Label>
          <div className="grid sm:grid-cols-2 gap-2 mt-3">
            {PRODUCT_CHOICES.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setProduct(p.id)}
                className={`text-left rounded-md border px-4 py-3 transition ${
                  product === p.id
                    ? "border-[hsl(var(--eden-gold))] bg-[hsl(var(--eden-gold))]/10"
                    : "border-border hover:border-muted-foreground"
                }`}
              >
                <span className="block font-serif text-sm font-semibold">
                  {p.label}
                </span>
                <span className="block font-body text-xs text-muted-foreground mt-0.5">
                  {p.tag}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <Label className="font-accent text-xs tracking-[0.2em] uppercase">
            Where is it running?
          </Label>
          <div className="flex gap-2 mt-3">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => togglePlatform(p.id)}
                className={`rounded-full border px-4 py-1.5 font-body text-sm transition ${
                  platforms.includes(p.id)
                    ? "border-[hsl(var(--eden-gold))] bg-[hsl(var(--eden-gold))]/10"
                    : "border-border text-muted-foreground hover:border-muted-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {platforms.length === 0 && (
            <p className="font-body text-xs text-destructive mt-2">
              Pick at least one platform.
            </p>
          )}
        </section>

        <section>
          <Label className="font-accent text-xs tracking-[0.2em] uppercase">
            What kind of ad?
          </Label>
          <div className="grid sm:grid-cols-2 gap-2 mt-3">
            {AD_TYPES.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAdType(a.id)}
                className={`text-left rounded-md border px-4 py-3 transition ${
                  adType === a.id
                    ? "border-[hsl(var(--eden-gold))] bg-[hsl(var(--eden-gold))]/10"
                    : "border-border hover:border-muted-foreground"
                }`}
              >
                <span className="block font-serif text-sm font-semibold">
                  {a.label}
                </span>
                <span className="block font-body text-xs text-muted-foreground mt-0.5">
                  {a.hint}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="grid sm:grid-cols-2 gap-6">
          <div>
            <Label
              htmlFor="studio-tag"
              className="font-accent text-xs tracking-[0.2em] uppercase"
            >
              Campaign
            </Label>
            <select
              id="studio-tag"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              className="mt-3 w-full rounded-md border border-border bg-background px-3 py-2 font-body text-sm"
            >
              {CAMPAIGN_TAGS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label
              htmlFor="studio-title"
              className="font-accent text-xs tracking-[0.2em] uppercase"
            >
              Name it (optional)
            </Label>
            <Input
              id="studio-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Preorder push, week one"
              className="mt-3 font-body"
            />
          </div>
        </section>
      </div>

      {error && (
        <p className="font-body text-sm text-destructive mt-6">{error}</p>
      )}

      <div className="flex gap-3 mt-10">
        <Button
          variant="eden"
          disabled={!canSubmit}
          onClick={() =>
            onCreate({
              title,
              product,
              platforms,
              ad_type: adType,
              campaign_tag: tag,
              state: templateState(templateId),
            })
          }
        >
          {busy ? "Opening…" : "Open the workroom"}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
