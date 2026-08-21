// TARGET PATH IN REPO: src/components/founder/OutreachTab.tsx
//
// Influencer + podcast outreach pipeline for /founder.
// Reads the Supabase mirror of the outreach tracker sheet. Both RPCs are SECURITY DEFINER
// and guarded by is_founder(); anon has no execute grant. These rows are real people's
// names, handles and contact history, so this must never move to a public surface.
//
// Follows the PartnersTab.tsx conventions deliberately: local StatCard/SectionLabel/Th/Td
// rather than shadcn, local useCallback loader, error block first, empty state explains
// which table backs it.
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

type Influencer = {
  handle: string;
  display_name: string | null;
  profile_url: string | null;
  followers: number | null;
  status: string | null;
  touches: number;
  last_contacted: string | null;
  next_touch_due: string | null;
  converted: boolean;
  outcome: string | null;
};

type Podcast = {
  show: string;
  host: string | null;
  episodes: number | null;
  last_episode: string | null;
  takes_guests: string | null;
  status: string | null;
  touches: number;
  last_touch: string | null;
  next_action: string | null;
  next_action_due: string | null;
};

const ACTIVE = new Set(["Sent", "Responded"]);
const num = (n: number | null | undefined) =>
  typeof n === "number" ? n.toLocaleString() : "—";
const day = (s: string | null) => (s ? s.slice(0, 10) : "—");

export default function OutreachTab() {
  const [infl, setInfl] = useState<Influencer[]>([]);
  const [pods, setPods] = useState<Podcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [a, b] = await Promise.all([
      supabase.rpc("founder_outreach_influencers"),
      supabase.rpc("founder_outreach_podcasts"),
    ]);
    if (a.error || b.error) {
      setError(a.error?.message ?? b.error?.message ?? "Failed to load");
    } else {
      setInfl((a.data ?? []) as Influencer[]);
      setPods((b.data ?? []) as Podcast[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div className="mb-6 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
        <p className="text-sm">{error}</p>
      </div>
    );
  }
  if (loading) return <p className="text-sm text-muted-foreground">Loading outreach…</p>;

  if (!infl.length && !pods.length) {
    return (
      <div className="rounded-lg border border-border p-6 bg-card">
        <p className="text-sm text-muted-foreground">
          No outreach rows yet. These tables are a read mirror of the outreach tracker sheet and
          are refreshed by <code>scripts/sync_outreach.py</code> at every wrap. If this is empty,
          the sync has not run.
        </p>
      </div>
    );
  }

  // ---- influencer rollups
  const active = infl.filter((r) => ACTIVE.has(r.status ?? "") || (r.status ?? "").startsWith("Queued"));
  const responded = infl.filter((r) => r.status === "Responded");
  const converted = infl.filter((r) => r.converted);
  const awaitingEmail = responded.filter(
    (r) => !r.converted && /AWAITING/i.test(r.outcome ?? "")
  );
  const reach = active.reduce((s, r) => s + (r.followers ?? 0), 0);

  // ---- podcast rollups
  const contacted = pods.filter((p) => p.touches > 0);
  const booked = pods.filter((p) => /^(BOOKED|RECORDED|RESPONDED - YES|PAID)/i.test(p.status ?? ""));
  const dueNow = pods.filter(
    (p) => p.next_action_due && p.next_action_due <= new Date().toISOString().slice(0, 10)
  );

  const byStatus = (rows: { status: string | null }[]) => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(r.status ?? "—", (m.get(r.status ?? "—") ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  return (
    <div>
      {/* ------------------------------------------------ the number that matters most */}
      {awaitingEmail.length > 0 && (
        <section className="mb-8">
          <SectionLabel>Waiting on an email address</SectionLabel>
          <div className="mt-3 rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground mb-2">
              Said yes. Nothing can ship until they send an address.
            </p>
            <ul className="text-sm space-y-1">
              {awaitingEmail.map((r) => (
                <li key={r.handle}>
                  <span className="font-medium">@{r.handle}</span>
                  <span className="text-muted-foreground"> · {num(r.followers)} followers</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------ influencers */}
      <SectionLabel>Influencers</SectionLabel>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 mt-3">
        <StatCard label="Active" value={active.length} />
        <StatCard label="Responded" value={responded.length} />
        <StatCard label="Partners" value={converted.length} />
        <StatCard label="Reach" value={reach.toLocaleString()} />
      </div>

      <Table head={["Who", "Followers", "Touches", "Last contacted", "Status"]}>
        {active.map((r) => (
          <tr key={r.handle} className="border-t border-border">
            <Td>
              {r.profile_url ? (
                <a href={r.profile_url} target="_blank" rel="noreferrer" className="underline">
                  @{r.handle}
                </a>
              ) : (
                <>@{r.handle}</>
              )}
              {r.display_name ? (
                <span className="text-muted-foreground"> · {r.display_name}</span>
              ) : null}
            </Td>
            <Td>{num(r.followers)}</Td>
            <Td>{r.touches}</Td>
            <Td>{day(r.last_contacted)}</Td>
            <Td>{r.status ?? "—"}</Td>
          </tr>
        ))}
      </Table>

      <section className="mb-8 mt-4">
        <p className="text-xs text-muted-foreground">
          {byStatus(infl).map(([s, n]) => `${s}: ${n}`).join("  ·  ")}
        </p>
      </section>

      {/* --------------------------------------------------------------------- podcasts */}
      <SectionLabel>Podcasts</SectionLabel>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 mt-3">
        <StatCard label="On the tab" value={pods.length} />
        <StatCard label="Contacted" value={contacted.length} />
        <StatCard label="Booked / recorded" value={booked.length} />
        <StatCard label="Due now" value={dueNow.length} />
      </div>

      <Table head={["Show", "Host", "Activity", "Touches", "Last contacted", "Status"]}>
        {pods
          .filter((p) => p.touches > 0 || /^(BOOKED|RECORDED|RESPONDED)/i.test(p.status ?? ""))
          .map((p) => (
            <tr key={p.show} className="border-t border-border">
              <Td>{p.show}</Td>
              <Td>{p.host ?? "—"}</Td>
              <Td>
                {p.episodes ? (
                  <>
                    {num(p.episodes)} eps
                    {p.last_episode ? (
                      <span className="text-muted-foreground"> · last {day(p.last_episode)}</span>
                    ) : null}
                  </>
                ) : (
                  <span className="text-muted-foreground">unknown</span>
                )}
              </Td>
              <Td>{p.touches}</Td>
              <Td>{day(p.last_touch)}</Td>
              <Td>{p.status ?? "—"}</Td>
            </tr>
          ))}
      </Table>

      <p className="mt-3 text-xs text-muted-foreground">
        Activity is episode count and last release date, taken from the iTunes search API. It is a
        proxy for whether a show is alive and worth pitching. It is <strong>not</strong> audience
        reach — listener and download numbers are private to each host and have never been captured
        for any show on this tab.
      </p>

      <section className="mb-8 mt-4">
        <p className="text-xs text-muted-foreground">
          {byStatus(pods).map(([s, n]) => `${s}: ${n}`).join("  ·  ")}
        </p>
      </section>
    </div>
  );
}

/* ------------------------------------------------- local primitives, per PartnersTab */
function StatCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-4 bg-card">
      <div className="font-accent text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
        {label}
      </div>
      <div className="font-serif font-bold text-2xl" style={{ color: "hsl(var(--eden-bark))" }}>
        {value}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div
      className="font-accent text-xs tracking-[0.2em] uppercase"
      style={{ color: "hsl(var(--eden-gold))" }}
    >
      {children}
    </div>
  );
}

function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            {head.map((h) => (
              <Th key={h}>{h}</Th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th className="text-left font-accent text-[10px] tracking-[0.15em] uppercase text-muted-foreground px-3 py-2">
      {children}
    </th>
  );
}

function Td({ children }: { children: ReactNode }) {
  return <td className="px-3 py-2 align-top">{children}</td>;
}
