// The /studio landing view: every campaign project, most recent first.
//
// This doubles as the start of the Phase 8 archive. Filtering and search land
// there; Phase 1 only needs the list to exist, be resumable, and be honest
// about when each project was last touched.

import { Button } from "@/components/ui/button";
import { AD_TYPES, CAMPAIGN_TAGS, PRODUCT_CHOICES } from "./studio-types";
import type { StudioProject } from "./studio-db";

interface Props {
  projects: StudioProject[];
  loading: boolean;
  error: string | null;
  onNew: () => void;
  onOpen: (p: StudioProject) => void;
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

export default function StudioProjectList({
  projects, loading, error, onNew, onOpen, onDelete,
}: Props) {
  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-end justify-between gap-4 mb-8">
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
        <Button variant="eden" onClick={onNew}>
          New campaign
        </Button>
      </div>

      {error && <p className="font-body text-sm text-destructive mb-6">{error}</p>}

      {loading ? (
        <p className="font-body text-muted-foreground">Loading campaigns…</p>
      ) : projects.length === 0 ? (
        <div className="rounded-md border border-dashed border-border px-6 py-12 text-center">
          <p className="font-serif text-lg mb-2" style={{ color: "hsl(var(--eden-bark))" }}>
            No campaigns yet
          </p>
          <p className="font-body text-sm text-muted-foreground mb-6">
            Start one and it will be saved here. Drafts survive a refresh now.
          </p>
          <Button variant="eden" onClick={onNew}>
            Start your first campaign
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {projects.map((p) => (
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
                  className="block font-serif text-sm font-semibold truncate"
                  style={{ color: "hsl(var(--eden-bark))" }}
                >
                  {p.title}
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
                  onClick={() => onDelete(p)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
