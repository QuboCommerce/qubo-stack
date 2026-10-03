import { templateRoute } from "@/lib/template-page";

const route = templateRoute("search", {
  noindex: true,
  view: (search) => {
    const q = Array.isArray(search.q) ? search.q[0] : search.q;
    return { query: q?.trim().slice(0, 100) || undefined };
  },
  title: (view) => view.query && `“${view.query}”`,
});
export const generateMetadata = route.generateMetadata;
export default route.Page;
