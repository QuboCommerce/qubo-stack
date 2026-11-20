const SITE_TYPE_KEYS = ["store", "services", "business", "editorial", "custom"] as const;
const PLAN_KEYS = ["free", "starter", "growth", "agency"] as const;

/** Narrow a raw site type to a `shell.siteTypes` key; unknown values return null so callers can show them as is. */
export const siteTypeKey = (type: string) => SITE_TYPE_KEYS.find((k) => k === type) ?? null;

/** Narrow a raw plan id to a `shell.plans` key. */
export const planKey = (plan: string) => PLAN_KEYS.find((k) => k === plan) ?? null;
