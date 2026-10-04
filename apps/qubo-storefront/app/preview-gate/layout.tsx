import type { ReactNode } from "react";

export default function PreviewGateLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#0f0f10", color: "#e7e7e7", fontFamily: "system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
