import type { ReactNode } from "react";
import { permanentRedirect } from "next/navigation";
import { instantiate, registry } from "@qubo/blocks";
import { arrivalScript, mayArriveCovered } from "@qubo/blocks/runtime";
import { RenderView } from "@/lib/render";
import { JsonLd, siteLd } from "@/lib/seo";
import { getStorefront, hostFromParam, requestPath, type Storefront } from "@/lib/site";

const escapeHtml = (v: string) => v.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Maintenance page: the site's `maintenance` template, else a built-in notice with the settings message. */
async function Maintenance({ sf }: { sf: Storefront }) {
  const tpl = await sf.client.getTemplate("maintenance");
  const fr = sf.site.locale.startsWith("fr");
  const body = tpl?.data ?? {
    root: { props: {} },
    content: [
      instantiate(registry, "RichText", {
        props: {
          align: "center",
          content: [
            { type: "Heading", props: { text: fr ? "Nous revenons bientôt" : "We'll be back soon", level: "h1" } },
            { type: "Text", props: { body: `<p>${escapeHtml(sf.maintenance?.message || (fr ? "Le site est en maintenance." : "The site is undergoing maintenance."))}</p>` } },
          ],
        },
      }),
    ],
  };
  return <RenderView sf={sf} body={body} documentId={tpl?.documentId} />;
}

// Root layout per host: <html lang> follows the site's locale.
export default async function SiteLayout({ children, params }: { children: ReactNode; params: Promise<{ site: string }> }) {
  const sf = await getStorefront(hostFromParam((await params).site));
  if (sf?.redirectHost) permanentRedirect(`https://${sf.redirectHost}${await requestPath()}`);
  return (
    // The arrival script may set `data-qb-arriving` on <html> before hydration.
    <html lang={sf?.site.locale ?? "en"} style={{ height: "100%" }} suppressHydrationWarning>
      {/* The theme root fills the viewport, so short pages keep the theme background. */}
      <body style={{ margin: 0, height: "100%" }}>
        {/* Before first paint: keeps the previous page's transition cover up while this one loads. */}
        {mayArriveCovered(sf?.theme) ? <script dangerouslySetInnerHTML={{ __html: arrivalScript() }} /> : null}
        {sf?.maintenance ? <Maintenance sf={sf} /> : children}
        {sf && !sf.maintenance ? <JsonLd data={siteLd(sf)} /> : null}
      </body>
    </html>
  );
}
