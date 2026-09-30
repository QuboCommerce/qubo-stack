import {
  collectAssetIds,
  collectTranslatableStrings,
  migrateDocument,
  registry,
  validateDocument,
  type DocumentData,
  type ValidationIssue,
} from "@peltier/blocks";
import { ValidationError } from "./errors";

export type { DocumentData, ValidationIssue };

/** Issues that make a tree unrenderable; everything else is a prop-level warning. */
export function isStructural(issue: ValidationIssue) {
  return issue.type === "root" || issue.path === "id" || issue.message.startsWith("Unknown block type");
}

/**
 * Normalises incoming editor data. Drafts may carry prop-level warnings (a
 * merchant mid-edit), but never a broken tree; `strict` is used for publish.
 */
export function prepare(input: unknown, opts: { strict?: boolean } = {}) {
  const raw = input as DocumentData;
  const structural = validateDocument(raw, registry).filter(isStructural);
  if (structural.length) throw new ValidationError(structural);
  const { data } = migrateDocument(raw, registry);
  const issues = validateDocument(data, registry);
  if (opts.strict && issues.length) throw new ValidationError(issues);
  return { data, issues };
}

export const assetIdsOf = (data: DocumentData) => collectAssetIds(data, registry);
export const stringsOf = (data: DocumentData) => collectTranslatableStrings(data, registry);

/** Translation rows address a leaf as `<nodeId>.<path>` (node ids contain no dots). */
export const translationPath = (nodeId: string, path: string) => `${nodeId}.${path}`;
export function splitTranslationPath(p: string) {
  const i = p.indexOf(".");
  return i < 0 ? { nodeId: p, path: "" } : { nodeId: p.slice(0, i), path: p.slice(i + 1) };
}

/** JSON with sorted keys — jsonb reorders keys, so plain stringify can't compare. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export const sameContent = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
