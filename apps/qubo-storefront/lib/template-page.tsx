import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { TemplateKind } from "@qubo/storefront";
import { RenderView, viewMetadata, type ViewContext } from "./render";
import { getStorefront, hostFromParam, type Storefront } from "./site";

type Params = Promise<{ site: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type Props = { params: Params; searchParams: SearchParams };

export const hasCapability = (sf: Storefront, capability: string) => sf.site.capabilities.includes(capability);

/**
 * A route whose body is simply the site's template for `kind`. Routes for a
 * capability the site lacks (e.g. /cart without commerce) are 404s.
 */
export function templateRoute(
  kind: TemplateKind,
  opts: { requires?: string; noindex?: boolean; view?: (search: Awaited<SearchParams>) => ViewContext; title?: (view: ViewContext) => string | undefined } = {},
) {
  async function load({ params, searchParams }: Props) {
    const sf = await getStorefront(hostFromParam((await params).site));
    if (sf && opts.requires && !hasCapability(sf, opts.requires)) return { sf, tpl: null, view: {} };
    const view = opts.view ? opts.view(await searchParams) : {};
    const tpl = sf ? await sf.client.getTemplate(kind) : null;
    return { sf, tpl, view };
  }
  return {
    async generateMetadata(props: Props): Promise<Metadata> {
      const { sf, tpl, view } = await load(props);
      const meta = await viewMetadata(sf, { body: tpl?.data, title: opts.title?.(view), home: kind === "home" });
      return opts.noindex ? { ...meta, robots: { index: false, follow: true } } : meta;
    },
    async Page(props: Props) {
      const { sf, tpl, view } = await load(props);
      if (!sf || !tpl) notFound();
      return <RenderView sf={sf} body={tpl.data} view={view} documentId={tpl.documentId} />;
    },
  };
}
