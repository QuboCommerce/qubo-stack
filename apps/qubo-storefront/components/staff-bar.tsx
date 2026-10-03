"use client";

import { useEffect, useState } from "react";

const HINT = "qubo_staff";
const DISMISSED = "qubo_pen_dismissed";

type Props = {
  siteId: string;
  siteSlug: string;
  /** e.g. https://qubo.hmfroid.be */
  adminOrigin: string;
  /** Document behind the current page; the pen opens it in Studio. */
  documentId?: string;
};

function hasHint(siteId: string) {
  const raw = document.cookie.split("; ").find((c) => c.startsWith(`${HINT}=`));
  return Boolean(raw && decodeURIComponent(raw.slice(HINT.length + 1)).split(".").includes(siteId));
}

/**
 * Floating Edit pen + mini admin bar for signed-in staff. Shown only when the
 * parent-domain `qubo_staff` hint names this site AND the panel's /api/me
 * confirms the session, so pages stay fully cacheable for everyone else.
 */
export function StaffBar({ siteId, siteSlug, adminOrigin, documentId }: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!hasHint(siteId) || sessionStorage.getItem(DISMISSED)) return;
    const ctrl = new AbortController();
    fetch(`${adminOrigin}/api/me`, { credentials: "include", signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ sites: { id: string }[] }>) : null))
      .then((me) => me?.sites.some((s) => s.id === siteId) && setShow(true))
      .catch(() => {});
    return () => ctrl.abort();
  }, [siteId, adminOrigin]);

  if (!show) return null;
  const base = `${adminOrigin}/${encodeURIComponent(siteSlug)}`;
  const editHref = `${base}/studio${documentId ? `?doc=${encodeURIComponent(documentId)}` : ""}`;

  return (
    <div role="toolbar" aria-label="Qubo" style={bar}>
      <a href={editHref} style={{ ...item, ...primary }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
        Edit page
      </a>
      <a href={`${base}/online-store`} style={item}>Theme</a>
      <a href={base} style={item}>Dashboard</a>
      <button
        type="button"
        aria-label="Hide"
        title="Hide for this session"
        style={{ ...item, padding: "0 10px" }}
        onClick={() => {
          sessionStorage.setItem(DISMISSED, "1");
          setShow(false);
        }}
      >
        ×
      </button>
    </div>
  );
}

// Inline styles: independent of the site's theme and CSS.
const bar: React.CSSProperties = {
  position: "fixed",
  right: 16,
  bottom: 16,
  zIndex: 2147483000,
  display: "flex",
  alignItems: "center",
  gap: 2,
  padding: 4,
  borderRadius: 999,
  background: "rgba(17,17,17,.92)",
  color: "#fff",
  font: "500 13px/1 system-ui, -apple-system, Segoe UI, sans-serif",
  boxShadow: "0 8px 30px rgba(0,0,0,.25)",
  backdropFilter: "blur(8px)",
};
const item: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  height: 32,
  padding: "0 12px",
  borderRadius: 999,
  color: "inherit",
  textDecoration: "none",
  background: "transparent",
  border: 0,
  font: "inherit",
  cursor: "pointer",
};
const primary: React.CSSProperties = { background: "#fff", color: "#111" };
