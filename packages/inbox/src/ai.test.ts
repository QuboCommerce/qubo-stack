import { expect, test } from "bun:test";

process.env.DATABASE_URL ??= "postgres://x:y@127.0.0.1:1/x";
const { applyTriage } = await import("./ai");

const t = (urgency: "low" | "normal" | "high" | "urgent", category = "order", spam = false) =>
  ({ summary: "s", category, sentiment: "neutral", urgency, language: null, spam, extracted: { orderNumber: null, phone: null, products: [] } }) as const;

test("triage replaces its own tag, keeps human tags, flags spam", () => {
  expect(applyTriage({ tags: ["vip", "ai:quote"], priority: "normal" }, t("normal", "order", true))).toEqual({ tags: ["vip", "ai:order", "spam"], priority: "normal" });
});

test("triage only raises priority", () => {
  expect(applyTriage({ tags: [], priority: "normal" }, t("urgent")).priority).toBe("urgent");
  expect(applyTriage({ tags: [], priority: "high" }, t("low")).priority).toBe("high");
});
