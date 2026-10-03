import { templateRoute } from "@/lib/template-page";

const route = templateRoute("cart");
export const generateMetadata = route.generateMetadata;
export default route.Page;
