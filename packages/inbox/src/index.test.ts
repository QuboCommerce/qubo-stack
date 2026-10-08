import { describe, expect, test } from "bun:test";
import { baseSubject, slaState, chatSubject, htmlToText, inboundRoute, isAutoReply, parseAddress, referencedIds, replyAddress, stripQuoted, cleanFormData, publicStaffName, createRateLimiter, formThread, isSignupOnly, replySubject, textToHtml } from "./index";

describe("cleanFormData", () => {
  test("drops internal, empty and non-string fields; trims", () => {
    expect(cleanFormData({ name: " Ali ", _company_website: "x", empty: "  ", n: 3 as unknown as string })).toEqual({ name: "Ali" });
  });
  test("caps value length and field count", () => {
    const many = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`f${i}`, "v"]));
    expect(Object.keys(cleanFormData(many))).toHaveLength(30);
    expect(cleanFormData({ m: "x".repeat(9000) }).m).toHaveLength(5000);
  });
});

describe("formThread", () => {
  test("recognises contact fields and lists the rest", () => {
    const t = formThread("Contact", { name: "Mostapha", email: "M@Example.be", phone: "0470", message: "Need a quote" });
    expect(t).toEqual({ contactName: "Mostapha", contactEmail: "m@example.be", subject: "Contact · Mostapha", body: "Need a quote\n\nPhone: 0470" });
  });
  test("first/last names, explicit subject, invalid e-mail", () => {
    const t = formThread("Quote", { voornaam: "Jan", achternaam: "Peeters", email: "nope", onderwerp: "Koelcel" });
    expect(t.contactName).toBe("Jan Peeters");
    expect(t.contactEmail).toBeNull();
    expect(t.subject).toBe("Koelcel");
    expect(t.body).toBe("Email: nope");
  });
});

test("signup-only forms", () => {
  expect(isSignupOnly({ email: "a@b.be" })).toBe(true);
  expect(isSignupOnly({ email: "a@b.be", message: "hi" })).toBe(false);
});

test("rate limiter windows", () => {
  const allow = createRateLimiter(2, 1000);
  expect([allow("ip", 0), allow("ip", 1), allow("ip", 2), allow("ip", 1001)]).toEqual([true, true, false, true]);
});

test("e-mail helpers", () => {
  expect(textToHtml("a<b\nc\n\nd")).toBe("<p>a&lt;b<br>c</p><p>d</p>");
  expect(replySubject("Re: x")).toBe("Re: x");
  expect(replySubject("x")).toBe("Re: x");
});

describe("chat helpers", () => {
  test("chatSubject takes the first line and caps it", () => {
    expect(chatSubject("  Hallo daar\nTweede regel")).toBe("Hallo daar");
    expect(chatSubject("x".repeat(100))).toHaveLength(80);
    expect(chatSubject("   ")).toBe("Chat");
  });
  test("publicStaffName shows first names only", () => {
    expect(publicStaffName("Mostapha Hilal")).toBe("Mostapha");
    expect(publicStaffName(null)).toBeNull();
  });
});

describe("inbound e-mail", () => {
  const id = "0b6a1c3e-8f1d-4a52-9d3e-2b7c9f0a1e44";
  test("routes reply addresses before site addresses", () => {
    expect(inboundRoute([`hm-froid@in.example.com`, `"Shop" <reply+${id}@In.Example.com>`], "in.example.com")).toEqual({ conversationId: id });
    expect(inboundRoute(["someone@else.com", "HM-Froid+sales@in.example.com"], "in.example.com")).toEqual({ siteSlug: "hm-froid" });
    expect(inboundRoute(["hm-froid@other.com"], "in.example.com")).toBeNull();
    expect(inboundRoute(["hm-froid@in.example.com"], "")).toBeNull();
    expect(replyAddress(id, "In.Example.com")).toBe(`reply+${id}@in.example.com`);
  });
  test("parses addresses", () => {
    expect(parseAddress('"Jan Peeters" <Jan@Example.be>')).toEqual({ name: "Jan Peeters", email: "jan@example.be" });
    expect(parseAddress("jan@example.be")).toEqual({ name: null, email: "jan@example.be" });
    expect(parseAddress("not an address")).toBeNull();
  });
  test("collects referenced ids, In-Reply-To first", () => {
    expect(referencedIds({ "In-Reply-To": "<b@x>", references: "<a@x> <b@x>" })).toEqual(["<b@x>", "<a@x>"]);
    expect(referencedIds({})).toEqual([]);
  });
  test("spots auto replies", () => {
    expect(isAutoReply({ "auto-submitted": "auto-replied" }, "jan@example.be")).toBe(true);
    expect(isAutoReply({ "auto-submitted": "no" }, "jan@example.be")).toBe(false);
    expect(isAutoReply({ precedence: "bulk" }, "jan@example.be")).toBe(true);
    expect(isAutoReply({}, "MAILER-DAEMON@example.be")).toBe(true);
    expect(isAutoReply({}, "jan@example.be")).toBe(false);
  });
  test("strips quoted history in several languages", () => {
    expect(stripQuoted("Thanks!\n\nOn Mon, 3 Mar 2026 at 10:00, Shop <a@b.c> wrote:\n> old")).toBe("Thanks!");
    expect(stripQuoted("Merci\n\nLe lun. 3 mars 2026 à 10:00, Shop <a@b.c> a écrit :\n> vieux")).toBe("Merci");
    expect(stripQuoted("Dank u\n\nOp ma 3 mrt 2026 om 10:00 schreef Shop <a@b.c>:\n> oud")).toBe("Dank u");
    expect(stripQuoted("Top\n\nOn Mon, 3 Mar 2026 at 10:00, Shop\n<a@b.c> wrote:\n> old")).toBe("Top");
    expect(stripQuoted("Yes\n\nFrom: Shop <a@b.c>\nSent: today")).toBe("Yes");
    expect(stripQuoted("> only a quote")).toBe("> only a quote");
    expect(stripQuoted("Line one\n> inline quote\nmy answer")).toBe("Line one\n> inline quote\nmy answer");
  });
  test("html to text and base subjects", () => {
    expect(htmlToText("<style>p{}</style><p>Hi&nbsp;there</p><p>A &amp; B<br>C</p>")).toBe("Hi there\nA & B\nC");
    expect(baseSubject("Re: RE: Fwd: Offerte koelcel")).toBe("offerte koelcel");
    expect(baseSubject("Antw: Offerte")).toBe("offerte");
  });
});

describe("sla", () => {
  const now = Date.parse("2026-03-03T12:00:00Z");
  const ago = (h: number) => new Date(now - h * 3_600_000);
  test("only counts open threads where the customer spoke last", () => {
    expect(slaState("open", "staff", ago(30), now)).toBeNull();
    expect(slaState("pending", "customer", ago(30), now)).toBeNull();
    expect(slaState("open", "customer", ago(1), now)?.level).toBe("ok");
    expect(slaState("open", "customer", ago(5), now)?.level).toBe("warn");
    expect(slaState("open", "customer", ago(25), now)?.level).toBe("breach");
  });
});
