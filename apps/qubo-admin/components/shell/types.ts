export type ShellSite = {
  slug: string;
  name: string;
  type: string;
  capabilities: string[];
  domain: string | null;
  /** Public storefront URL from siteUrl(); null = nowhere to view yet. */
  url: string | null;
  organization: { id: string; name: string };
  /** Outside the instance's plan; opening it shows /locked. */
  locked: boolean;
};

export type ShellUser = { name: string; email: string; role: string; image: string | null };

export type ShellCounts = { orders: number; leads: number };
