import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.QUBO_PREVIEW_SECRET = "test-secret";
const dir = await mkdtemp(join(tmpdir(), "qubo-storage-"));
process.env.STORAGE_DIR = dir;
const { dimensions, signFile, storage, verifyFile } = await import("./server");

describe("disk driver", () => {
  test("put, get, delete", async () => {
    const s = storage();
    await s.put("media/a/b.txt", new TextEncoder().encode("hello"), "text/plain");
    const got = await s.get("media/a/b.txt");
    expect(got?.size).toBe(5);
    expect(await new Response(got!.body).text()).toBe("hello");
    await s.delete("media/a/b.txt");
    expect(await s.get("media/a/b.txt")).toBeNull();
    await expect(s.put("../escape.txt", new Uint8Array([1]), "text/plain")).rejects.toThrow();
    await rm(dir, { recursive: true, force: true });
  });
});

describe("signed links", () => {
  test("verify until expiry, bound to the key", () => {
    const now = 1_760_000_000_000;
    const { exp, sig } = signFile("inbox/x/y.pdf", 60_000, now);
    expect(verifyFile("inbox/x/y.pdf", String(exp), sig, now)).toBe(true);
    expect(verifyFile("inbox/x/z.pdf", String(exp), sig, now)).toBe(false);
    expect(verifyFile("inbox/x/y.pdf", String(exp), sig, now + 120_000)).toBe(false);
    expect(verifyFile("inbox/x/y.pdf", null, sig, now)).toBe(false);
  });
});

test("dimensions of a 1×1 png", () => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
  expect(dimensions(new Uint8Array(png))).toEqual({ width: 1, height: 1 });
  expect(dimensions(new Uint8Array([1, 2, 3]))).toBeNull();
});
