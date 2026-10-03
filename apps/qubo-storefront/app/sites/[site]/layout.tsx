import type { ReactNode } from "react";
import { getStorefront, hostFromParam } from "@/lib/site";

// Root layout per host: <html lang> follows the site's locale.
export default async function SiteLayout({ children, params }: { children: ReactNode; params: Promise<{ site: string }> }) {
  const sf = await getStorefront(hostFromParam((await params).site));
  return (
    <html lang={sf?.site.locale ?? "en"}>
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
