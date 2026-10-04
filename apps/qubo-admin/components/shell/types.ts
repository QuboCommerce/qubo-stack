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
  /** False = draft: only staff and the preview host can see it. */
  published: boolean;
  logo: string | null;
  /** Colours lifted from the active theme; paints the card thumbnail. */
  swatch: ShellSwatch;
  /** Unread open conversations; the inbox badge on the card. */
  unread: number;
};

export type ShellSwatch = { background: string; primary: string; text: string; mode: "light" | "dark" };

export type ShellOrg = {
  id: string;
  name: string;
  legalName: string | null;
  companyNumber: string | null;
  role: string;
  /** Outside the plan: its sites are locked and nothing new can be created in it. */
  locked: boolean;
};

export type ShellQuota = { used: number; limit: number | null; canCreate: boolean };
export type ShellAccess = { plan: string; sites: ShellQuota; orgs: ShellQuota };

export type ShellUser = { name: string; email: string; role: string; image: string | null };

export type ShellCounts = { orders: number; inbox: number };
