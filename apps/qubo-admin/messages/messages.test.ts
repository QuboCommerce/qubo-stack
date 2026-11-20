import { describe, expect, test } from "bun:test";
import en from "./en";
import fr from "./fr";

type Tree = { [k: string]: string | Tree };

const flatten = (tree: Tree, prefix = ""): Record<string, string> =>
  Object.entries(tree).reduce<Record<string, string>>((out, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return typeof v === "string" ? { ...out, [key]: v } : { ...out, ...flatten(v, key) };
  }, {});

// Argument names inside ICU braces: `{count, plural, ...}` -> count, `{name}` -> name.
const vars = (s: string) => [...new Set([...s.matchAll(/\{\s*(\w+)\s*[,}]/g)].map((m) => m[1]!))].sort();

const source = flatten(en as Tree);
const french = flatten(fr as Tree);

describe("messages", () => {
  test("fr has exactly the keys of en", () => {
    expect(Object.keys(french).sort()).toEqual(Object.keys(source).sort());
  });

  test("fr keeps every placeholder of en", () => {
    const broken = Object.keys(source).filter((k) => french[k] !== undefined && vars(french[k]!).join() !== vars(source[k]!).join());
    expect(broken).toEqual([]);
  });

  test("no empty strings", () => {
    expect(Object.entries(french).filter(([, v]) => !v.trim()).map(([k]) => k)).toEqual([]);
  });
});
