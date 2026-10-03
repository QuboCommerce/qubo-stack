import { templateRoute } from "@/lib/template-page";

const route = templateRoute("account");
export const generateMetadata = route.generateMetadata;
export default route.Page;
