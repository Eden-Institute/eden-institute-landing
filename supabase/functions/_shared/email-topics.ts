// supabase/functions/_shared/email-topics.ts
//
// Email topics: the choices a family sees on the Resend preference page instead of only
// "unsubscribe from everything" (punch #22; 10/14 email plan, "before March").
//
// HOW IT WORKS
//   - Each topic below exists in Resend with default_subscription opt_in (everyone keeps
//     receiving it unless she unticks it; Resend cannot change this after creation) and
//     visibility public (every contact sees it on the page).
//   - A Broadcast scoped to a topic (broadcast-stage `create` with `topic`) skips anyone
//     who unticked that topic. A Broadcast WITHOUT a topic ignores topic choices, so once
//     topics are live every list Broadcast must carry one.
//   - Each change reaches resend-webhook as contact.topics.updated and is recorded in
//     public.email_topic_preferences. 🔴 It is NEVER a global unsubscribe (see the
//     migration and parseTopicsUpdate below); "unsubscribe from all" keeps its own path.
//
// The topics are found in Resend by exact NAME, so a name here is a contract: rename one
// in Resend and broadcast-stage refuses to create a Broadcast for it until this matches.
// Names max 50 characters, descriptions max 200 (Resend's limits). No em dashes.

export const EMAIL_TOPICS = {
  fridays: {
    name: 'The Friday letter',
    description: 'One email from Camila each Friday: a week from Eden\'s Table to try at home, and news from our table.',
  },
  news: {
    name: 'New books and sales',
    description: 'When a new book or band is ready, or something goes on sale.',
  },
} as const;

export type EmailTopicKey = keyof typeof EMAIL_TOPICS;

export function isEmailTopicKey(v: unknown): v is EmailTopicKey {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(EMAIL_TOPICS, v);
}

export type TopicSubscription = 'opt_in' | 'opt_out';

export interface TopicsUpdate {
  email: string;
  changedAt: string;
  topics: Array<{ id: string; subscription: TopicSubscription }>;
}

/**
 * Read a contact.topics.updated event (Resend OpenAPI ContactTopicsEventData:
 * data.email, data.topics[{ id, subscription }]). Returns null for anything else or for a
 * malformed payload, so nothing half-read is ever written. It never yields an
 * "unsubscribed" signal: a topic choice is recorded as a topic choice and nothing more.
 */
export function parseTopicsUpdate(event: { type?: unknown; created_at?: unknown; data?: unknown }): TopicsUpdate | null {
  if (event.type !== 'contact.topics.updated') return null;
  const data = (event.data ?? {}) as { email?: unknown; topics?: unknown };
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
  if (!email.includes('@') || !Array.isArray(data.topics)) return null;
  const changedAt = typeof event.created_at === 'string' && !Number.isNaN(Date.parse(event.created_at))
    ? new Date(event.created_at).toISOString()
    : null;
  if (!changedAt) return null;
  const topics: TopicsUpdate['topics'] = [];
  for (const t of data.topics) {
    const { id, subscription } = (t ?? {}) as { id?: unknown; subscription?: unknown };
    if (typeof id !== 'string' || !id) return null;
    if (subscription !== 'opt_in' && subscription !== 'opt_out') return null;
    topics.push({ id, subscription });
  }
  return topics.length ? { email, changedAt, topics } : null;
}
