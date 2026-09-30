export type ShellSite = {
  slug: string;
  name: string;
  type: string;
  capabilities: string[];
  domain: string | null;
};

export type ShellUser = { name: string; email: string; role: string; image: string | null };

export type ShellCounts = { orders: number; leads: number };
