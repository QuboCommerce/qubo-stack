import { describe, expect, test } from "bun:test";
import { chatSubject, cleanFormData, publicStaffName, createRateLimiter, formThread, isSignupOnly, replySubject, textToHtml } from "./index";

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
