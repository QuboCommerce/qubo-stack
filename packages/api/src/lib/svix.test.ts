import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { verifySvix } from "./svix";

const secret = `whsec_${Buffer.from("test-secret-key-0123456789").toString("base64")}`;
const sign = (id: string, ts: string, body: string) =>
  createHmac("sha256", Buffer.from(secret.slice(6), "base64")).update(`${id}.${ts}.${body}`).digest("base64");

describe("verifySvix", () => {
  const now = 1_760_000_000_000;
  const ts = String(now / 1000);
  const body = '{"type":"email.received"}';
  const headers = (sig: string, t = ts) => new Headers({ "svix-id": "msg_1", "svix-timestamp": t, "svix-signature": sig });
  test("accepts a valid signature among several", () => {
    expect(verifySvix(secret, headers(`v1,bogus v1,${sign("msg_1", ts, body)}`), body, now)).toBe(true);
  });
  test("rejects tampering, old timestamps and missing headers", () => {
    expect(verifySvix(secret, headers(`v1,${sign("msg_1", ts, body)}`), body + " ", now)).toBe(false);
    const old = String(now / 1000 - 600);
    expect(verifySvix(secret, headers(`v1,${sign("msg_1", old, body)}`, old), body, now)).toBe(false);
    expect(verifySvix(secret, new Headers(), body, now)).toBe(false);
  });
});
