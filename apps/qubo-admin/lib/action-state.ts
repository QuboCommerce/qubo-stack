import type { Conflict } from "@/lib/merge";

export type ActionState = { ok?: boolean; error?: string; at?: number; conflict?: Conflict } | null;
