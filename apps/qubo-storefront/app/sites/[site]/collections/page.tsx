import { templateRoute } from "@/lib/template-page";

const route = templateRoute("collection_list", { view: () => ({ collection: "all" }) });
export const generateMetadata = route.generateMetadata;
export default route.Page;
