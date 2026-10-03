import { headers } from "next/headers";
import { RenderView } from "@/lib/render";
import { getStorefront } from "@/lib/site";

/** Renders the site's `not_found` template; not-found pages get no params, so the host comes from the proxy header. */
export default async function NotFound() {
  const host = (await headers()).get("x-qubo-host") ?? "";
  const sf = host ? await getStorefront(host) : null;
  const tpl = sf ? await sf.client.getTemplate("not_found") : null;
  if (!sf || !tpl) {
    return (
      <main style={{ font: "16px/1.5 system-ui, sans-serif", padding: "20vh 24px", textAlign: "center" }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>{sf ? "Page not found" : "No site on this host"}</h1>
      </main>
    );
  }
  return <RenderView sf={sf} body={tpl.data} documentId={tpl.documentId} />;
}
