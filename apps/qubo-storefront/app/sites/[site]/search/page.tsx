import { templateRoute } from "@/lib/template-page";

const route = templateRoute("search");
export const generateMetadata = route.generateMetadata;
export default route.Page;
