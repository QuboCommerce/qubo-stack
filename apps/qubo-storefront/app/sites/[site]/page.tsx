import { templateRoute } from "@/lib/template-page";

const route = templateRoute("home");
export const generateMetadata = route.generateMetadata;
export default route.Page;
