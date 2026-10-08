import { expect, test } from "bun:test";

process.env.QUBO_PREVIEW_SECRET = "test-secret";
process.env.DATABASE_URL ??= "postgres://x:y@127.0.0.1:1/x";
const { complete, openSecret, sealSecret } = await import("./server");

test("seal/open round trip, tamper and secret change", () => {
  const s = sealSecret("sk-live-1234");
  expect(s).not.toContain("1234");
  expect(openSecret(s)).toBe("sk-live-1234");
  expect(sealSecret("sk-live-1234")).not.toBe(s);
  const parts = s.split(".");
  expect(openSecret([...parts.slice(0, 3), parts[3].slice(0, -2) + "AA"].join("."))).toBeNull();
  process.env.QUBO_PREVIEW_SECRET = "other";
  expect(openSecret(s)).toBeNull();
  process.env.QUBO_PREVIEW_SECRET = "test-secret";
});

test("complete speaks both wire formats", async () => {
  const seen: { url: string; headers: Record<string, string>; body: any }[] = [];
  const real = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    seen.push({ url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) });
    const anthropic = url.includes("/messages");
    return Response.json(anthropic ? { content: [{ type: "text", text: "hi" }], usage: { input_tokens: 5, output_tokens: 2 } } : { choices: [{ message: { content: "yo" } }], usage: { prompt_tokens: 7, completion_tokens: 3 } });
  }) as typeof fetch;
  try {
    const turns = [{ role: "system" as const, content: "sys" }, { role: "user" as const, content: "u" }];
    expect(await complete({ kind: "openai", baseUrl: "http://x/v1/", apiKey: "k", model: "m" }, turns, { json: true })).toEqual({ text: "yo", inputTokens: 7, outputTokens: 3 });
    expect(seen[0].url).toBe("http://x/v1/chat/completions");
    expect(seen[0].headers.authorization).toBe("Bearer k");
    expect(seen[0].body.response_format).toEqual({ type: "json_object" });
    expect(await complete({ kind: "anthropic", baseUrl: "http://a/v1", apiKey: "k", model: "m" }, turns)).toEqual({ text: "hi", inputTokens: 5, outputTokens: 2 });
    expect(seen[1].headers["x-api-key"]).toBe("k");
    expect(seen[1].body.system).toBe("sys");
    expect(seen[1].body.messages).toEqual([{ role: "user", content: "u" }]);
  } finally {
    globalThis.fetch = real;
  }
});

test("complete reports refused keys", async () => {
  const real = globalThis.fetch;
  globalThis.fetch = (async () => Response.json({ error: { message: "Incorrect API key" } }, { status: 401 })) as unknown as typeof fetch;
  try {
    await expect(complete({ kind: "openai", baseUrl: "http://x", apiKey: "bad", model: "m" }, [])).rejects.toMatchObject({ code: "key" });
  } finally {
    globalThis.fetch = real;
  }
});

test("private URLs are refused only when the instance says so", async () => {
  const { assertAllowedUrl } = await import("./server");
  await expect(assertAllowedUrl("ftp://x")).rejects.toMatchObject({ code: "not_configured" });
  await assertAllowedUrl("http://127.0.0.1:11434/v1");
  process.env.AI_PRIVATE_URLS = "deny";
  try {
    await expect(assertAllowedUrl("http://127.0.0.1:11434/v1")).rejects.toMatchObject({ code: "not_configured" });
    await expect(assertAllowedUrl("http://[::1]/v1")).rejects.toMatchObject({ code: "not_configured" });
    await expect(assertAllowedUrl("http://192.168.1.4/v1")).rejects.toMatchObject({ code: "not_configured" });
    await assertAllowedUrl("http://8.8.8.8/v1");
  } finally {
    delete process.env.AI_PRIVATE_URLS;
  }
});
