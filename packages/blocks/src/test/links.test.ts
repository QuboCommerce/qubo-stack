import { describe, expect, it } from "bun:test";
import { resolveLink } from "../core";

describe("resolveLink", () => {
  const primary = {};
  const nl = { basePath: "/nl" };

  it("keeps primary-locale links root relative", () => {
    expect(resolveLink({ kind: "collection", value: "all" }, primary)).toBe("/collections/all");
    expect(resolveLink({ kind: "page", value: "home" }, primary)).toBe("/");
    expect(resolveLink({ kind: "url", value: "/#rayons" }, primary)).toBe("/#rayons");
  });

  it("puts secondary-locale links under the prefix", () => {
    expect(resolveLink({ kind: "collection", value: "all" }, nl)).toBe("/nl/collections/all");
    expect(resolveLink({ kind: "page", value: "home" }, nl)).toBe("/nl");
    expect(resolveLink({ kind: "url", value: "/#rayons" }, nl)).toBe("/nl#rayons");
    expect(resolveLink({ kind: "url", value: "https://example.com/x" }, nl)).toBe("https://example.com/x");
  });

  it("leaves in-page anchors alone", () => {
    expect(resolveLink({ kind: "anchor", value: "contact" }, nl)).toBe("#contact");
    expect(resolveLink({ kind: "anchor", value: "#" }, nl)).toBe("#");
  });
});
