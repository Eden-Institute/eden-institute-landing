// src/components/founder/Week1SourcesPanel.tsx
//
// Founder dashboard → Funnel tab → "Week 1 sign-ups by source". Free Week 1
// (Sprouts + Seedlings) sign-ups per ISO week (last 12) and per calendar month
// (last 6), split by where the family came from, with Instagram called out.
//
// Reads founder_week1_signups_by_source (SECURITY DEFINER, is_founder()-gated,
// counted and bucketed in the database; see
// supabase/migrations/20261017224116_founder_week1_signups_by_source.sql).
// The ranges are fixed, so the dashboard's window selector does not apply:
// the panel asks for just enough history to fill both tables, and
// src/lib/week1Sources.ts fills empty weeks/months and formats the labels.

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  buildWeek1Tables,
  instagramShare,
  week1SourcesSince,
  type Week1SourcesData,
  type Week1TableRow,
} from "@/lib/week1Sources";

const IG_CELL = { backgroundColor: "hsl(var(--eden-gold) / 0.10)" };

export default function Week1SourcesPanel() {
  const [data, setData] = useState<Week1SourcesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Pinned at load time so the tables, the RPC window and the "so far" row
  // all agree even if the page stays open across midnight.
  const [loadedAt, setLoadedAt] = useState(() => new Date());

  const load = useCallback(async () => {
    const now = new Date();
    setLoading(true);
    setError(null);
    try {
      const { data: res, error: e } = await supabase.rpc("founder_week1_signups_by_source", {
        p_since: week1SourcesSince(now),
      });
      if (e) throw e;
      setData((res as unknown as Week1SourcesData | null) ?? { by_week: [], by_month: [] });
      setLoadedAt(now);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load Week 1 sign-ups. Has the founder_week1_signups_by_source migration run?",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const tables = useMemo(() => (data ? buildWeek1Tables(data, loadedAt) : null), [data, loadedAt]);
  const share = tables ? instagramShare(tables.weeks) : null;

  return (
    <section className="mb-8">
      <SectionLabel>Week 1 sign-ups by source</SectionLabel>

      {error && (
        <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <p className="font-body text-sm text-destructive">{error}</p>
        </div>
      )}

      {!tables && loading && (
        <p className="mt-3 font-body text-sm text-muted-foreground">Loading…</p>
      )}

      {tables && share && (
        <>
          <p className="mt-3 font-body text-sm">
            <span className="font-semibold" style={{ color: "hsl(var(--eden-bark))" }}>
              Instagram, last 12 weeks: {share.instagram} of {share.total} sign-ups ({share.pct})
            </span>
            <span className="text-muted-foreground">
              {" "}· this week {tables.weeks[0].instagram} of {tables.weeks[0].total}
            </span>
          </p>

          <SourceTable caption="Last 12 weeks (week of Monday)" rows={tables.weeks} />
          <SourceTable caption="Last 6 months" rows={tables.months} />

          <p className="font-body text-[11px] text-muted-foreground mt-2">
            Instagram tagged = link in bio or a tagged link; Instagram referrer = untagged taps from Instagram.
          </p>
          <p className="font-body text-[11px] text-muted-foreground mt-1">
            Free Week 1 (Sprouts + Seedlings), Central time. Each family counts once, on its first Week 1
            sign-up. A tag beats a referrer, so every sign-up sits in exactly one column. Test sign-ups are
            left out. Source capture began in late August 2026, so earlier sign-ups all show as Untagged.
            These ranges are fixed; the window selector does not change them.
          </p>
        </>
      )}
    </section>
  );
}

function SourceTable({ caption, rows }: { caption: string; rows: Week1TableRow[] }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left">
        <caption className="caption-top px-3 pt-2 text-left font-accent text-[11px] tracking-wider uppercase text-muted-foreground">
          {caption}
        </caption>
        <thead>
          <tr className="bg-muted/40">
            <Th>Period</Th>
            <Th right>Total</Th>
            <Th right ig>Instagram tagged</Th>
            <Th right ig>Instagram referrer</Th>
            <Th right>Facebook</Th>
            <Th right>Other tagged</Th>
            <Th right>Untagged</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-border">
              <Td>
                {r.label}
                {r.current && <span className="text-muted-foreground"> (so far)</span>}
              </Td>
              <Td right className="font-semibold">{r.total}</Td>
              <Td right ig className="font-semibold">{r.instagram_tagged}</Td>
              <Td right ig className="font-semibold">{r.instagram_referrer}</Td>
              <Td right className="text-muted-foreground">{r.facebook}</Td>
              <Td right className="text-muted-foreground">{r.other_tagged}</Td>
              <Td right className="text-muted-foreground">{r.untagged}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-accent text-xs tracking-[0.2em] uppercase" style={{ color: "hsl(var(--eden-gold))" }}>
      {children}
    </p>
  );
}

function Th({ children, right, ig }: { children: React.ReactNode; right?: boolean; ig?: boolean }) {
  return (
    <th
      className={`px-3 py-2 font-accent text-[11px] tracking-wider uppercase text-muted-foreground ${right ? "text-right" : ""}`}
      style={ig ? IG_CELL : undefined}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
  right,
  ig,
}: {
  children: React.ReactNode;
  className?: string;
  right?: boolean;
  ig?: boolean;
}) {
  return (
    <td
      className={`px-3 py-2 font-body text-sm ${right ? "text-right" : ""} ${className}`}
      style={ig ? IG_CELL : undefined}
    >
      {children}
    </td>
  );
}
