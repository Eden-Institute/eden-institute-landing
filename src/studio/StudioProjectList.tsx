// The /studio landing view and, as of Phase 8, the archive.
//
// Every campaign, searchable and filterable, each one reopenable or duplicable
// as the starting point for a new ad. Filtering happens client-side on purpose:
// this is one founder with hundreds of projects at most, and a local filter is
// instant where a round-trip per keystroke is not.

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AD_TYPES, CAMPAIGN_TAGS, PRODUCT_CHOICES } from "./studio-types";
import type { StudioProject } from "./studio-db";

interface Props {
  projects: StudioProject[];
  exportCounts: Record<string, number>;
  loading: boolean;
  error: string | null;
  busyId: string | null;
  onNew: () => void;
  onOpen: (p: StudioProject) => void;
  onDuplicate: (p: StudioProject) => void;
  onDelete: (p: StudioProject) => void;
}

const labelFor = (
  list: ReadonlyArray<{ id: string; label: string }>,
  id: string,
) => list.find((x) => x.id === id)?.label ?? id;

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

type Facet = { id: string; label: string };
const STATUSES: Facet[] = [
  { id: "draft", label: "Draft" },
  { id: "exported", label: "Exported" },
  { id: "archived", label: "Archived" },
];

function FilterRow({
  title, options, active, onToggle,
}: {
  title: string;
  options: ReadonlyArray<Facet>;
  active: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex items-baseline gap-3 flex-wrap">
      <span className="font-accent text-[10px] tracking-[0.2em] uppercase text-muted-foreground w-20 shrink-0">
        {title}
      </span>
      <div className="flex gap-1.5 flex-wrap">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onToggle(o.id)}
            className={`rounded-full border px-2.5 py-0.5 font-body text-xs transition ${
              active.includes(o.id)
                ? "border-[hsl(var(--eden-gold))] bg-[hsl(var(--eden-gold))]/10"
                : "border-border text-muted-foreground hover:border-muted-foreground"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function StudioProjectList({
  projects, exportCounts, loading, error, busyId,
  onNew, onOpen, onDuplicate, onDelete,
}: Props) {
  const [query, setQuery] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);

  const toggle = (set: string[], id: string) =>
    set.includes(id) ? set.filter((x) => x !== id) : [...set, id];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      if (tags.length && !tags.includes(p.campaign_tag)) return false;
      if (types.length && !types.includes(p.ad_type)) return false;
      if (statuses.length && !statuses.includes(p.status)) return false;
      if (!q) return true;
      // Search the title AND the facet labels, so "reel" or "sprouts" both
      // work without her remembering which filter they belong to.
      const hay = [
        p.title,
        labelFor(PRODUCT_CHOICES, p.product),
        labelFor(AD_TYPES, p.ad_type),
        labelFor(CAMPAIGN_TAGS, p.campaign_tag),
        p.platforms.join(" "),
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [projects, query, tags, types, statuses]);

  const anyFilter = tags.length || types.length || statuses.length || query.trim();

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <p
            className="font-accent text-xs tracking-[0.3em] uppercase mb-2"
            style={{ color: "hsl(var(--eden-gold))" }}
          >
            Ad Studio
          </p>
          <h1
            className="font-serif text-3xl font-bold"
            style={{ color: "hsl(var(--eden-bark))" }}
          >
            Your campaigns
          </h1>
        </div>
        <Button variant="eden" onClick={onNew}>New campaign</Button>
      </div>

      {projects.length > 0 && (
        <div className="space-y-2.5 mb-6 pb-6 border-b border-border">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search campaigns"
            className="font-body"
          />
          <FilterRow title="Campaign" options={CAMPAIGN_TAGS} active={tags}
            onToggle={(id) => setTags((s) => toggle(s, id))} />
          <FilterRow title="Ad type" options={AD_TYPES} active={types}
            onToggle={(id) => setTypes((s) => toggle(s, id))} />
          <FilterRow title="Status" options={STATUSES} active={statuses}
            onToggle={(id) => setStatuses((s) => toggle(s, id))} />
          {anyFilter ? (
            <p className="font-body text-xs text-muted-foreground pt-1">
              {filtered.length} of {projects.length}
              <button
                type="button"
                className="ml-2 underline hover:text-foreground"
                onClick={() => { setQuery(""); setTags([]); setTypes([]); setStatuses([]); }}
              >
                Clear
              </button>
            </p>
          ) : null}
        </div>
      )}

      {error && <p className="font-body text-sm text-destructive mb-6">{error}</p>}

      {loading ? (
        <p className="font-body text-muted-foreground">Loading campaigns…</p>
      ) : projects.length === 0 ? (
        <div className="rounded-md border border-dashed border-border px-6 py-12 text-center">
          <p className="font-serif text-lg mb-2" style={{ color: "hsl(var(--eden-bark))" }}>
            No campaigns yet
          </p>
          <p className="font-body text-sm text-muted-foreground mb-6">
            Start one and it will be saved here. Drafts survive a refresh.
          </p>
          <Button variant="eden" onClick={onNew}>Start your first campaign</Button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="font-body text-muted-foreground">Nothing matches those filters.</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((p) => {
            const exported = exportCounts[p.id] ?? 0;
            return (
              <li
                key={p.id}
                className="flex items-center justify-between gap-4 rounded-md border border-border px-4 py-3 hover:border-muted-foreground transition"
              >
                <button
                  type="button"
                  onClick={() => onOpen(p)}
                  className="text-left flex-1 min-w-0"
                >
                  <span
                    className="font-serif text-sm font-semibold truncate flex items-center gap-2"
                    style={{ color: "hsl(var(--eden-bark))" }}
                  >
                    {p.title}
                    {exported > 0 && (
                      <span className="font-accent text-[10px] tracking-wider uppercase rounded-full border border-[hsl(var(--eden-gold))] px-1.5 py-px text-[hsl(var(--eden-gold))] shrink-0">
                        {exported} exported
                      </span>
                    )}
                  </span>
                  <span className="block font-body text-xs text-muted-foreground mt-0.5 truncate">
                    {labelFor(PRODUCT_CHOICES, p.product)} ·{" "}
                    {labelFor(AD_TYPES, p.ad_type)} ·{" "}
                    {labelFor(CAMPAIGN_TAGS, p.campaign_tag)} ·{" "}
                    {p.status === "draft" ? "Draft" : p.status} ·{" "}
                    {relativeTime(p.updated_at)}
                  </span>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => onOpen(p)}>
                    Open
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busyId === p.id}
                    onClick={() => onDuplicate(p)}
                    title="Start a new campaign from this one"
                  >
                    {busyId === p.id ? "…" : "Duplicate"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(p)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    Delete
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
