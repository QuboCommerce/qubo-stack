import { describe, expect, test } from "bun:test";
import { checkFile, cleanFilename, extOf, formatBytes, mediaKeyFromPath, mediaUrl } from "./index";

const bytes = (...b: (number | string)[]) => new Uint8Array(b.flatMap((x) => (typeof x === "string" ? [...x].map((c) => c.charCodeAt(0)) : [x])));
const png = bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a);
const jpg = bytes(0xff, 0xd8, 0xff, 0xe0);

describe("checkFile", () => {
  test("accepts matching content", () => {
    expect(checkFile("media", "Logo.PNG", png)).toEqual({ ok: true, file: { ext: "png", mime: "image/png", kind: "image" } });
    expect(checkFile("media", "photo.jpeg", jpg).ok).toBe(true);
    expect(checkFile("media", "icon.svg", bytes('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>')).ok).toBe(true);
  });
  test("rejects renamed files, wrong profiles, empty and huge files", () => {
    expect(checkFile("media", "evil.png", bytes("<html><script>"))).toEqual({ ok: false, problem: "content" });
    expect(checkFile("chat", "icon.svg", bytes("<svg/>"))).toEqual({ ok: false, problem: "type" });
    expect(checkFile("media", "run.exe", bytes("MZ"))).toEqual({ ok: false, problem: "type" });
    expect(checkFile("media", "a.png", new Uint8Array())).toEqual({ ok: false, problem: "empty" });
    const big = new Uint8Array(11e6);
    big.set(png);
    expect(checkFile("chat", "a.png", big)).toEqual({ ok: false, problem: "size" });
  });
});

describe("names and keys", () => {
  test("extensions and filenames", () => {
    expect(extOf("A.JPEG")).toBe("jpg");
    expect(extOf("noext")).toBe("");
    expect(cleanFilename('C:\\fakepath\\my "photo".png')).toBe("my photo.png");
    expect(cleanFilename("../../etc/passwd")).toBe("passwd");
  });
  test("media paths only map to library files", () => {
    const org = "0b6a1c3e-8f1d-4a52-9d3e-2b7c9f0a1e44";
    const id = "1c6a1c3e-8f1d-4a52-9d3e-2b7c9f0a1e45";
    expect(mediaUrl(org, id, "png")).toBe(`/api/media/${org}/${id}.png`);
    expect(mediaKeyFromPath(`${org}/${id}.png`)).toEqual({ key: `media/${org}/${id}.png`, ext: "png", assetId: id });
    expect(mediaKeyFromPath(`../inbox/${id}.png`)).toBeNull();
    expect(mediaKeyFromPath(`${org}/${id}.exe`)).toBeNull();
  });
});

test("formatBytes", () => {
  expect(formatBytes(512)).toBe("512 B");
  expect(formatBytes(2048)).toBe("2 KB");
  expect(formatBytes(5.5 * 1024 ** 2)).toBe("5.5 MB");
});
