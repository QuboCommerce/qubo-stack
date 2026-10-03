import { templateRoute } from "@/lib/template-page";

const route = templateRoute("collection_list");
export const generateMetadata = route.generateMetadata;
export default route.Page;
