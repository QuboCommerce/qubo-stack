import type { Metadata } from "next";
import { headers } from "next/headers";
import { UNLOCK_PATH } from "@/lib/preview";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Preview", robots: { index: false, follow: false } };

/**
 * The only thing a preview host serves without a valid cookie. Deliberately
 * self-contained: no site data, theme or blocks are loaded until the PIN checks out.
 */
export default async function PreviewGate({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; expired?: string }> }) {
  const { next = "/", error, expired } = await searchParams;
  const host = (await headers()).get("x-qubo-host") ?? "";
  return (
        <form method="post" action={UNLOCK_PATH} style={{ width: 320, display: "grid", gap: 14, textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 12, letterSpacing: ".12em", textTransform: "uppercase", opacity: 0.6 }}>Preview</p>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{host}</h1>
          <p style={{ margin: 0, fontSize: 14, opacity: 0.7 }}>Enter the preview PIN from the site's admin.</p>
          <input type="hidden" name="next" value={next} />
          <input
            name="pin"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            maxLength={8}
            required
            autoFocus
            aria-label="Preview PIN"
            aria-invalid={error ? true : undefined}
            style={{ fontSize: 28, letterSpacing: ".4em", textAlign: "center", padding: "12px 8px", borderRadius: 10, border: `1px solid ${error ? "#e5484d" : "#333"}`, background: "#161618", color: "inherit", outline: "none" }}
          />
          {error && <p style={{ margin: 0, fontSize: 13, color: "#e5484d" }}>That PIN didn't match.</p>}
          {expired && !error && <p style={{ margin: 0, fontSize: 13, opacity: 0.7 }}>The PIN was changed. Enter the new one.</p>}
          <button type="submit" style={{ padding: "11px 16px", borderRadius: 10, border: 0, background: "#e7e7e7", color: "#111", fontWeight: 600, cursor: "pointer" }}>
            Open preview
          </button>
        </form>
  );
}
