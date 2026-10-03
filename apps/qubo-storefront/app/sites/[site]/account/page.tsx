import { templateRoute } from "@/lib/template-page";

const route = templateRoute("account", { requires: "accounts", noindex: true });
export const generateMetadata = route.generateMetadata;
export default route.Page;
