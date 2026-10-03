import { templateRoute } from "@/lib/template-page";

const route = templateRoute("cart", { requires: "commerce", noindex: true });
export const generateMetadata = route.generateMetadata;
export default route.Page;
