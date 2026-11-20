import { describe, expect, test } from "bun:test";
import { fromLocalInput, toLocalInput } from "./zoned";

describe("zoned datetime-local", () => {
  test("reads wall time in Brussels across winter and summer", () => {
    expect(fromLocalInput("2026-11-20T10:00", "Europe/Brussels")?.toISOString()).toBe("2026-11-20T09:00:00.000Z");
    expect(fromLocalInput("2026-07-01T10:00", "Europe/Brussels")?.toISOString()).toBe("2026-07-01T08:00:00.000Z");
  });
  test("round-trips and rejects junk", () => {
    const d = fromLocalInput("2026-03-29T12:30", "Europe/Brussels")!;
    expect(toLocalInput(d, "Europe/Brussels")).toBe("2026-03-29T12:30");
    expect(fromLocalInput("", "Europe/Brussels")).toBeNull();
    expect(fromLocalInput("tomorrow", "Europe/Brussels")).toBeNull();
  });
});
