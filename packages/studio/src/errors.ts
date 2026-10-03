import type { ValidationIssue } from "@qubo/blocks";

export class StudioError extends Error {
  constructor(
    readonly code: "not_found" | "conflict" | "invalid" | "forbidden",
    message: string,
  ) {
    super(message);
    this.name = "StudioError";
  }
  /** HTTP status for API adapters. */
  get status() {
    return { not_found: 404, conflict: 409, invalid: 422, forbidden: 403 }[this.code];
  }
}

export class NotFoundError extends StudioError {
  constructor(what = "Document") {
    super("not_found", `${what} not found.`);
  }
}

/** Someone else saved since this editor loaded; carries the winning version. */
export class ConflictError extends StudioError {
  constructor(readonly current: { version: number; updatedAt: Date; updatedById: string | null }) {
    super("conflict", "This was changed somewhere else since you opened it.");
  }
}

export class ValidationError extends StudioError {
  constructor(readonly issues: ValidationIssue[] | { path: string; message: string }[]) {
    super("invalid", issues[0] ? `Invalid content: ${issues[0].message}` : "Invalid content.");
  }
}

export const isStudioError = (e: unknown): e is StudioError => e instanceof StudioError;
