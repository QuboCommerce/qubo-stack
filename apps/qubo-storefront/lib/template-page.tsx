import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { TemplateKind } from "@qubo/storefront";
import { RenderView, viewMetadata } from "./render";
import { getStorefront, hostFromParam } from "./site";

type Params = Promise<{ site: string }>;

/** A route whose body is simply the site's template for `kind`. */
export function templateRoute(kind: TemplateKind) {
  async function load(params: Params) {
    const sf = await getStorefront(hostFromParam((await params).site));
    const tpl = sf ? await sf.client.getTemplate(kind) : null;
    return { sf, tpl };
  }
  return {
    async generateMetadata({ params }: { params: Params }): Promise<Metadata> {
      const { sf, tpl } = await load(params);
      return viewMetadata(sf, { body: tpl?.data });
    },
    async Page({ params }: { params: Params }) {
      const { sf, tpl } = await load(params);
      if (!sf || !tpl) notFound();
      return <RenderView sf={sf} body={tpl.data} />;
    },
  };
}
