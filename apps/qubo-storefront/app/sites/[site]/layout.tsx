import type { ReactNode } from "react";
import { permanentRedirect } from "next/navigation";
import { getStorefront, hostFromParam, requestPath } from "@/lib/site";

// Root layout per host: <html lang> follows the site's locale.
export default async function SiteLayout({ children, params }: { children: ReactNode; params: Promise<{ site: string }> }) {
  const sf = await getStorefront(hostFromParam((await params).site));
  if (sf?.redirectHost) permanentRedirect(`https://${sf.redirectHost}${await requestPath()}`);
  return (
    <html lang={sf?.site.locale ?? "en"} style={{ height: "100%" }}>
      {/* The theme root fills the viewport, so short pages keep the theme background. */}
      <body style={{ margin: 0, height: "100%" }}>{children}</body>
    </html>
  );
}
