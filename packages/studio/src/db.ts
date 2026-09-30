import { db } from "@peltier/db/client";

export { db };
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
/** Either the pool or an open transaction. */
export type Executor = typeof db | Tx;

/** Who is acting, on which site. Every service call is scoped by this. */
export type Scope = { siteId: string; userId?: string | null };
