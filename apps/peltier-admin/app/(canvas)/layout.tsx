import type { Metadata } from "next";

// Bare document for iframed block/page previews: no admin CSS, only theme CSS.
export const metadata: Metadata = { title: "Canvas", robots: { index: false, follow: false } };

export default function CanvasLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
