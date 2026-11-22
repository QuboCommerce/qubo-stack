/** Inbox URL state (lens, view, filters), safe for client components. */

export const INBOX_VIEWS = ["open", "mine", "pending", "snoozed", "resolved", "all"] as const;
export type InboxView = (typeof INBOX_VIEWS)[number];

export const parseView = (v: string | undefined): InboxView => (INBOX_VIEWS as readonly string[]).includes(v ?? "") ? (v as InboxView) : "open";

export const INBOX_SORTS = ["newest", "oldest", "priority", "unread"] as const;
export type InboxSort = (typeof INBOX_SORTS)[number];

/** List options that live in the URL next to the view. */
export type ListOptions = { q?: string; sort: InboxSort; unread: boolean; assignee?: "me" | "none" | (string & {}); priority: boolean };

export function parseListOptions(sp: Record<string, string | undefined>): ListOptions {
  const assignee = sp.assignee && /^[\w-]{1,64}$/.test(sp.assignee) ? sp.assignee : undefined;
  return {
    q: sp.q?.trim() || undefined,
    sort: (INBOX_SORTS as readonly string[]).includes(sp.sort ?? "") ? (sp.sort as InboxSort) : "newest",
    unread: sp.unread === "1",
    assignee,
    priority: sp.priority === "1",
  };
}

/**
 * Where a thread lives in the sidebar. Forms, e-mail and chats sort by origin;
 * a thread escalated to a ticket moves to Tickets and keeps its origin as a badge.
 */
export const INBOX_LENSES = ["all", "forms", "email", "chats", "tickets"] as const;
export type InboxLens = (typeof INBOX_LENSES)[number];
export const parseLens = (v: string | undefined): InboxLens | null => (v === undefined ? "all" : (INBOX_LENSES as readonly string[]).includes(v) && v !== "all" ? (v as InboxLens) : null);

/** Rows per list page; the list says so when it is cut off. */
export const LIST_LIMIT = 200;

export type InboxState = { lens: InboxLens; view: InboxView; c?: string } & ListOptions;

/** The inbox URL for a state; defaults are left out so links stay short. */
export function inboxHref(site: string, s: InboxState): string {
  const q = new URLSearchParams();
  if (s.view !== "open") q.set("view", s.view);
  if (s.q) q.set("q", s.q);
  if (s.sort !== "newest") q.set("sort", s.sort);
  if (s.unread) q.set("unread", "1");
  if (s.priority) q.set("priority", "1");
  if (s.assignee) q.set("assignee", s.assignee);
  if (s.c) q.set("c", s.c);
  const path = s.lens === "all" ? `/${site}/inbox` : `/${site}/inbox/${s.lens}`;
  const qs = q.toString();
  return qs ? `${path}?${qs}` : path;
}
